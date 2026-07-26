---
title: "Understanding File Result Types in ASP.NET Core"
description: "Exploring intrinsic implementation of serving binary and file result in aspnet core via result type system for minimal api and mvc controllers. Breaking down the internal implementation of RFC 7233 Range Requests in ASP.NET Core."
date: 2026-07-18 00:00:01 +0200
categories: .NET
tags: dotnet aspnet-core file-result result-types file-serving http http-range range-request
image:
  path: /assets/img/title/file-result-type-class-diagram.svg
  alt: ASP.NET Core file result type hierarchy for MVC and Minimal APIs
---

ASP.NET Core has evolved over years to become a mature platform for building web applications. File sharing and serving binaries from the backend are among the features implemented by the platform. Following HTTP protocol standards, ASP.NET Core supports standard HTTP headers defining the kinds of file content and HTTP Range requests for serving large binaries in smaller chunks.

## File Result Types in ASP.NET Core

Since ASP.NET Core 6.0, we are provided with two type systems designed to serve a wide range of response content types in the form of result objects. These distinct hierarchies are built on top of `IActionResult` and `IResult` interface implementations. Both define a contract for an asynchronous method designed to write the result from an MVC action or an HTTP endpoint into the response body.

| Method                                           | Behavior                                                                                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Task ExecuteResultAsync(ActionContext context)` | Executes the asynchronous result operation of the action method with the provided `ActionContext` in which the result is executed. |
| `Task ExecuteAsync(HttpContext httpContext)`     | Writes an HTTP response body reflecting the result of an asynchronous operation back to the `HttpContext` for the current request. |

### Controller API Result Execution

Controller-based MVC actions are built on an abstract `ActionResult` implementation of the `IActionResult` interface. For file processing scenarios, ASP.NET Core provides a derived `Microsoft.AspNetCore.Mvc.FileResult` subclass that adds another abstraction layer. Rather than implementing the asynchronous method directly, it extends the contract with file-specific properties shared across concrete implementations.

| Property                | Description                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContentType`           | Represents the `Content-Type` header for the response, specifying the media type of the file being served.                                                             |
| `FileDownloadName`      | Defines the file name that will be used in the `Content-Disposition` header when triggering a download in the browser.                                                 |
| `EntityTag`             | Specifies the `ETag` associated with the FileResult, which is used to identify and validate the specific version of the resource for caching and conditional requests. |
| `LastModified`          | Specifies the timestamp when the file was last modified, serves HTTP conditional requests and client-side cache validation via `Last-Modified` header.                 |
| `EnableRangeProcessing` | Boolean flag that enables HTTP range request processing for the result, unlocks delivering small byte ranges of large files.                                           |

Derived types combine base class properties with strongly typed file content to properly implement the asynchronous response handler for the given content-type. These classes work like a bridge between binary data representations (file streams, byte arrays, memory spans, file locations) and actual `IActionResultExecutor<T>` handlers.

| Type                 | Behavior                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FileStreamResult`   | Represents a `FileResult` that when executed will write a file from a stream to the response                                                          |
| `FileContentResult`  | Represents a `FileResult` that when executed will write a binary file to the response                                                                 |
| `PhysicalFileResult` | Represents a `FileResult` that when executed will write a file from disk to the response using mechanisms provided by the host                        |
| `VirtualFileResult`  | Represents a `FileResult` that when executed will write the file specified using a virtual path to the response using mechanisms provided by the host |

While implementing result handlers, each class uses a service locator to inject a result-specific executor. Similarly to the result type hierarchy, all executors share a common `FileResultExecutorBase` base class that implements the common logic of processing HTTP headers and writing the response body following HTTP protocol specifications.

Every result executor is designed to parameterize the asynchronous `Task ExecuteAsync(ActionContext context, TResult result)` handler with a dedicated result type and action context arguments. By separating the response data and write behavior in different type hierarchies, developers implement a classic visitor pattern where data and behavior evolve independently while remaining associated with each other in serving the `HttpResponse` to the client.

### Minimal API Result Execution

In contrast, Minimal API endpoints return `IResult` types instantiated via static factory methods in `Microsoft.AspNetCore.Http.HttpResults.TypedResults`. While these factories provide flexibility of building content-type-specific results, none of them inherit from a base class. Instead, each type implements the `IResult` interface directly along with all interfaces required to fulfill the request without injecting a dedicated executor.

| Type                     | Behavior                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `FileStreamHttpResult`   | Represents an `IResult` that when executed will write a file from a stream to the response.                                        |
| `FileContentHttpResult`  | Represents an `IResult` that when executed will write the byte-array content to the response.                                      |
| `PhysicalFileHttpResult` | Represents an `IResult` that writes a file from disk to the response using mechanisms provided by the host.                        |
| `VirtualFileHttpResult`  | Represents an `IResult` that writes the file specified using a virtual path to the response using mechanisms provided by the host. |

The `IResult` interface only defines a contract for the executor function updating the HTTP response from the result instance. The rest of the properties are defined within the dedicated result type or implemented using the supporting interfaces.

For instance, the `IFileHttpResult` interface, implemented in each of the mentioned file types, specifies `string? ContentType` and `string? FileDownloadName` type members. The `ContentType` property represents the Content-Type header for the response, reflecting the data format of the file contents. The `FileDownloadName` property represents the file name that will be used in the Content-Disposition header of the response upon file download.

Not all of the result properties come from a strongly typed contracts. Some of them are unscoped to any of http interface but identical to all these classes. Each of them take part in defining the amount of data and http headers in response, initialization of which come from constructurs and only expose public getters tight to the provided result type.

| Property                | Type                    | Description                                                                                                                                                        |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LastModified`          | `DateTimeOffset?`       | Gets the last modified information associated with the file result. Translated to the `Last-Modified` HTTP header for cache validation.                            |
| `EntityTag`             | `EntityTagHeaderValue?` | Gets the etag associated with the file result. Translated to the `ETag` HTTP header for resource versioning and conditional requests.                              |
| `EnableRangeProcessing` | `bool`                  | Gets the value that enables range processing for the file result. When enabled, sets the `Accept-Ranges: bytes` header and allows `206 Partial Content` responses. |
| `FileLength`            | `long?`                 | Gets or sets the file length information. Translated to the `Content-Length` HTTP header; adjusted for range requests per RFC 7233.                                |

