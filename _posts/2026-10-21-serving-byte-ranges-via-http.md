---
title: "How ASP.NET Core Handles Range Requests for File Results"
description: "A source-level tour of ASP.NET Core's FileResultHelper pipeline, covering freshness validation, conditional headers, range processing, response status codes, and streaming file from memory regions."
date: 2026-08-21 00:00:01 +0200
categories: .NET
tags: dotnet aspnet-core file-result result-types file-serving http http-range range-request rfc7233 file-result-helper multipart byte-ranges
image:
  path: /assets/img/title/http-range-request-response-pair.png
  alt: HTTP range request and response pair
---

Following the protocol concepts from [HTTP Range Requests: Why They Matter and How They Work]({% post_url 2026-09-25-http-range-request-semantics %}), this second part explores how ASP.NET Core implements range processing for file results. We will follow the `FileResultHelper` pipeline from conditional request validation and response headers to range selection and response-body streaming.

## FileResultHelper Implementation Overview

Following HTTP protocol rules and semantics, ASP.NET Core implements support for HTTP range requests in the static `FileResultHelper` class. Both legacy MVC action results and modern result types share this internal file-processing implementation. The two helpers, `SetHeadersAndLog` and `WriteFileAsync`, follow HTTP semantics for resource freshness validation, range-header applicability, and response chunking.

### SetHeadersAndLog: HTTP header processing

Despite its name, `SetHeadersAndLog` is the primary orchestration method for the entire chunking mechanism. It analyzes incoming request headers in accordance with RFC specifications, writes file-specific response headers, and returns a tuple of values that essentially define the response body.

```csharp
internal static (RangeItemHeaderValue? range, long rangeLength, bool serveBody)
  SetHeadersAndLog(
    HttpContext httpContext,
    in FileResultInfo result,
    long? fileLength,
    bool enableRangeProcessing,
    DateTimeOffset? lastModified,
    EntityTagHeaderValue? etag,
    ILogger logger)
```

Among the input arguments, `HttpContext`, `FileResultInfo`, and `bool enableRangeProcessing` play essential roles. They provide the original request data, the target file result, and the flag that controls the range-processing branch of the workflow. The method takes all required inputs for evaluating the request and preparing the response.

The output tuple contains three values: `RangeItemHeaderValue? range`, `long rangeLength`, and `bool serveBody`. The nullable `RangeItemHeaderValue` allows the `WriteFileAsync` helper to skip chunking and write the full response instead.

The implementation relies on several private methods, each designed to handle a single responsibility.

```csharp
{
    var request = httpContext.Request;
    var httpRequestHeaders = request.GetTypedHeaders();

    var preconditionState = GetPreconditionState(httpRequestHeaders, lastModified, etag, logger);

    var response = httpContext.Response;
    SetLastModifiedAndEtagHeaders(response, lastModified, etag);

    // Short circuit if the preconditional headers process to 304 (NotModified) or 412 (PreconditionFailed)
    if (preconditionState == PreconditionState.NotModified)
    {
        response.StatusCode = StatusCodes.Status304NotModified;
        return (range: null, rangeLength: 0, serveBody: false);
    }
    else if (preconditionState == PreconditionState.PreconditionFailed)
    {
        response.StatusCode = StatusCodes.Status412PreconditionFailed;
        return (range: null, rangeLength: 0, serveBody: false);
    }

    response.ContentType = result.ContentType;
    SetContentDispositionHeader(httpContext, in result);

    if (fileLength.HasValue)
    {
        // Assuming the request is not a range request, and the response body is not empty, the Content-Length header is set to
        // the length of the entire file.
        // If the request is a valid range request, this header is overwritten with the length of the range as part of the
        // range processing (see method SetContentLength).

        response.ContentLength = fileLength.Value;

        // Handle range request
        if (enableRangeProcessing)
        {
            SetAcceptRangeHeader(response);

            // If the request method is HEAD or GET, PreconditionState is Unspecified or ShouldProcess, and IfRange header is valid,
            // range should be processed and Range headers should be set
            if ((HttpMethods.IsHead(request.Method) || HttpMethods.IsGet(request.Method))
                && (preconditionState == PreconditionState.Unspecified || preconditionState == PreconditionState.ShouldProcess)
                && (IfRangeValid(httpRequestHeaders, lastModified, etag, logger)))
            {
                return SetRangeHeaders(httpContext, httpRequestHeaders, fileLength.Value, logger);
            }
        }
        else
        {
            Log.NotEnabledForRangeProcessing(logger);
        }
    }

    return (range: null, rangeLength: 0, serveBody: !HttpMethods.IsHead(request.Method));
}
```

