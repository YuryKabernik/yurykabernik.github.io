---
title: "HTTP Range Requests: Why They Matter and How They Work"
description: "An introduction to HTTP range request semantics: why range requests matter for resuming downloads from interrupted transfers. Basic range units, primary request and response headers, status codes, and multipart byte ranges."
date: 2026-09-25 00:00:01 +0200
categories: .NET
tags: http http-range range-request rfc7233 multipart byte-ranges file-serving aspnet-core
image:
  path: /assets/img/title/http-range-request-response-pair.png
  alt: HTTP range request and response pair
---

Previously, in the post about the [Results type system of ASP.NET Core]({% post_url 2026-07-29-file-result-type-system %}), we’ve explored the abstract layer and the type system of the file data processing. This part explains why range requests are useful and how the HTTP protocol describes them. 

<!-- The follow-up post, [How ASP.NET Core Handles Range Requests for File Results](./2026-10-21-serving-byte-ranges-via-http.md), connects these rules to the framework implementation. -->

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

The approach does not quite fit for handling relatively small binaries. The overhead of implementing the protocol on both client and server might overcomplicate a simple resend of the full content on failure. Consider implementing it when the amount of data is reasonably large in every round trip and resilience of your system is a requirement.

### Performance Optimizations

Another use case suggested by the paper is inability of the client device to process excessive data all at once. Memory reduction, CPU constraints or low-latency requirements are examples of triggers pushing to adapt range requests into the solution design.

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

First of all, client and server need to collaborate over the type and size of the transferred data. This is achieved by abstracting it to a sequence of octets, or simply saying a continuous byte range. For this purpose the `bytes` range unit is proposed for expressing sub-ranges of the data's sequence.

The `bytes` range unit is selected to abstract data at transit from the actual media type of the resource at rest. Such abstraction allows to transfer and negotiate about any range uniformly without relying on its internal structure. Anyway, RFC7233 does not limit users to the suggested unit type. The resource could be partitioned into any custom range type suitable for processing and transferring a data structure by the system.

Once the decision over the "range unit" is secured, it is used to advertise support for range requests, delineate the parts of a resource that are requested, and to describe which part of a representation is being transferred.

### Headers

The `Accept-Ranges` response header allows an origin server to indicate whether it accepts range requests and which unit type it supports for sub-ranges. It helps the client to understand whether data chunking is worth requesting and how to concatenate the resource from sub-ranges. While the engineering community suggests sending a `HEAD` request to read `Accept-Ranges`, RFC7233 allows a client to start generating requests before receiving this header field.

```text
// `bytes` or a custom unit to advise a sub-range type
Accept-Ranges: bytes
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

// shortcut: final 300 bytes (byte offsets 700-999, inclusive)
Range: bytes=-300
Range: bytes=700-

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

The `206` (Partial Content) status code indicates successful completion of the range request. The response contains one or more parts of the requested resource. It corresponds to the satisfiable ranges collected from the request header fields described earlier. HTTP headers provide metadata describing `Content-Length`, `Content-Type` and `Content-Range` of the result data contained in the response payload.

```http
HTTP/1.1 206 Partial Content
Date: Wed, 02 Sep 2026 22:30:00 GMT
Last-Modified: Wed, 02 Sep 2026 22:30:00 GMT
Content-Range: bytes 501-999/1000
Content-Length: 499
Content-Type: image/jpeg

... 499 bytes of partial image data ...
```

The `416` (Range Not Satisfiable) status code indicates that none of the syntactically valid requested ranges are satisfiable. In response, the server should add a `Content-Range` header specifying the full content length of the target representation. A syntactically invalid `Range` header is generally ignored, allowing the server to return the complete representation instead.

```http
HTTP/1.1 416 Range Not Satisfiable
Date: Wed, 02 Sep 2026 22:30:00 GMT
Content-Range: bytes */1000              // indicates the current length of the resource 
```

Values from the `Range` header are considered unsatisfiable when the first byte is equal to or greater than the full length, or when range boundaries do not meet `Range` header patterns. Since a client can request several ranges at once, multiple small or overlapping ranges could be considered a DDoS attack and rejected by the server.

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

## Conclusion

At this point, we have covered the main parts of the HTTP range-request contract. By following specification, range units define the transferable portions of a resource, request headers specify which portions the client needs, and status codes with response headers describe the result of that request.

This knowledge is needed to understand the rules ASP.NET Core follows to turn a range request into a partial response. In the next post, I am going to show the embodiment of this semantics inside `FileResultHelper`. We will break down primary static methods validating the request conditions and preparing response headers for selecting and writing the requested bytes.

<!-- [How ASP.NET Core Handles Range Requests for File Results](./2026-10-21-serving-byte-ranges-via-http.md). -->

## References

- [Hypertext Transfer Protocol (HTTP/1.1): Range Requests](https://datatracker.ietf.org/doc/html/rfc7233): Definition of the HTTP range-request protocol, including range units, request and response headers, status codes, and multipart responses.
- [HTTP Range Requests for partial content retrieval](https://http.dev/range-request): Provides a practical overview of requesting and serving only selected portions of a resource.
- [Introduction to HTTP Multipart](https://blog.adamchalmers.com/multipart/): Explains multipart message structure and boundaries for responses containing multiple byte ranges.
