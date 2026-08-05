---
title: "How ASP.NET Core Handles Range Requests for File Results?"
description: "Exploring intrinsic implementation of http range request processing in aspnet core via file result type system for minimal api and mvc controllers. Breaking down the internal implementation of RFC 7233 Range Requests in ASP.NET Core."
date: 2026-07-29 00:00:01 +0200
categories: .NET
tags: dotnet aspnet-core file-result result-types file-serving http http-range range-request webapi minimal-api rfc7233
image:
  path: /assets/img/title/file-result-type-class-diagram.svg
  alt: File Result Type Class Diagram
---

<!-- 
Article 2: “How ASP.NET Core Handles Range Requests for File Results”

## Why range requests matter?
## Protocol Semantics
  ### Content Type
  ### Status Codes
  ### Conditional & Range Headers
## FileResultHelper overview
  ### Precondition validation
  ### Header setup
  ### Range processing pipeline
  ### Debugging and observability
-->

Previously in the posts we’ve explored...





ASP.NET Core has evolved over years to become a mature platform for building web applications. File sharing and serving binaries from the backend are among the features implemented by the platform. Following HTTP protocol standards, ASP.NET Core supports HTTP Range Requests for serving large binaries in relatively small chunks.

## HTTP Range Requests Overview

The HTTP protocol implements headers and status codes that enable delivering large file objects over the internet in smaller pieces:

- **Content-Type**: `bytes`
- **Status Codes**: 206 Partial Content, 416 Range Not Satisfiable
- **Headers**: Range, Content-Range, Accept-Ranges, If-Range
- **Conditional Headers**: If-Match, If-None-Match, If-Modified-Since, If-Unmodified-Since

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

- [Hypertext Transfer Protocol (HTTP/1.1): Range Requests](https://datatracker.ietf.org/doc/html/rfc7233)