> **Note**: An empty `range` value means the binary is processed as a single entity without chunking.

#### Freshness Validation in GetPreconditionState

- **GetPreconditionState**: Validates data freshness using If-Match, If-None-Match, If-Modified-Since, and If-Unmodified-Since headers

```csharp
internal static PreconditionState GetPreconditionState(
    RequestHeaders httpRequestHeaders,
    DateTimeOffset? lastModified,
    EntityTagHeaderValue? etag,
    ILogger logger)
{
    var ifMatchState = PreconditionState.Unspecified;
    var ifNoneMatchState = PreconditionState.Unspecified;
    var ifModifiedSinceState = PreconditionState.Unspecified;
    var ifUnmodifiedSinceState = PreconditionState.Unspecified;

    // 14.24 If-Match
    var ifMatch = httpRequestHeaders.IfMatch;
    if (etag != null)
    {
        ifMatchState = GetEtagMatchState(
            useStrongComparison: true,
            etagHeader: ifMatch,
            etag: etag,
            matchFoundState: PreconditionState.ShouldProcess,
            matchNotFoundState: PreconditionState.PreconditionFailed);

        if (ifMatchState == PreconditionState.PreconditionFailed)
        {
            Log.IfMatchPreconditionFailed(logger, etag);
        }
    }

    // 14.26 If-None-Match
    var ifNoneMatch = httpRequestHeaders.IfNoneMatch;
    if (etag != null)
    {
        ifNoneMatchState = GetEtagMatchState(
            useStrongComparison: false,
            etagHeader: ifNoneMatch,
            etag: etag,
            matchFoundState: PreconditionState.NotModified,
            matchNotFoundState: PreconditionState.ShouldProcess);
    }

    var now = RoundDownToWholeSeconds(DateTimeOffset.UtcNow);

    // 14.25 If-Modified-Since
    var ifModifiedSince = httpRequestHeaders.IfModifiedSince;
    if (lastModified.HasValue && ifModifiedSince.HasValue && ifModifiedSince <= now)
    {
        var modified = ifModifiedSince < lastModified;
        ifModifiedSinceState = modified ? PreconditionState.ShouldProcess : PreconditionState.NotModified;
    }

    // 14.28 If-Unmodified-Since
    var ifUnmodifiedSince = httpRequestHeaders.IfUnmodifiedSince;
    if (lastModified.HasValue && ifUnmodifiedSince.HasValue && ifUnmodifiedSince <= now)
    {
        var unmodified = ifUnmodifiedSince >= lastModified;
        ifUnmodifiedSinceState = unmodified ? PreconditionState.ShouldProcess : PreconditionState.PreconditionFailed;

        if (ifUnmodifiedSinceState == PreconditionState.PreconditionFailed)
        {
            Log.IfUnmodifiedSincePreconditionFailed(logger, lastModified, ifUnmodifiedSince);
        }
    }

    return GetMaxPreconditionState(ifMatchState, ifNoneMatchState, ifModifiedSinceState, ifUnmodifiedSinceState);
}
```

#### HTTP Range Headers Configuration

- **SetLastModifiedAndEtagHeaders**: Sets LastModified and ETag headers
- **SetContentDispositionHeader**: Configures file download behavior and client delivery rules
- **Preliminary Content-Length**: Set to full file length; overwritten for range requests

