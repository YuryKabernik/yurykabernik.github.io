---
title: "Polymorphic HTTP Requests Handling"
date: 2025-09-10 00:00:01 -0200
categories: Dotnet Web
tags: dotnet aspnetcore csharp serialization openapi discriminator
---

# Simplifying Polymorphic HTTP Request Handling in .NET

With each update to .NET, developers gain access to powerful new features that streamline complex tasks. One such feature is the ability to handle polymorphic HTTP requests—an essential capability for dynamic APIs. This article explores how to achieve this using OpenAPI Discriminator Objects and .NET's `System.Text.Json` library.

## On the Contract Side

The OpenAPI specification includes a powerful feature called the **Discriminator Object**. It allows API contracts to handle polymorphic data serialization and deserialization. This is especially useful when dealing with dynamic data structures.

The discriminator is supported in schema definitions only when using the composite keywords `oneOf`, `anyOf`, and `allOf`.

| Composite Keyword | Validation Behavior                                | Typical Use Case                                                                        |
| ----------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `oneOf`           | Value must match **exactly one** subschema.        | Selects a single subtype for an object or array item.                                   |
| `allOf`           | Value must match **all** subschemas.               | Combines multiple schemas; discriminator can help resolve type when subschemas overlap. |
| `anyOf`           | Value must match **any (one or more)** subschemas. | Allows flexible matching; discriminator resolves which subtype applies for each item.   |

The basic implementation involves placing the `discriminator` object alongside these keywords, allowing to determine the target schema to use during serialization and deserialization.

This approach could be used for both single object properties and arrays. For single objects, it helps to selects the correct subtype of the property. For arrays, each item uses the discriminator to resolve its type, enabling to hold different subtypes within the same array definition.

```yaml
components:
  schemas:
    ShareDocumentRequest:
      type: object
      required:
        - documentId
        - ownerId
        - access
        - audience
      properties:
        documentId:
          type: string
          format: uuid
          description: ID of the document being shared
        ownerId:
          type: string
          format: uuid
          description: ID of the document owner
        access:
          type: string
          enum: [read, write]
          description: Access rule for the shared document
        audience:
          type: array
          description: List of audiences to share the document with
          items:
            oneOf:
              - $ref: '#/components/schemas/CompanyAudience'
              - $ref: '#/components/schemas/GroupAudience'
              - $ref: '#/components/schemas/ContactAudience'
            discriminator:
              propertyName: type
              mapping:
                company: '#/components/schemas/CompanyAudience'
                groups: '#/components/schemas/GroupAudience'
                contacts: '#/components/schemas/ContactAudience'
```

The `audience` property is defined as an array of polymorphic objects, where each array item can represent a different audience type, enabling a document to be shared in a single request with multiple audience types.

The `propertyName` specified in the `discriminator` object refers to a property that is used to select the schemas listed under `oneOf`. By default, the value of the property is matched to a schema name from the list and defined under components/schemas.

If a `mapping` is provided, it overrides the default behavior by mapping specific values to either a different schema name or a schema identified by a URI. If a mapping value could be interpreted as both a schema name and a URI, it’s up to the implementation to decide, but it’s recommended to treat it as a schema name.

```json
{
  "documentId": "11111111-1111-1111-1111-111111111111",
  "ownerId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "access": "read",
  "audience": [
    {
      "type": "company",
      "companyId": "123e4567-e89b-12d3-a456-426614174000"
    },
    {
      "type": "group",
      "groupIds": [
        "987e6543-e21b-12d3-a456-426614174111",
        "987e6543-e21b-12d3-a456-426614174222"
      ]
    },
    {
      "type": "contact",
      "contactIds": [
        "555e1234-e89b-12d3-a456-426614174999",
        "555e1234-e89b-12d3-a456-426614175000"
      ]
    }
  ]
}
```

The example JSON schema represents a request for sharing a document with different types of audience. The polymorphism applies to the items within the `audience` array—each item can have a distinct structure according to its type.

## On the Backend Side

Starting with .NET 7, the `System.Text.Json` namespace provides functionality that supports polymorphic type hierarchy serialization and deserialization with attribute annotations.

```csharp
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(CompanyAudience), nameof(AudienceType.Company))]
[JsonDerivedType(typeof(GroupAudience), nameof(AudienceType.Group))]
[JsonDerivedType(typeof(ContactAudience), nameof(AudienceType.Contact))]
public abstract class Audience
{
    [JsonPropertyName("type")]
    public AudienceType Type { get; set; } // discriminator property is optional
}

public enum AudienceType { None, Company, Group, Contact }
```

Using the provided annotations, you can customize the discriminator name and declare mapping of the subtype to the discriminator value, just like in the contract definition.