As every result serves the content from the different source type, one more type-scoped property is important to implement. Classes implement value properties holding the output data they designed to serve.

| Property       | Data Type              | Description                                                                     | Source Type                                       |
| -------------- | ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| `FileStream`   | `Stream`               | Serves a file stream that will be sent back as the response.                    | `FileStreamHttpResult`                            |
| `FileContents` | `ReadOnlyMemory<byte>` | Serves a binary array or memory region that will be sent back as the response.  | `FileContentHttpResult`                           |
| `FileName`     | `string`               | Serves a file stream from the file path that will be sent back as the response. | `PhysicalFileHttpResult`, `VirtualFileHttpResult` |

What is common among MVC and Minimal result types is that all of them rely on the same static `FileResultHelper`, which handles the details of HTTP range request processing. This unified implementation ensures consistent behavior across both MVC and Minimal API paradigms, abstracting away the complexity of RFC 7233 compliance and header management into a single, well-tested component.

## Range Response Processing by FileResultHelper

Both legacy MVC and modern Results APIs share an internal implementation in `FileResultHelper` for file serving purposes. This type holds a complete implementation of the HTTP Range processing and follows RFC 7233 specification. It has everything needed to serve a partial file response like writing the response headers and the response body writer logic to the client.

### SetHeadersAndLog

The primary orchestration method that manages headers and response content according to RFC specifications. Returns a tuple:

```csharp
(RangeItemHeaderValue? range, long rangeLength, bool serveBody)
```

**Note**: An empty `range` value means the binary is processed as a single entity without chunking.

### Precondition Validation

- **GetPreconditionState + GetMaxPreconditionState**: Validates data freshness using If-Match, If-None-Match, If-Modified-Since, and If-Unmodified-Since headers

### Header Configuration

- **SetLastModifiedAndEtagHeaders**: Sets LastModified and ETag headers
- **SetContentDispositionHeader**: Configures file download behavior and client delivery rules
- **Preliminary Content-Length**: Set to full file length; overwritten for range requests

### Range Processing Pipeline

Activated when `enableRangeProcessing` is enabled:

1. **Http Method & IfRangeValid**: Validates request method (HEAD/GET) and If-Range header against LastModified and EntityTag
2. **SetAcceptRangeHeader**: Sets `Accept-Ranges: bytes` 
3. **Condition Check**: If preconditions pass and IfRange is valid, range processing proceeds
4. **SetRangeHeaders + SetContentLength**: Main range handler, sets appropriate headers and response status (206 or 416) per RFC specifications

### Debugging

Enable Debug log level in the application logger to expose runtime events during range processing.

## References

- [Hypertext Transfer Protocol (HTTP/1.1): Range Requests](https://datatracker.ietf.org/doc/html/rfc7233)
- [Microsoft - Results.File API](https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.http.results.file)
- [Microsoft - FileResult Class](https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.mvc.fileresult)
- [ASP.NET Core - FileResultHelper Source](https://github.com/dotnet/aspnetcore/blob/main/src/Shared/ResultsHelpers/FileResultHelper.cs)
- [Difference between FileContentResult and FileStreamResult](https://stackoverflow.com/questions/34498184/difference-between-filecontentresult-and-filestreamresult)
- [ASP.NET MVC File Results Comparison](https://stackoverflow.com/questions/1187261/whats-the-difference-between-the-four-file-results-in-asp-net-mvc)
