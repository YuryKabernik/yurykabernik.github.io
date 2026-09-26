---
title: "How ASP.NET Core Handles Range Requests for File Results?"
description: "Exploring how ASP.NET Core handles HTTP range requests for file results, with a practical overview of why range requests matter, protocol semantics, conditional headers, and the FileResultHelper pipeline from freshness validation and header setup to chunked responses, range processing, and debugging."
date: 2026-08-21 00:00:01 +0200
categories: .NET
tags: dotnet aspnet-core file-result result-types file-serving http http-range range-request rfc7233 file-result-helper multipart byte-ranges
image:
  path: /assets/img/title/http-range-request-response-pair.png
  alt: File Result Type Class Diagram
mermaid: true
---

<!-- 
Article 2: “How ASP.NET Core Handles Range Requests for File Results”

## Why range requests matter?
## Protocol Semantics
  ### Content Type
  ### Status Codes
  ### Conditional & Range Headers
## FileResultHelper overview
  ### Freshness validation
  ### Header setup
  ### Range processing pipeline
  ### Debugging and observability
-->

Previously, in the post about the Results type system of ASP.NET Core, we’ve explored the abstract layer and the type system of the file data processing. This time we will explore the specifics of the HTTP Range Requests implementation and the rules for constructing responses to those requests.

## Why range requests matter?

There are multiple reasons for this functionality to extend rich HTTP specification. Among primary reasons are interrupted and pause/resume data transfers, performance optimisations with Multi-part or Single-part data transfer between client and server systems, and addressing throughput limitations in network systems on the amount of data allowed to pass through. 

### Interrupted Data Transfer

As the RFC7233 document explains, the main purpose of this feature is to handle sudden failures or interruptions in data transfers. Range requests are intended to provide a convenient mechanism for resuming the transfer of the remaining or missing parts of a large resource. It is suggested to resume content delivery starting from the missing part rather than requesting the entire resource once again.

<!-- 
Typical scenarios leading to an interrupted transfer include:

- A mobile client switching between Wi-Fi and cellular networks mid-download, dropping the underlying TCP connection
- A flaky or long-distance link, such as a satellite or rural broadband connection, timing out on a large file
- A user closing a laptop lid or losing power before a download manager finishes writing to disk
- A reverse proxy or load balancer enforcing an idle/read timeout shorter than the time needed to stream the full resource
- A backend process restarting mid-response during a deployment or crash, cutting the connection before the last bytes are sent -->

![Typical interrupted transfer scenarios](/assets/img/posts/http-range-request/typical-interrupted-transfer-scenarios.svg)

Such behaviour is useful for systems implementing content delivery networks, document management systems and artifactories processing large binaries of custom types of content. The most obvious kinds of the large resource are executable binaries, high-quality images or runtime-generated binary data.

The approach does not quite fit for handling relatively small binaries. The overhead of implementing the protocol on both client and server might overcomplicate a simple resend of the full content on failure. Consider implementing it when the amount of data is reasonable large in every round trip and resilience of your system is a requirement.

### Performance Optimizations

Another use case suggested by the paper is inability of the client device to process excessive data all at once. Memory reduction, CPU constrains or low-latency requirements are examples of triggers pushing to adapt range requests into the solution design.

<!--
Typical scenarios benefiting from range-based optimizations include:

- A video player fetching only the next few seconds of a large video file instead of buffering it entirely
- A PDF or e-book viewer downloading just the pages currently in view rather than the whole document
- A software updater applying binary diffs by pulling only the changed byte ranges of an installer package
- An image gallery requesting low-resolution previews first, then the remaining bytes for the full-resolution image on demand
- An embedded or IoT device with tight memory constraints processing a firmware image in small chunks instead of loading it fully into RAM -->

![Typical Optimization Scenarios](/assets/img/posts/http-range-request/typical-optimization-scenario.svg)

The Range requests standard is designed with the ability to support both single-part and multi-part response body. There is a special `multipart/byteranges` media type allowing to put multiple ranges in a single response body separated by a boundary parameter. The advantage here is that the server can stream each part separately and the client can process each part one at a time as new content arrives.

Within the same response and without buffering the entire file application can benefit from reduced memory consumption and lowered latency by processing small binary chunks earlier. The same effect could be achieved without keeping the connection alive via a sequence of single-part ranges. Processing in single range parts allows to simplify client behaviour and complete partial processing asynchronously.

Over passing of times it might seem like modern portable devices are not limited in resources, but it is true until you are developing a business-specific tool working in extreme conditions with restricted resources.

