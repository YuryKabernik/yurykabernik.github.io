---
layout: weekly
title: "HTTP via ASP.NET Core: Client-Server Architecture"
description: "An overview of HTTP client-server architecture and the .NET components used to send, receive, and process HTTP messages."
categories:
  - Weeklies
  - HTTP via ASP.NET Core
tags: dotnet http aspnet-core http-client delegating-handler kestrel iis http-sys rfc7230 rfc7231
date: 2026-11-02 00:00:01 +0200
---

HTTP is a stateless request/response protocol in which clients and servers exchange messages over a transport connection.

- An **HTTP client** is a program that establishes a connection to a server and sends one or more HTTP requests.
- An **HTTP server** is a program that accepts connections, processes HTTP requests, and sends HTTP responses.

A single program can act as both a client and a server: it can receive requests while also sending requests to fulfill them.

In .NET, the client-side functionality is provided by `HttpClient`, which abstracts connection management and HTTP message delivery from application code.

The main components include:

- **HttpClient** - a high-level API that abstracts .NET applications from the transport-level processing of HTTP messages while allowing to customize connections and message handlers
- **HttpMessageHandler** - a base type that defines the contract for HTTP message handlers
- **DelegatingHandler** - a base type for handlers that delegate pre-request and post-request processing to the next handler in the chain
- **SocketsHttpHandler** - the handler at the bottom of the chain that dispatches requests to the connection pool manager for HTTP transport operations

Together, these components implement the **delegating handler pattern**. A series of message handlers passes the request down to `SocketsHttpHandler`, then passes the response back up the chain to the application.

These handlers can enrich outgoing requests with additional metadata or short-circuit them before they reach the server. They can also implement cross-cutting concerns such as authentication, logging, retries, rate limiting, caching, and distributed tracing across the entire application.

On the server side, ASP.NET Core uses HTTP server implementations to translate raw HTTP messages into an `HttpContext` object:

- **IIS** (**Internet Information Services**) - a traditional Windows web server that can host applications in-process or out-of-process
- **HTTP.sys** - a Windows-only server that leverages HTTP features provided by the operating system
- **Kestrel** - a modern, cross-platform server for running .NET applications on Linux and Windows

In .NET terminology, a server is a program that runs an ASP.NET Core application, handles connections, and parses HTTP messages received from clients.

What has been your most interesting use case for delegating handlers?

Have you worked with IIS, HTTP.sys, or Kestrel?

I’d love to hear about your experience! ❤️

For more .NET notes, visit my website: [**{{ site.url | remove: "https://" | remove: "http://" }}**]({{ site.url }})

#dotnet #http #webdevelopment #aspnetcore #rfc7230 #rfc7231
