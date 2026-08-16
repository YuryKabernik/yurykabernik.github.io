---
title: "How ASP.NET Core Handles Range Requests for File Results?"
description: "Exploring how ASP.NET Core handles HTTP range requests for file results, with a practical overview of why range requests matter, protocol semantics, conditional headers, and the FileResultHelper pipeline from freshness validation and header setup to chunked responses, range processing, and debugging."
date: 2026-07-29 00:00:01 +0200
categories: .NET
tags: dotnet aspnet-core file-result result-types file-serving http http-range range-request webapi minimal-api rfc7233 file-result-helper
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
  ### Freshness validation
  ### Header setup
  ### Range processing pipeline
  ### Debugging and observability
-->

Previously, in the post about the Results type system of ASP.NET Core, we’ve explored the abstract layer and the type system of the file data processing. This time we will explore the specifics of the HTTP Range Requests implementation and the rules for constructing responses to those requests.

## Why range requests matter?

There are multiple reasons for this functionality to extend rich HTTP specification. Among primary reasons are interrupted and pause/resume data transfers, performance optimisatoins with Multi-part or Single-part data transfer between client and server systems, and addressing throughtput limitations in network systems on the amount of data allowed to pass through. 

### Interrupted Data Transfer

As the RFC7233 document explains, the main purpose of this feature is to handle sudden failures or interruptions in data transfers. Range requests are intended to provide a convenient mechanism for resuming the transfer of the remaining or missing parts of a large resource. It is suggested to resume content delivery starting from the missing part rather than requesting the entire resource once again.

Such behaviour is useful for systems implementing content delivery networks, document management systems and processing of binary large objects of custom content types on the client. The most obvious kinds of the large resourse are a static content, images or any complex server-generated binary data.

The approach does not quite fit for handeling relatively small binaries. The overhead of implementing the protocol on both client and server might overcomplicate a simple resend of the full content on failure. Consider implementing it when the amount of data is reasonable large in every round trip and resilience of your system is a requirement.

### Client Performance Optimizations

Another use case suggested by the paper describes an necessity...  

2. Multi-part or Single-part data transfer between client and server systems. Insufficient runtime memory on the client side. Not all content is necessary at a time.

### Intermediet Network Limitations

3. Throughtput limitations from cloud service providers on the amount of transfered data allowed.

### Cache Features and Security Drawbacks

Intermediate cache servers might cache partial content ranges and serve in response to other clients.

Clients with poorly implemented range requests are at risk of exposing the system to the denial-of-service attacks because the effort required to request many overlapping ranges of the same data is tiny compared to the time, memory, and bandwidth consumed by attempting to serve the requested data in many parts.

Network security components like Firewalls might limit or event block partial requests. This comes from the fact that transfering a file in multiple pieces prevents security systems from to analyzing the entire response contents. Until the document parts are combined on the client in a single file, it is imposible to detect a problem with the content and identify marlawe delivered alongside the file contents. 

## HTTP Range Request Overview

The HTTP protocol implements headers and status codes that enable delivering large file objects over the internet in smaller pieces:

- **Content-Type**: `bytes`
- **Status Codes**: 206 Partial Content, 416 Range Not Satisfiable
- **Headers**: Range, Content-Range, Accept-Ranges, If-Range
- **Conditional Headers**: If-Match, If-None-Match, If-Modified-Since, If-Unmodified-Since

## Range Response Processing in FileResultHelper

ASP.NET Core has evolved over years to become a mature platform for building web applications. File sharing and serving binaries from the backend are among the features implemented by the platform. Following HTTP protocol standards, ASP.NET Core supports HTTP Range Requests for serving large binaries in relatively small chunks.

As we previously explored the result type hierarhy for serving file data, both legacy MVC Action Result and modern Results APIs share the internal file processing implementation in the static `FileResultHelper` class.

### SetHeadersAndLog

The primary orchestration method that manages headers and response content according to RFC specifications. Returns a tuple:

```csharp
(RangeItemHeaderValue? range, long rangeLength, bool serveBody)
```

**Note**: An empty `range` value means the binary is processed as a single entity without chunking.

### Freshness Validation

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
