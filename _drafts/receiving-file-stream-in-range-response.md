---
title: "Receiving File Streams in Range Responses on the Frontend"
description: "How frontend apps request and consume partial file responses with Range, Content-Range, and streamed reads in the browser."
date: 2026-07-29 00:00:01 +0200
categories: .NET
tags: dotnet aspnet-core file-result result-types file-serving http http-range range-request
image:
  path: /assets/img/title/file-result-type-class-diagram.svg
  alt: File Result Type Class Diagram
---

Previously in the posts we’ve explored...





The backend article showed how ASP.NET Core prepares partial file responses. This third part moves to the browser side and focuses on what the frontend does with those responses. The important shift is simple: the server can speak HTTP Range, but the client still has to ask for a specific byte window, validate the response, and decide how to assemble or display the received data.

That matters in several common cases. A media player may want to seek to a new position without downloading the whole file again. A document viewer may want to resume an interrupted download. A custom frontend may want to show progressive loading while keeping memory usage low. In all of these cases, the frontend is not just receiving a file, it is coordinating a byte-level conversation with the server.

## What the frontend expects from a range response

When a range request succeeds, the browser or JavaScript client should receive a `206 Partial Content` response. That response usually contains the following headers:

| Header           | Purpose                                                              |
| ---------------- | -------------------------------------------------------------------- |
| `Content-Range`  | Describes the returned byte window and the total resource length     |
| `Accept-Ranges`  | Signals that the server supports byte-range requests                 |
| `Content-Length` | Tells the client how many bytes are included in the partial response |

If the requested range cannot be satisfied, the server may return `416 Range Not Satisfiable`. A frontend should treat that response as a signal to reset its local state, not as a normal file payload.

When the request is cross-origin, the frontend also depends on CORS headers. The browser must be allowed to send the `Range` request header, and the response must expose `Content-Range` if client-side JavaScript needs to read it. Without that, the request may succeed on the wire but still be unusable from the page code.

## Requesting a byte range

The simplest client-side approach is to use `fetch` with a `Range` header. The request tells the server exactly which part of the resource to return.

```js
async function fetchByteRange(url, start, end) {
  const response = await fetch(url, {
    headers: {
      Range: `bytes=${start}-${end}`
    }
  });

  if (response.status === 206) {
    return response;
  }

  if (response.status === 416) {
    throw new Error('Requested range cannot be satisfied');
  }

  return response;
}
```

The response itself is only part of the story. A good frontend should verify that the returned range matches the request and that the server did not silently fall back to a full `200 OK` response. If the server returns the full file instead of a partial one, the client should decide whether to accept that behavior or restart the transfer from the beginning.

## Reading the response body

For large payloads, the response stream is often more useful than converting everything into memory at once. The browser exposes the body as a `ReadableStream`, which can be consumed chunk by chunk.

```js
async function readResponseStream(response, onChunk) {
  if (!response.body) {
    throw new Error('Streaming is not supported by this response');
  }

  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      onChunk(value);
    }
  } finally {
    reader.releaseLock();
  }
}
```

This model is useful when the frontend wants to update a progress indicator, append data to a buffer, or write the received bytes into a file-like destination. It also avoids the memory spike of buffering the entire response before doing anything with it.

## Resuming interrupted downloads

One of the strongest reasons to use range responses on the frontend is resumability. If a download stops after the first few megabytes, the client can store the last received byte and continue from that position later.

```js
async function resumeDownload(url, knownLength, receivedBytes) {
  const start = receivedBytes;
  const end = knownLength - 1;

  const response = await fetch(url, {
    headers: {
      Range: `bytes=${start}-${end}`
    }
  });

  if (response.status !== 206) {
    throw new Error('Server did not return a partial response');
  }

  return response;
}
```

The client should always compare the returned `Content-Range` header with its expected offset. That check protects the app from mismatched state when the file changed between requests or when a proxy altered the response.

## Cross-origin considerations

Frontend code often talks to APIs on another origin, which makes CORS part of the story. For range requests to work smoothly, the server must allow the `Range` request header and expose `Content-Range` to the browser.

From the frontend perspective, the symptoms of missing CORS configuration are subtle. The network request may complete, but JavaScript cannot inspect the headers it needs. The fix is not on the client side; it belongs to the server policy that authorizes the request and exposes the response metadata.

## Practical rule

If the frontend only needs to display the resource, let the browser handle the file natively whenever possible. If the frontend needs resume support, partial loading, custom progress UI, or byte-level control, use `fetch` and range requests directly. The browser gives you the tools, but the app still needs to coordinate the protocol correctly.

## References

- [Understanding File Result Types in ASP.NET Core](/posts/file-result-type-system/)
- [RFC 7233 - Range Requests](https://datatracker.ietf.org/doc/html/rfc7233)
- [MDN - Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [MDN - ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
