---
title: "Cleaning Up ASP.NET Core Startup: Configuring CORS with the Options Pattern"
date: 2026-03-20 00:00:01 +0200
categories: .NET
tags: dotnet options-pattern cors aspnet-core middleware patterns
image:
  path: /assets/img/title/title-agile-methodology.png
  alt: Agile Methodology
  width: 1200
  height: 630
---

![Dotnet with OpenAPI Initiative](/assets/img/title/aws-cors-diagram.png)

Security of modern web applications was always a critical aspect in software development. Browsers by default enforce the **Same-Origin Policy**, restricting access from the provided page to resources that share the same scheme, host, and port. In contrast, CORS (**Cross-Origin Resource Sharing**), a W3C standard, relaxes this restriction by allowing the hosting server to explicitly define which cross-origin requests are permitted and which resources are accessible from the page.

Basic instructions for CORS configuration for ASP\.NET applications is well described on the official Microsoft documentation page. Provided approach is straightforward and suitable for most use cases. Feature previews and quick demos are often implemented using this approach, as a quick setup and immediate testing of CORS policies. However, it may not be the best fit for enterprise-grade applications with centralized configuration management.

Today, we will explore an alternative approach to configuring CORS in ASP.NET Core applications. Instead of configuring CORS directly in the `Startup` class, we will leverage the Options pattern to create a more testable and maintainable configuration setup. Suggested approach allows us to separate concerns from the application root and improve customization of our CORS configuration benefiting from modular nature of the ASP\.NET framework.

## Internals of CORS Configuration

In ASP.NET Core, CORS is implemented as middleware that can be configured to specify which origins, headers, and methods are allowed when making cross-origin requests. These configuration parameters enrich Web API responses with standard headers describing which destination origins can access the resource, which HTTP methods are allowed for these origins, and what custom response headers are exposed to the client application.

The middleware configuration consists of three main components: the CORS services, the CORS policies, and the CORS middleware itself. This is typically done directly in the `Startup` class or the `Program` file, depending on the ASP.NET Core version. First, `AddCors` is called to register feature services and lets us specify default and custom policies in a lambda expression. Then, the `AddDefaultPolicy` and `AddPolicy` extension methods accept another lambda accumulating the rules for each individual named policy. Later on, the `UseCors` middleware is added to the request pipeline applying the defined policies to incoming requests.

```csharp
// register CORS services and define policies
builder.Services.AddCors(options =>
{
    // configure the default policy
    options.AddDefaultPolicy(policy =>
    {
        policy
            .WithOrigins("https://example.com", "https://another-example.com")
            .WithExposedHeaders("X-Custom-Header")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

...
  
// add CORS middleware to the request pipeline
app.UseCors();
```

Let's take a closer look at the `AddCors` method and its overloads to understand how they work internally and how we can leverage them for our own configuration needs.

The overloaded `AddCors(this IServiceCollection services, Action<CorsOptions> setupAction)` method not only registers the services but additionally takes an action delegate for `CorsOptions`. The action delegate gets registered as a configuration action for `CorsOptions` in the service collection. This configuration is stored in the service collection as part of the options configuration infrastructure.

```csharp
/// <summary>
/// Adds cross-origin resource sharing services to the specified <see cref="IServiceCollection" />.
/// </summary>
public static IServiceCollection AddCors(this IServiceCollection services, Action<CorsOptions> setupAction)
{
    ArgumentNullException.ThrowIfNull(services);
    ArgumentNullException.ThrowIfNull(setupAction);

    services.AddCors();                 // Register core CORS services
    services.Configure(setupAction);    // Register the provided configuration action for CorsOptions

    return services;
}
```

The parameterless `AddCors(this IServiceCollection services)`, on the other hand, is responsible only for registering the core services without any configuration. One more thing to notice here is that it also ensures that options infrastructure is added to the application by calling `services.AddOptions()`. This call is necessary for the `IOptions<T>` implementations to work properly for both `CorsService` and `DefaultCorsPolicyProvider` services.

```csharp
/// <summary>
/// Adds cross-origin resource sharing services to the specified <see cref="IServiceCollection" />.
/// </summary>
public static IServiceCollection AddCors(this IServiceCollection services)
{
    ArgumentNullException.ThrowIfNull(services);

    services.AddOptions(); // Ensure that options services are registered

    services.TryAdd(ServiceDescriptor.Transient<ICorsService, CorsService>());
    services.TryAdd(ServiceDescriptor.Transient<ICorsPolicyProvider, DefaultCorsPolicyProvider>());

    return services;
}
```

