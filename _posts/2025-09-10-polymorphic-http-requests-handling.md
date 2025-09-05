---
title: "Polymorphic HTTP Requests Handling"
date: 2025-09-10 00:00:01 -0200
categories: Dotnet Serialization
tags: dotnet aspnetcore csharp serialization openapi discriminator
---

# Simplifying Polymorphic HTTP Request Handling in .NET

With each update to .NET, developers gain access to powerful new features that streamline complex tasks. One such feature is the ability to handle polymorphic HTTP requests—an essential capability for dynamic APIs. This article explores how to achieve this using OpenAPI Discriminator Objects and .NET's `System.Text.Json` library.

## On the Contract Side

The OpenAPI specification includes a powerful feature called the Discriminator Object. It allows API contracts to handle polymorphic data serialization and deserialization. This is especially useful when dealing with dynamic data structures.

The discriminator is supported in schema definition only when using the composite keywords `oneOf`, `anyOf`, and `allOf`. The basic implementation involves `oneOf`/`anyOf` neighboring `discriminator`.

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
              - $ref: '#/components/schemas/GroupsAudience'
              - $ref: '#/components/schemas/ContactsAudience'
            discriminator:
              propertyName: type
              mapping:
                company: '#/components/schemas/CompanyAudience'
                groups: '#/components/schemas/GroupsAudience'
                contacts: '#/components/schemas/ContactsAudience'
```

The `audience` property is defined as an array of polymorphic objects, enabling a document to be shared in a single request with multiple audience types.

The `propertyName` specified in the `discriminator` object refers to a property that must exist in each schema listed under `oneOf`. This property is used to determine which specific .NET type should be deserialized.

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
      "type": "groups",
      "groupIds": [
        "987e6543-e21b-12d3-a456-426614174111",
        "987e6543-e21b-12d3-a456-426614174222"
      ]
    },
    {
      "type": "contacts",
      "contactIds": [
        "555e1234-e89b-12d3-a456-426614174999",
        "555e1234-e89b-12d3-a456-426614175000"
      ]
    }
  ]
}
```

The example JSON schema represents an array of requests for sharing documents among different types of audience. Objects share an identical structure except for the `audience` property, which varies in its content.

## On the Backend Side

Starting with .NET 7, the `System.Text.Json` namespace provides functionality that supports polymorphic type hierarchy serialization and deserialization with attribute annotations.

```csharp
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(CompanyAudience), nameof(AudienceType.Company))]
[JsonDerivedType(typeof(GroupsAudience), nameof(AudienceType.Group))]
[JsonDerivedType(typeof(ContactsAudience), nameof(AudienceType.Contacts))]
public abstract class Audience
{
    [JsonPropertyName("type")]
    public AudienceType Type { get; set; } // discriminator property is optional
}

public enum AudienceType { None, Company, Group, Contacts }
```

Using the provided annotations, you can customize the discriminator name and declare mapping of the subtype to the discriminator value, just like in the contract definition.

By default, the discriminator name is `$type`, and the base type is free to omit the matching property. Ensure parameter values in attributes are case-sensitive to avoid runtime errors.

```csharp
public class CompanyAudience : Audience
{
    public Guid CompanyId { get; set; }

    // Uses an external service to check company status
    public override bool SatisfiesPolicy(ICompanyDirectoryService service) =>
        service.GetCompanyType(CompanyId) is CompanyType.Subsidiary or CompanyType.Parent;
}

public class GroupsAudience : Audience
{
    public List<Guid> GroupIds { get; set; }

    // Uses an external service to check if all groups are private
    public bool AreAllPrivate(IGroupInfoService infoService) =>
        GroupIds.All(id => infoService.GetGroupVisibility(id) == GroupVisibility.Private);
}

public class ContactsAudience : Audience
{
    public List<Guid> ContactIds { get; set; }

    // Uses an external service to check if all contacts are internal
    public bool AreAllInternal(IContactDirectoryService service) =>
        ContactIds.All(id => service.IsInternalContact(id));
}
```

Each derived type is expected to have its own implementation with properties, methods, and any other business logic to maintain single responsibility of your code.

An alternative design, not leveraging polymorphic serialization, would require implementing a custom JSON converter for the base type or working around with exposing a single raw JSON property. This complicates request validation and increases the need for conditional checks.

With polymorphic serialization, you can deserialize the `audience` array into a collection of strongly-typed objects, each deserialized to a dedicated audience type and processed by a command handler.

## Conclusion

This design allows you to handle multiple audience types in a single request, making batch operations straightforward. By using a discriminator property, you can easily extend the contract to support new audience types without requiring major refactoring.

The polymorphic approach also keeps your codebase clean and maintainable, as you only need to deal with audience types individually rather than through complex conditional checks.

## Useful Links

- [System.Text.Json and Polymorphism](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/polymorphism): Official documentation on polymorphic serialization in .NET.
- [Custom Converter Patterns](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/converters-how-to#custom-converter-patterns): Guide to creating custom JSON converters.
- [Polymorphic Deserialization](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/converters-how-to#support-polymorphic-deserialization): Techniques for handling polymorphic deserialization.
