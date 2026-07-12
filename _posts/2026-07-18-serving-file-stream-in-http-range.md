---
title: "Serving File Streams in HTTP Range Requests"
description: "How to clean Startup in ASP.NET Core using the Options pattern for a more testable and maintainable CORS policy setup."
date: 2026-07-18 00:00:01 +0200
author: Yury Kabernik-Berazouski
categories: .NET
tags: dotnet aspnet-core file-result file-serving http http-range range-request
---

Since the existence of the Internet, file sharing has been a major feature of network systems. The same capabilities and limitations persist today when transferring large amounts of data across the network.

ASP.NET Core has evolved over years to become a mature platform for building web applications. File sharing and serving binaries from the backend are among the features implemented by the framework. Following international HTTP protocol standards, ASP.NET Core supports Range requests for serving binaries as relatively small ranges of a single file.

## HTTP Range Requests Overview

The HTTP protocol implements headers and status codes that enable delivering large file objects over the internet in smaller pieces:

- **Content-Type**: `bytes`
- **Status Codes**: 206 Partial Content, 416 Range Not Satisfiable
- **Headers**: Range, Content-Range, Accept-Ranges, If-Range
- **Conditional Headers**: If-Match, If-None-Match, If-Modified-Since, If-Unmodified-Since

## File Processing in ASP.NET Core

Since ASP.NET Core 6.0, we are provided with two separate type systems designed to serve nearly identical set of web results. These distinct hierarchies are built on top of `IActionResult` and `IResult` interface implementations.

Action results were created to ease migrating Windows oriented ASP.NET Framework web applications to a new cross-platform ASP.NET Core web framework. The idea was to preserve a well-known MVC pattern in the form of WebApi Controllers with an extended set of method helpers serving different content types. running action result executors `IActionResultExecutor<T>` for each kind of the result type extending an abstract `ActionResult` class of the `IActionResult` interface.

| Overload | Behavior |
|----------|----------|
| `File(byte[], string, string, bool, DateTimeOffset?, EntityTagHeaderValue)` | Writes byte array content to response. Supports range requests (206 or 416 status codes). Alias for `Bytes()`. |
| `File(Stream, string, string, DateTimeOffset?, EntityTagHeaderValue, bool)` | Writes Stream to response. Supports range requests (206 or 416 status codes). Alias for `Stream()`. |
| `File(string, string, string, DateTimeOffset?, EntityTagHeaderValue, bool)` | Writes file from specified path to response. Supports range requests (206 or 416 status codes). |

## FileResultHelper Range Processing

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