## HTTP Protocol Semantics

The HTTP protocol implements headers, status codes, media and content types defining HTTP level contract for range requests. It serves the purpose of delivering large binaries over the internet in relatively smaller pieces as single- and multi-part response body.

### Range Units

First of all, client and server need to collaborate over the type and size of the transferred data. This is archived by abstracting it to a sequence of octets, or simply saying a continuous byte range. For this purpose the `bytes` range unit is proposed for expressing sub-ranges of the data's sequence.

The `bytes` range unit is selected to abstract data at transit from the actual media type of the resource at rest. Such abstraction allows to transfer and negotiate about any range uniformly without relying on its internal structure. Anyway, RFC7233 does not limit users to the suggested unit type. The resource could be partitioned into any custom range type suitable for processing and transferring a data structure by the system.

Once the decision over the "range unit" is secured, it is used to advertise support for range requests, delineate the parts of a resource that are requested, and to describe which part of a representation is being transferred.

### Headers

The `Accept-Ranges` request header allows an origin server to indicate two things: acceptability of range requests and the unit type of the sub-range for the target resource. It helps the client to understand whether data chunking is worth to request and how to concatenate the resource from sub-ranges. While the engineering community suggests sending `HEAD` request to read `Accept-Ranges` contents, RFC7233 assumes that client may start generating requests beforehand receiving this header field.

```text
// `byte` or a custom unit to advise a sub-range type
Accept-Ranges: byte
Accept-Ranges: <range-unit>

// `none` to advise not to attempt a range request
Accept-Ranges: none
```

The `Range` request header serves to modify `GET` method semantics into transferring one or more sub-ranges rather than the entire representation. A client submits the header field with a byte ranges specifier as an inclusive `byte-offset` of the first and the last byte within full content length.

```text
Range: bytes=<first-byte-pos> - <last-byte-pos>

Range: bytes=0-500          // first single sub-range
Range: bytes=501-999        // next single sub-range

Range: bytes=0-500,501-999  // multiple consequent ranges (valid, but not canonical)

// shortcut: final 500 bytes (byte offsets 500-999, inclusive)
Range: bytes=-500 OR Range: bytes=500-

// invalid range (file content length - 1000)
Range: bytes=1000-1500      // start position beyond the full length
```

The `If-Range` request header is an optional conditional header. It serves as a precondition to apply the Range header field. The value can be either the Last-Modified validator or ETag, but not both. It indicates that the requested parts in Range are relevant for the client only if the resource has not been changed since the last session. Alternatively, server returns the entire representation when the resource has been modified.

```text
If-Range: <entity-tag / HTTP-date>

If-Range: Wed, 02 Sep 2026 22:30:00 GMT  // Last-Modified validator
If-Range: "87ab56"                       // ETag
```

The `Content-Range` response header indicates the range being enclosed in the response, alongside the unit type and the full size. For single-part requests, it normally describes what range is enclosed in the payload. For multi-part scenarios, it will be present in each byte-range transferred in the payload.

```text
Content-Range: <unit> <range>/<size>

// When satisfied range requests
Content-Range: bytes 0-500/1000          // first sub-range
Content-Range: bytes 501-999/1000        // next sub-range

// When cannot satisfy, '*' value indicates not a range
Content-Range: bytes */1000

// When the complete length is unknown
Content-Range: bytes 501-999/*
```

### Status Codes

The `206` (Partial Content) status code indicates successful completion of the range request. The response contains one or more parts of the requested resource. Corresponds to the satisfied ranges collected from request header fiels described earlier. HTTP headers provide metadata describing `Content-Length`, `Content-Type` and `Content-Range` of the result data contained in the response payload.

```http
HTTP/1.1 206 Partial Content
Date: Wed, 02 Sep 2026 22:30:00 GMT
Last-Modified: Wed, 02 Sep 2026 22:30:00 GMT
Content-Range: bytes 501-999/1000
Content-Length: 499
Content-Type: image/jpeg

... 499 bytes of partial image data ...
```

The `416` (Range Not Satisfiable) status code indicates the request rejection due to invalid or an excessive request ranges. In response, server should add a `Content-Range` header specifying the full content length of the target representation.

```http
HTTP/1.1 416 Range Not Satisfiable
Date: Wed, 02 Sep 2026 22:30:00 GMT
Content-Range: bytes */1000              // indicates the current length of the resource 
```

Values from the `Range` header are considered invalid when the first byte greater than the full length or range boundaries do not meet `Range` header patterns. Since the client can request streaming several ranges at once, multiple small or overlapping ranges could be considered as a DDOS attack and rejected by the server.

