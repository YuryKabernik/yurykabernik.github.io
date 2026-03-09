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

Basic CORS configuration for ASPNET applications is well described in Microsoft docs and based on named configuration via action delegate.

Described: [Enable Cross-Origin Requests (CORS) in ASP.NET Core | Microsoft Learn](https://learn.microsoft.com/en-us/aspnet/core/security/cors?view=aspnetcore-10.0#enable-cors)

Today, we will explore an alternative approach to configuring CORS in ASP.NET Core applications using the Options pattern. This design allows for a more modular and testable configuration setup, separating concerns and improving maintainability.

## ASP.NET Core Internals of CORS Configuration

Extension methods for setting up cross-origin resource sharing services in a Service Collection are defined in `CorsServiceCollectionExtensions` class and register services required for CORS support, such as `ICorsService` and `ICorsPolicyProvider`.

https://github.com/dotnet/aspnetcore/blob/086f563efb6390553ef079a5622f9ae5fb9284cd/src/Middleware/CORS/src/CorsServiceCollectionExtensions.cs#L37-L43

```csharp
/// <summary>
/// Adds cross-origin resource sharing services to the specified <see cref="IServiceCollection" />.
/// </summary>
public static IServiceCollection AddCors(this IServiceCollection services)
{
    ArgumentNullException.ThrowIfNull(services);

    services.AddOptions();

    services.TryAdd(ServiceDescriptor.Transient<ICorsService, CorsService>());
    services.TryAdd(ServiceDescriptor.Transient<ICorsPolicyProvider, DefaultCorsPolicyProvider>());

    return services;
}

/// <summary>
/// Adds cross-origin resource sharing services to the specified <see cref="IServiceCollection" />.
/// </summary>
public static IServiceCollection AddCors(this IServiceCollection services, Action<CorsOptions> setupAction)
{
    ArgumentNullException.ThrowIfNull(services);
    ArgumentNullException.ThrowIfNull(setupAction);

    services.AddCors();
    services.Configure(setupAction);

    return services;
}
```

Internally and consequentially `AddCors` calls configuration extension method registering `ConfigureNamedOptions<CorsOptions>` with the provided configuration action delegate.

https://github.com/dotnet/runtime/blob/d19b7caced61a9f43d5cb1a8a9825e5e79b265d4/src/libraries/Microsoft.Extensions.Options/src/OptionsServiceCollectionExtensions.cs#L75-L104

Policy-based implementation is based on creating `ConfigureNamedOptions<TOptions>` and passing action delegate initializing the options object:

```csharp
/// <summary>
/// Registers an action used to configure a particular type of options.
/// Note: These are run before all <seealso cref="PostConfigure{TOptions}(IServiceCollection, Action{TOptions})"/>.
/// </summary>
public static IServiceCollection Configure<TOptions>(this IServiceCollection services, Action<TOptions> configureOptions) where TOptions : class
    => services.Configure(Options.Options.DefaultName, configureOptions);

/// <summary>
/// Registers an action used to configure a particular type of options.
/// Note: These are run before all <seealso cref="PostConfigure{TOptions}(IServiceCollection, Action{TOptions})"/>.
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

Since `CorsServiceCollectionExtensions` exposes an extension method only registering core services, by omitting configuration options delegate, we could separately define and inject our own options configurator via app.settings.json setting up `CorsOptions` on our own via `IConfigureOptions<T>` interface.

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
        httpContext.Response.Headers.Append("X-Custom-Header-None", "This is a custom header that should not be exposed to the client.");

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
- CORS Disabled: fetch fails by CORS error
- CORS Enabled, Origin Allowed: fetch succeeded + header NOT exposed in application
- CORS Enabled, Origin Allowed, Custom Header Exposed: fetch succeeded + header exposed in application

![cors-origin-requests-blocked](/assets/img/posts/cors-configuration-via-options-pattern/cors-origin-requests-blocked.png)

reading headers in the client application with CORS enabled and custom header exposed:

![img.png](/assets/img/posts/cors-configuration-via-options-pattern/cors-request-reading-allowed-headers.png)

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
