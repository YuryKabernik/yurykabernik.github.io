---
title: "HTTP via ASP.NET Core: Hypertext Transfer Protocol"
description: "A basic explanation of HTTP and an overview of the ASP.NET Core tools and frameworks for building applications on top of it."
---

The Hypertext Transfer Protocol (HTTP) is a stateless, application-level request/response protocol. It uses extensible semantics and self-descriptive messages to support flexible interaction across web applications.

Among HTTP’s key features:

- Client-Server Messaging Architecture - an interaction model in which two systems exchange messages created by clients and interpreted by servers
- Scalable Hypertext-Oriented Protocol - support for a wide range of media types transferred over the network, while abstracting both clients and servers from the resource representation
- Self-Descriptive Message Syntax - human- and machine-readable semantics that enable messages to be processed independently of previous messages
- Uniform Resource Identifiers (URIs) - identifiers that allow clients to refer to resources without needing to know how those resources are located or implemented on the server

ASP.NET Core provides features that allow us to abstract away from the textual details of HTTP and build client-server systems using .NET types:

- `HttpContext`, `HttpRequest`, `HttpResponse` - strongly typed representations of an HTTP request and response, providing convenient APIs for reading requests and writing responses
- Routing - a foundational server mechanism that matches request URIs to request handlers
- Middleware, filters, and endpoints - components that participate in request processing, endpoint execution, and response generation
- Model binding and formatters - mechanisms that map request data to strongly typed parameters and serialize or deserialize request and response content

Since HTTP supports many kinds of resource representations, ASP.NET Core provides several UI and API frameworks covering common development use cases:

- **ASP.NET Core MVC** - a framework for complex systems that combine server-rendered web pages with dynamically generated API responses, using the Model-View-Controller pattern
- **Razor Pages** - a page-based framework for dynamically rendering web pages on the server
- **Minimal APIs** - a lightweight approach to building high-performance HTTP APIs
- **Blazor** - a framework for building interactive web UIs with C#, supporting both server-side and client-side execution
- **SignalR** - a library for building real-time web applications over WebSockets, Server-Sent Events, and long polling
- **gRPC** - a high-performance binary RPC framework built around a contract-first API model

ASP.NET Core provides many public tools and internal mechanisms to help developers build complex business services.

I’d like to discuss many of them in a series of posts, exploring how they relate to HTTP specifications. So join me as we explore the possibilities of ASP.NET Core through the lens of HTTP semantics.

What is your favorite ASP.NET Core framework? Why?

I’d love to hear about your experience! ❤️

For more .NET notes, visit my website: [**{{ site.url | remove: "https://" | remove: "http://" }}**]({{ site.url }})

#dotnet #http #webdevelopment #aspnetcore