### Content Type

The range unit itself does not tell the client what type of content is transferred. As mentioned previously, the unit type is intended to abstract chunking from the actual content type of the resource. To recreate the binary object, the client needs to know the representation's actual type.

In a single-part range delivery, the resource type is expressed by the media type value provided in the `Content-Type` header field. This allows the client to use the proper strategy to combine the received binary streams into the resource over multiple round trips.

```http
HTTP/1.1 206 Partial Content
Date: Wed, 02 Sep 2026 22:30:00 GMT
Last-Modified: Wed, 02 Sep 2026 22:30:00 GMT
Content-Range: bytes 501-999/1000
Content-Length: 499                      // the length of the response body
Content-Type: image/jpeg                 // the representation's content type

... 499 bytes of partial image data ...
```

When a multipart range delivery takes place, a special `multipart/byteranges` media type is used in the `Content-Type` header field, along with the required boundary parameter. Thus, the `multipart/*` response type contract is leveraged to transfer several parts at once, reducing the number of round trips and clearly separating the range boundaries.

```http
HTTP/1.1 206 Partial Content
Date: Wed, 02 Sep 2026 22:30:00 GMT
Last-Modified: Wed, 15 Nov 1995 04:58:08 GMT
Content-Length: 700
Content-Type: multipart/byteranges; boundary=ANY_UNIQUE_STRING_SEPARATOR

--ANY_UNIQUE_STRING_SEPARATOR
Content-Type: image/jpeg                 // the content type is the same
Content-Range: bytes 200-499/1000        // the range is different

...the first range...
--ANY_UNIQUE_STRING_SEPARATOR
Content-Type: image/jpeg                 // the content type is the same
Content-Range: bytes 500-799/1000        // the range is different

...the second range...
--ANY_UNIQUE_STRING_SEPARATOR--
```

## FileResultHelper Implementation Overview

Following HTTP protocol rules and semantics, ASP.NET Core implements support for HTTP range requests in the static `FileResultHelper` class. Both legacy MVC action results and modern Result Type models share this internal file-processing implementation. There are two public implementations `SetHeadersAndLog` and `WriteFileAsync` covering the entire file delivery flow from analyzing request preconditional headers to writing the response body. 

### Response pre-processing in SetHeadersAndLog

Despite its unawkward name, `SetHeadersAndLog` is the primary orchestration method that manages HTTP headers and response content according to RFC specifications. Returns a tuple:

```csharp
internal static (RangeItemHeaderValue? range, long rangeLength, bool serveBody) SetHeadersAndLog(
    HttpContext httpContext,
    in FileResultInfo result,
    long? fileLength,
    bool enableRangeProcessing,
    DateTimeOffset? lastModified,
    EntityTagHeaderValue? etag,
    ILogger logger)
{
    var request = httpContext.Request;
    var httpRequestHeaders = request.GetTypedHeaders();

    // Since the 'Last-Modified' and other similar http date headers are rounded down to whole seconds,
    // round down current file's last modified to whole seconds for correct comparison.
    if (lastModified.HasValue)
    {
        lastModified = RoundDownToWholeSeconds(lastModified.Value);
    }

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

### Freshness Validation

- **GetPreconditionState + GetMaxPreconditionState**: Validates data freshness using If-Match, If-None-Match, If-Modified-Since, and If-Unmodified-Since headers

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

    var state = GetMaxPreconditionState(ifMatchState, ifNoneMatchState, ifModifiedSinceState, ifUnmodifiedSinceState);
    return state;
}

private static PreconditionState GetEtagMatchState(
    bool useStrongComparison,
    IList<EntityTagHeaderValue> etagHeader,
    EntityTagHeaderValue etag,
    PreconditionState matchFoundState,
    PreconditionState matchNotFoundState)
{
    if (etagHeader?.Count > 0)
    {
        var state = matchNotFoundState;
        foreach (var entityTag in etagHeader)
        {
            if (entityTag.Equals(EntityTagHeaderValue.Any) || entityTag.Compare(etag, useStrongComparison))
            {
                state = matchFoundState;
                break;
            }
        }

        return state;
    }

    return PreconditionState.Unspecified;
}

private static PreconditionState GetMaxPreconditionState(params PreconditionState[] states)
{
    var max = PreconditionState.Unspecified;
    for (var i = 0; i < states.Length; i++)
    {
        if (states[i] > max)
        {
            max = states[i];
        }
    }

    return max;
}
```


### Header Configuration

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

### Range Processing Pipeline

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
- 
