---
title: "Chunking Large Content in HTTP Range Response"
description: "exploring intrinsic implementation of http range request processing in aspnet core via result type system for minimal api and mvc controllers"
date: 2026-07-18 00:00:01 +0200
author: Yury Kabernik-Berazouski
categories: .NET
tags: dotnet aspnet-core file-result result-types file-serving http http-range range-request
---

ASP.NET Core has evolved over years to become a mature platform for building web applications. File sharing and serving binaries from the backend are among the features implemented by the platform. Following HTTP protocol standards, ASP.NET Core supports HTTP Range requests for serving large binaries in relatively small chunks.

## HTTP Range Requests Overview

The HTTP protocol implements headers and status codes that enable delivering large file objects over the internet in smaller pieces:

- **Content-Type**: `bytes`
- **Status Codes**: 206 Partial Content, 416 Range Not Satisfiable
- **Headers**: Range, Content-Range, Accept-Ranges, If-Range
- **Conditional Headers**: If-Match, If-None-Match, If-Modified-Since, If-Unmodified-Since

## File Typed Result in ASP.NET Core

Since ASP.NET Core 6.0, we are provided with two type systems designed to serve wide range of response content types in a form of result objects. These distinct hierarchies are built on top of `IActionResult` and `IResult` interface implementations. Both defining a contract for an asynchronous method writing the result from an MVC action or an HTTP endpoint into a valid HTTP response.

| Method | Behavior |
|----------|----------|
| `Task ExecuteResultAsync(ActionContext context)` | Executes the asynchronous result operation of the action method with the provided `ActionContext` in which the result is executed including the original request details. |
| `Task ExecuteAsync(HttpContext httpContext)` | Writes an HTTP response reflecting the result of a task that represents the asynchronous execute operation back to the `HttpContext` for the current request. |

Controller-based MVC actions are based on an abstract `ActionResult` implementation of the `IActionResult` interface. For the file processing purpose we are provided with an abstract derived `Microsoft.AspNetCore.Mvc.FileResult` an action result that when executed will write a file to the response body.

It does not implement the asynchronous method yet, but extends its parent class with properties required to process a complete or partial file content. Among the shared properties are the content type, file download name, last modified time offset, entity tag, and boolean flag `EnableRangeProcessing` that enables range processing.

More specific non-abstract types combine base class properties with the output data to properly implement the asynchronous response handler for the given type of content. These classes work like a bridge between binary data representations (file streams, byte arrays, memory spans, file locations) and actual `IActionResultExecutor<T>` handlers.

You might find such deep inheritance hierarchy pretty overcomplicated, especially knowing that this is all needed to proxy context and result type through another inheritence chain to finally pass them to the static `FileResultHelper` class. Methods from this type are doing the actual job of setting http headers for file procesing and writing bytes to the output stream body.

| Type | Behavior |
|----------|----------|
| `FileStreamResult` | Represents a `FileResult` that when executed will write a file from a stream to the response. Supports range requests (206 and 416 status codes) |
| `FileContentResult` | Represents a `FileResult` that when executed will write a binary file to the response. Supports range requests (206 and 416 status codes) |
| `PhysicalFileResult` | Represents a `FileResult` that when executed will write a file from disk to the response using mechanisms provided by the host. Supports range requests (206 and 416 status codes) |
| `VirtualFileResult` | Represents a `FileResult` that when executed will write the file specified using a virtual path to the response using mechanisms provided by the host. Supports range requests (206 and 416 status codes) |

On the other hand, Minimal API endpoints expect to return `IResult` types instantiated via a static `Microsoft.AspNetCore.Http.HttpResults.TypedResults` factory methods. These factories allow to build results for specific content types same as the action result system, but this time none of them has a base class to inherit from. Each type does not even have a dedicated executor to inject, instead every http result implements `IResult` interface directly along with the interfaces defining properties required to fulfill the request.

| Type | Behavior |
|----------|----------|
| `FileStreamHttpResult` | Represents an `IResult` that when executed will write a file from a stream to the response. |
| `FileContentHttpResult` | Represents an `IResult` that when executed will the byte-array content to the response. |
| `PhysicalFileHttpResult` | A `PhysicalFileHttpResult` on execution will write a file from disk to the response using mechanisms provided by the host. |
| `VirtualFileHttpResult` | A `IResult` that on execution writes the file specified using a virtual path to the response using mechanisms provided by the host. |

What's important about these types, is that all of them rely on a shared static `FileResultHelper`...

One more thing to mention is the fact that all these factories operate over the result type by calling the same common static helper called `FileResultHelper`. Next we will discover a complete implementation of the HTTP Range processing following RFC specification. Everything that needs to be done to serve partial response: from writing the response HTTP headers to the response writer logic to the client.

## Range Response Processing by FileResultHelper

Both legacy MVC and modern Results APIs share an internal implementation in `FileResultHelper.cs`. The base controller's `File` method and its Result type subclasses handle file processing.

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

- [Microsoft - Results.File API](https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.http.results.file)
- [Microsoft - FileResult Class](https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.mvc.fileresult)
- [ASP.NET Core - FileResultHelper Source](https://github.com/dotnet/aspnetcore/blob/main/src/Shared/ResultsHelpers/FileResultHelper.cs)
- [Difference between FileContentResult and FileStreamResult](https://stackoverflow.com/questions/34498184/difference-between-filecontentresult-and-filestreamresult)
- [ASP.NET MVC File Results Comparison](https://stackoverflow.com/questions/1187261/whats-the-difference-between-the-four-file-results-in-asp-net-mvc)