By default, the discriminator name is `$type`, and the base type may omit the matching property. Parameter values in attributes are case-sensitive, and the discriminator value can be either an integer or a string. Mixing both types is technically allowed but not recommended, as it can lead to confusion and potential deserialization issues.

```csharp
public class CompanyAudience : Audience
{
    public Guid CompanyId { get; set; }

    // Uses an external service to check company status
    public override bool SatisfiesPolicy(ICompanyDirectoryService service) =>
        service.GetCompanyType(CompanyId) is CompanyType.Subsidiary or CompanyType.Parent;
}

public class GroupAudience : Audience
{
    public List<Guid> GroupIds { get; set; }

    // Uses an external service to check if all groups are private
    public bool AreAllPrivate(IGroupInfoService infoService) =>
        GroupIds.All(id => infoService.GetGroupVisibility(id) == GroupVisibility.Private);
}

public class ContactAudience : Audience
{
    public List<Guid> ContactIds { get; set; }

    // Uses an external service to check if all contacts are internal
    public bool AreAllInternal(IContactDirectoryService service) =>
        ContactIds.All(id => service.IsInternalContact(id));
}
```

Each derived type is expected to have its own implementation with properties, methods, and any other business logic to maintain single responsibility of your code.

```csharp
public interface ICommandHandler<T>
{
    Task HandleAsync(Guid document, T audience, CancellationToken cancellationToken);
}

public class DocumentShareDispatcher(IServiceProvider serviceProvider)
{
    public async Task DispatchShareRequest(ShareDocumentRequest request, CancellationToken cancellationToken = default)
    {
        foreach (var audience in request.Audience)
        {
            await (audience switch
            {
                CompanyAudience company => serviceProvider
                    .GetService<ICommandHandler<CompanyAudience>>()!
                    .HandleAsync(request.DocumentId, company, cancellationToken),
                
                GroupAudience group => serviceProvider
                    .GetService<ICommandHandler<GroupAudience>>()!
                    .HandleAsync(request.DocumentId, group, cancellationToken),
                
                ContactAudience contact => serviceProvider
                    .GetService<ICommandHandler<ContactAudience>>()!
                    .HandleAsync(request.DocumentId, contact, cancellationToken),
                
                _ => throw new InvalidOperationException("Unknown audience type.")
            });
        }
    }
}
```

With polymorphic serialization, you can deserialize the `audience` array into a collection of strongly-typed objects, each deserialized to a dedicated audience type and processed by a command handler.

An alternative design, not leveraging polymorphic serialization, would require implementing a custom JSON converter for the base type or working around with exposing a single raw JSON property. This complicates request validation and increases the need for conditional checks.

## Conclusion

This design offers several significant benefits:

- **Ease of Extensibility:** Supporting new audience types is straightforward. Developers can add a new derived class and update the OpenAPI schema without requiring significant refactoring.
- **Cleaner Domain Model:** The use of polymorphism ensures that the domain model remains clean, making it easier to understand and maintain.
- **Focus on Business Flow:** Developers can dedicate their efforts to implementing the business logic rather than spending time on data transfer object (DTO) mapping.
- **Support for Batch Operations:** The polymorphic approach enables handling multiple audience types in a single request, simplifying batch operations and improving API usability.

However, this approach is not without its drawbacks:

- **Increased Complexity in Schema Management:** The OpenAPI schema becomes more complex due to the use of the `discriminator` property and the need for precise mappings on both sides.
- **Runtime Deserialization Errors:** If the discriminator mapping is not implemented correctly or if there are mismatches in case sensitivity, deserialization errors can occur at runtime.
- **Increased Learning Curve:** The broader use of abstractions brings a challenge for newcomers to understand the concept and start contributing into the system.

By weighing these benefits and drawbacks, you can determine whether the polymorphic approach aligns with your project's requirements and priorities. While it simplifies handling polymorphic data and enhances code maintainability, careful attention must be given to schema accuracy and runtime behavior.

## Useful Links

- [OpenAPI Data Modeling Techniques](https://swagger.io/specification/#composition-and-inheritance-polymorphism): Composition and polymorphism in OpenAPI.
- [OpenAPI Discriminator Object](https://swagger.io/specification/#discriminator-object): Details on using the discriminator object in OpenAPI schemas.
- [System.Text.Json and Polymorphism](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/polymorphism): Official documentation on polymorphic serialization in .NET.
- [Custom Converter Patterns](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/converters-how-to#custom-converter-patterns): Guide to creating custom JSON converters.
- [Polymorphic Deserialization](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/converters-how-to#support-polymorphic-deserialization): Techniques for handling polymorphic deserialization.
