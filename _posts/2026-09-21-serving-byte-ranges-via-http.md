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

Within the same response and without buffering the entire file application can benefit from reduced memory consumption and lowered latency by processing small binary chunks earlier. The same effect could be achived without keeping the conneciton alive via a sequence of single-part ranges. Processing in single range parts allows to simplify client behaviour and complete partial processings asynchronously.

Over passing of times it might seem like modern portable devices are not limited in resources, but it is true until you are developing a business-specific tool working in extreme conditions with restricted resources.

## HTTP Protocol Semantics

The HTTP protocol implements headers, status codes, media and content types defining HTTP level contract for range requests. It serves the purpose of delivering large binaries over the internet in relatively smaller pieces as single- and multi-part response body.

### Range Units

First of all, client and server need to collaborate over the type and size of the transferred data. This is archived by abstracting it to a sequence of octets, or simply saying a continuous byte range. For this purpose the `bytes` range unit is proposed for expressing sub-ranges of the data's sequence.

The `bytes` range unit is selected to abstract data at transit from the actual media type of the resource at rest. Such abstraction allows to transfer and negotiate about any range uniformly without relying on its internal structure. Anyway, RFC7233 does not limit users to the suggested unit type. The resource could be partitioned into any custom range type suitable for processing and transferring a data structure by the system.

Once the decision over the "range unit" is secured, it is used to advertise support for range requests, delineate the parts of a resource that are requested, and to describe which part of a representation is being transferred.

### Headers

The `Accept-Ranges` request header allows an origin server to indicate two things: acceptability of range requests and the unit type of the sub-range for the target resource. It helps the client to understand whether data chunking is worth to request and how to concatinate the resource from sub-ranges. While the engineering community suggests sending `HEAD` request to read `Accept-Ranges` contents, RFC7233 assumes that client may start generating requests beforehand receiving this header field.

```text
// `byte` or a custom unit to advise a type of sub-range
Accept-Ranges: byte
Accept-Ranges: <range-unit>

// `none` to advise not to attempt a range request
Accept-Ranges: none
```

The `Range` request header serves to modify `GET` method semantics into transferring one or more sub-ranges rather than the entire representation. A client submits the header field with a byte ranges specifier as an inclusive `byte-offset` of the first and the last byte within full content length.

```text
// common syntax
Range: bytes=<first-byte-pos> - <last-byte-pos>

Range: bytes=0-999          // single sub-range
Range: bytes=0-500,501-999  // two consequent ranges (valid, but not canonical)

// final 500 bytes (byte offsets 500-999, inclusive)
Range: bytes=-500 OR Range: bytes=500-

// invalid range (content length 1000)
Range: bytes=1000-1500      // start position beyond the resource length
```

The `If-Range` request header is an optional conditional header. It serves as a precondition to apply the Range header field. The value can be either the Last-Modified validator or ETag, but not both. It indicates that the requested parts in Range are relevant for the client only if the resource has not been changed since the last session. Alternatively, server returns the entire representation when the resource has been modified.

```text
// expected tag or date
If-Range: <entity-tag / HTTP-date>

If-Range: Wed, 02 Sep 2026 22:30:00 GMT  // Last-Modified validator
If-Range: "87ab56"                       // ETag
```

- **Headers**: Content-Range
- **Conditional Headers**: If-Match, If-None-Match, If-Modified-Since, If-Unmodified-Since

### Status Codes

- **Status Codes**: 206 Partial Content, 416 Range Not Satisfiable

### Content Type

In single-part delivery scenario, the content type of the resource is expressed in the media type provided in the `Content-Type` header. 

## FileResultHelper overview

ASP.NET Core has evolved over years to become a mature platform for building web applications. File sharing and serving binaries from the backend are among the features implemented by the platform. Following HTTP protocol standards, ASP.NET Core supports HTTP Range Requests for serving large binaries in relatively small chunks.

As we previously explored the result type hierarchy for serving file data, both legacy MVC Action Result and modern Results APIs share the internal file processing implementation in the static `FileResultHelper` class.

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