```csharp
private static void SetLastModifiedAndEtagHeaders(HttpResponse response, DateTimeOffset? lastModified, EntityTagHeaderValue? etag)
{
    var httpResponseHeaders = response.GetTypedHeaders();
    if (lastModified.HasValue)
    {
        httpResponseHeaders.LastModified = lastModified;
    }
    if (etag != null)
    {
        httpResponseHeaders.ETag = etag;
    }
}

private static void SetContentDispositionHeader(HttpContext httpContext, in FileResultInfo result)
{
    if (!string.IsNullOrEmpty(result.FileDownloadName))
    {
        // From RFC 2183, Sec. 2.3:
        // The sender may want to suggest a filename to be used if the entity is
        // detached and stored in a separate file. If the receiving MUA writes
        // the entity to a file, the suggested filename should be used as a
        // basis for the actual filename, where possible.
        var contentDisposition = new ContentDispositionHeaderValue("attachment");
        contentDisposition.SetHttpFileName(result.FileDownloadName);
        httpContext.Response.Headers.ContentDisposition = contentDisposition.ToString();
    }
}
```

#### Range Processing Pipeline

Activated when `enableRangeProcessing` is enabled:

1. **Http Method & IfRangeValid**: Validates request method (HEAD/GET) and If-Range header against LastModified and EntityTag
2. **SetAcceptRangeHeader**: Sets `Accept-Ranges: bytes` 
3. **Condition Check**: If preconditions pass and IfRange is valid, range processing proceeds
4. **SetRangeHeaders + SetContentLength**: Main range handler, sets appropriate headers and response status (206 or 416) per RFC specifications

```csharp
internal static bool IfRangeValid(
    RequestHeaders httpRequestHeaders,
    DateTimeOffset? lastModified,
    EntityTagHeaderValue? etag,
    ILogger logger)
{
    // 14.27 If-Range
    var ifRange = httpRequestHeaders.IfRange;
    if (ifRange != null)
    {
        // If the validator given in the If-Range header field matches the
        // current validator for the selected representation of the target
        // resource, then the server SHOULD process the Range header field as
        // requested.  If the validator does not match, the server MUST ignore
        // the Range header field.
        if (ifRange.LastModified.HasValue)
        {
            if (lastModified.HasValue && lastModified > ifRange.LastModified)
            {
                Log.IfRangeLastModifiedPreconditionFailed(logger, lastModified, ifRange.LastModified);
                return false;
            }
        }
        else if (etag != null && ifRange.EntityTag != null && !ifRange.EntityTag.Compare(etag, useStrongComparison: true))
        {
            Log.IfRangeETagPreconditionFailed(logger, etag, ifRange.EntityTag);
            return false;
        }
    }

    return true;
}

private static (RangeItemHeaderValue? range, long rangeLength, bool serveBody) SetRangeHeaders(
    HttpContext httpContext,
    RequestHeaders httpRequestHeaders,
    long fileLength,
    ILogger logger)
{
    var response = httpContext.Response;
    var httpResponseHeaders = response.GetTypedHeaders();
    var serveBody = !HttpMethods.IsHead(httpContext.Request.Method);

    // Range may be null for empty range header, invalid ranges, parsing errors, multiple ranges
    // and when the file length is zero.
    var (isRangeRequest, range) = RangeHelper.ParseRange(
        httpContext,
        httpRequestHeaders,
        fileLength,
        logger);

    if (!isRangeRequest)
    {
        return (range: null, rangeLength: 0, serveBody);
    }

    // Requested range is not satisfiable
    if (range == null)
    {
        // 14.16 Content-Range - A server sending a response with status code 416 (Requested range not satisfiable)
        // SHOULD include a Content-Range field with a byte-range-resp-spec of "*". The instance-length specifies
        // the current length of the selected resource.  e.g. */length
        response.StatusCode = StatusCodes.Status416RangeNotSatisfiable;
        httpResponseHeaders.ContentRange = new ContentRangeHeaderValue(fileLength);
        response.ContentLength = 0;

        return (range: null, rangeLength: 0, serveBody: false);
    }

    response.StatusCode = StatusCodes.Status206PartialContent;
    httpResponseHeaders.ContentRange = new ContentRangeHeaderValue(
        range.From!.Value,
        range.To!.Value,
        fileLength);

    // Overwrite the Content-Length header for valid range requests with the range length.
    var rangeLength = SetContentLength(response, range);

    return (range, rangeLength, serveBody);
}

private static long SetContentLength(HttpResponse response, RangeItemHeaderValue range)
{
    var start = range.From!.Value;
    var end = range.To!.Value;
    var length = end - start + 1;
    response.ContentLength = length;
    return length;
}

private static void SetAcceptRangeHeader(HttpResponse response)
{
    response.Headers.AcceptRanges = AcceptRangeHeaderValue;
}
```