Diving deeper into details, both `CorsService` and `DefaultCorsPolicyProvider` constructors consume `IOptions<CorsOptions>` to access values for the configured policies, allowing them to apply the defined rules while processing the incoming requests. You might explore on both _[CorsService](https://github.com/dotnet/aspnetcore/blob/ca7652fd719aeed70c3962c432984b8134ef2343/src/Middleware/CORS/src/Infrastructure/CorsService.cs#L22-L34)_ and _[DefaultCorsPolicyProvider](https://github.com/dotnet/aspnetcore/blob/ca7652fd719aeed70c3962c432984b8134ef2343/src/Middleware/CORS/src/Infrastructure/DefaultCorsPolicyProvider.cs#L15-L22)_ implementation details to take a look how they consume and process these options in the official ASP.NET Core repository.

```csharp
    /// <summary>
    /// Creates a new instance of the <see cref="CorsService"/>.
    /// </summary>
    /// <param name="options">The option model representing <see cref="CorsOptions"/>.</param>
    /// <param name="loggerFactory">The <see cref="ILoggerFactory"/>.</param>
    public CorsService(IOptions<CorsOptions> options, ILoggerFactory loggerFactory);

    /// <summary>
    /// Creates a new instance of <see cref="DefaultCorsPolicyProvider"/>.
    /// </summary>
    /// <param name="options">The options configured for the application.</param>
    public DefaultCorsPolicyProvider(IOptions<CorsOptions> options);
```

In addition to registering the core services, the overloaded `AddCors` calls `Configure<TOptions>(this IServiceCollection services, Action<TOptions> configureOptions)` method registering `ConfigureNamedOptions<CorsOptions>` configurator with the provided action delegate. This means that we can create our own implementation of `IConfigureOptions<CorsOptions>` to set up policies based on our custom configuration values, allowing us to separate concerns and improve maintainability of our application.

```csharp
/// <summary>
/// Registers an action used to configure a particular type of options.
/// </summary>
public static IServiceCollection Configure<TOptions>(this IServiceCollection services, Action<TOptions> configureOptions) where TOptions : class
    => services.Configure(Options.Options.DefaultName, configureOptions);

/// <summary>
/// Registers an action used to configure a particular type of options.
/// </summary>
public static IServiceCollection Configure<TOptions>(this IServiceCollection services, string? name, Action<TOptions> configureOptions)
    where TOptions : class
{
    ThrowHelper.ThrowIfNull(services);
    ThrowHelper.ThrowIfNull(configureOptions);

    services.AddOptions();
    services.AddSingleton<IConfigureOptions<TOptions>>(new ConfigureNamedOptions<TOptions>(name, configureOptions));
    return services;
}
```

From now on we know that `CorsService` and `DefaultCorsPolicyProvider` read policy settings through `IOptions<CorsOptions>` and `CorsServiceCollectionExtensions` exposes `AddCors` allowing to register only core services. Knowing these facts we can move policy setup into a custom `IConfigureOptions<CorsOptions>` implementation. This cleanly separates service registration from CORS policy configuration.

## Configuring CorsOptions in IConfigureOptions<T>

settings json with custom CorsRules section to store our custom values for  CORS policies

```json
{
  "AllowedHosts": "*",
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "CorsRules": {
    "AllowedOrigins": [
      "https://localhost:3000",
      "https://example.com"
    ],
    "AllowedHeaders": [
      "GET"
    ],
    "ExposedHeaders": [
      "X-Custom-Header"
    ]
  }
}

```

full application code with options configuration and cors options

```csharp
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors();

builder.Services.AddOptions();
builder.Services.ConfigureOptions<CorsRulesConfiguration>();
builder.Services.ConfigureOptions<CorsOptionsConfiguration>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

app.MapGet("/capitals", (HttpContext httpContext) =>
    {
        httpContext.Response.Headers.Append("X-Custom-Header", "This is a custom header that should be exposed to the client.");
        httpContext.Response.Headers.Append("X-Custom-Header-Hidden", "This is a custom header that should not be exposed to the client.");

        var capitals = new Dictionary<string, string>
        {
            { "France", "Paris" },
            { "Spain", "Madrid" },
            { "Italy", "Rome" },
            { "Germany", "Berlin" },
            { "United Kingdom", "London" }
        };

        return Results.Ok(capitals);
    })
    .WithName("GetWeatherForecast")
    .WithOpenApi();

app.Run();

public class CorsRulesConfiguration(IConfiguration configuration) : IConfigureOptions<CorsRules>
{
    public void Configure(CorsRules options)
    {
        configuration.GetSection(CorsRules.SectionName).Bind(options);
    }
}

public class CorsOptionsConfiguration(IOptions<CorsRules> config) : IConfigureOptions<CorsOptions>
{
    public void Configure(CorsOptions options)
    {
        options.AddDefaultPolicy(policyBuilder =>
        {
            policyBuilder
                .WithOrigins(config.Value.AllowedOrigins.ToArray())
                .WithExposedHeaders(config.Value.ExposedHeaders.ToArray())
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
    }
}

public class CorsRules
{
    public const string SectionName = nameof(CorsRules);
    public List<string> AllowedOrigins { get; set; }
    public List<string> ExposedHeaders { get; set; }
}
```

## Testing and Validation

Both CORS (Cross-Origin Resource Sharing) and SOP (Same-Origin Policy) are server-side configurations that clients decide to enforce or not.

Most **Browsers** do enforce it to prevent issues related to CSRF (Cross-Site Request Forgery) attack.
Most **Development** tools don't care about it.

With that being said, CORS is mostly a browser-enforced security mechanism, and testing it typically involves using tools that can simulate browser behavior or directly testing in a browser environment. Let's simulate a CORS request using a simple JavaScript fetch call from `example.com` to your ASP.NET Core API running on `localhost:5000` with CORS configured above.

Using `example.com` as an origin site to test cors fetch for `capitals`, provide examples:
- CORS Disabled: fetch fails by CORS error (example-org not listed in allowed domains)
![img_3.png](/assets/img/posts/cors-configuration-via-options-pattern/failed-cors-from-exapmle-org.png)

- CORS Enabled, Origin Allowed: fetch succeeded + header NOT exposed in application (example-com is allowed domain, 2nd header not listed in exposed headers)
- CORS Enabled, Origin Allowed, Custom Header Exposed: fetch succeeded + header exposed in application (request from example-com and first-header listed in allowed domains)s
  ![img_2.png](/assets/img/posts/cors-configuration-via-options-pattern/successful-cors-from-example-com.png)

reading headers in the client application with CORS enabled and custom header exposed: using Edge/Chrome DevTools, navigate to the Network Console tab, compose the request to the `capitals` endpoint, and check the "Headers" section. You should see the `X-Custom-Header` in the response headers and `X-Custom-Header-Hidden` discarded from the response details, confirming that it is exposed to the client application.

At the same time you could examine the actual server response. Navigate to the Network tab, find the outgoing `capitals` request, and check the actual response headers from the server. You should see both `X-Custom-Header` and `X-Custom-Header-Hidden` in the response headers, confirming that both headers are sent by the server, but only `X-Custom-Header` is exposed to the client application due to the CORS configuration. 

## Conclusion

This design offers several significant benefits:

- **Centralized Configuration**: All configuration is centralized in one place, making it easier to manage and maintain.
- **Separation of Concerns**: It promotes separation of concerns, as the CORS configuration logic is decoupled from the application startup code.
- **Dynamic Configuration**: It allows for more flexible and dynamic configuration, as you can easily modify the CORS settings without changing the application code, simply by updating the configuration file or environment variables.
- **Testability**: It enhances testability, as you can easily mock the `IConfigureOptions<T>` implementations in unit tests to verify that the CORS configuration is being set up correctly.

However, this approach is not without its drawbacks:

- **Boilerplate Code**: It may require more boilerplate code, as you need to create separate classes for configuring the CORS options, which can be seen as overhead compared to the more straightforward approach of configuring CORS directly in the `Startup` class.
- **.NET Implementation Dependency**: This design relies on the internal implementation of the `AddCors` method in ASP.NET Core, which may change in future versions, potentially breaking your configuration if it relies on specific behaviors of the `AddCors` method.

By weighing these benefits and drawbacks, you can determine whether this design is the right fit for your specific use case and requirements.

## Useful Links

- [ASP.NET Core CORS Documentation](https://learn.microsoft.com/en-us/aspnet/core/security/cors#enable-cors): Official documentation on enabling CORS in ASP.NET Core.
- [Options Pattern in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options): Guide to using the Options pattern for configuration in ASP.NET Core.
- [Best Practices for CORS Configuration](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#best_practices): Best practices for configuring CORS to enhance security and performance.
- [Cross Origin Resource Sharing](https://aws.amazon.com/de/what-is/cross-origin-resource-sharing): Overview of CORS in the context of AWS services.
- [Compose and send web API requests using the Network Console tool](https://learn.microsoft.com/en-us/microsoft-edge/devtools/network-console/network-console-tool): Use the Network Console tool to send web API requests from Browser.