### WriteFileAsync for File Streams and Memory Regions

There are two methods responsible for writing the result bytes to the response body’s output stream: one accepts a `Stream`, and the other processes an immutable `ReadOnlyMemory<byte>` value.

The first implementation operates on the `Stream fileStream` object. It uses the asynchronous `StreamCopyOperation.CopyToAsync(...)` method to buffer and copy the file contents. The copy parameters vary depending on whether `RangeItemHeaderValue? range` is present and on the value of the `long rangeLength` argument.

If the range header value is present, the current stream’s position is set to the starting byte offset specified by the `range` item, and `rangeLength` bytes are read. Thus, the copied portion runs from `range.From` through `range.From + rangeLength - 1`. Otherwise, the entire file stream is written to the output, starting with the first byte.

```csharp
// Stream overload — seeks and copies only rangeLength bytes when a range is set
internal static async Task WriteFileAsync(HttpContext context, Stream fileStream, RangeItemHeaderValue? range, long rangeLength)
{
    var outputStream = context.Response.Body;
    using (fileStream)
    {
        if (range == null)
        {
            await StreamCopyOperation.CopyToAsync(fileStream, outputStream, count: null, bufferSize: 64 * 1024, cancel: context.RequestAborted);
        }
        else
        {
            fileStream.Seek(range.From!.Value, SeekOrigin.Begin);
            await StreamCopyOperation.CopyToAsync(fileStream, outputStream, rangeLength, BufferSize, context.RequestAborted);
        }
    }
}
```

The second implementation operates on the `ReadOnlyMemory<byte> buffer` value. It writes directly to the output stream asynchronously without intermediate buffers.

When `RangeItemHeaderValue? range` is present, the method slices the memory region starting at `range.From` for a length of `rangeLength`. Otherwise, it writes the entire buffer to the output stream.

```csharp
// Memory overload — slices the buffer directly instead of seeking a stream
internal static async Task WriteFileAsync(HttpContext context, ReadOnlyMemory<byte> buffer, RangeItemHeaderValue? range, long rangeLength)
{
    var outputStream = context.Response.Body;
    if (range is null)
    {
      await outputStream.WriteAsync(buffer, context.RequestAborted);
    }
    else
    {
      var from = 0;
      var length = 0;

      checked
      {
          // Overflow should throw
          from = (int)range.From!.Value;
          length = (int)rangeLength;
      }

      await outputStream.WriteAsync(buffer.Slice(from, length), context.RequestAborted);
    } 
}
```

### Debugging

Enable Debug log level in the application logger to expose runtime events during range processing.

## Cache Features and Security Drawbacks

Intermediate cache servers might cache partial content ranges and serve in response to other clients.

Clients with poorly implemented range requests are at risk of exposing the system to the denial-of-service attacks because the effort required to request many overlapping ranges of the same data is tiny compared to the time, memory, and bandwidth consumed by attempting to serve the requested data in many parts.

Network security components like Firewalls might limit or event block partial requests. This comes from the fact that transferring a file in multiple pieces prevents security systems from analyzing the entire response contents. Until the document parts are combined on the client in a single file, it is impossible to detect a problem with the content and identify marlawe delivered alongside the file contents. 

## References

- [Hypertext Transfer Protocol (HTTP/1.1): Range Requests](https://datatracker.ietf.org/doc/html/rfc7233)
- [HTTP Range Requests for partial content retrieval](https://http.dev/range-request)
- [Introduction to HTTP Multipart](https://blog.adamchalmers.com/multipart/)
- [Genius article, just leave it here: Static streams for faster async proxies](https://blog.adamchalmers.com/streaming-proxy/)
