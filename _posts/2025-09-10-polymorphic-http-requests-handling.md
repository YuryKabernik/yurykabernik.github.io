---
title: "Polymorphic HTTP requests handling"
date: 2025-09-10 00:00:01 -0200
categories: Dotnet Serialization
tags: dotnet aspnetcore csharp serialization openapi discriminator
---

# .NET Serialization Polymorphism via Discriptor Object

There are a lot of new features coming into light with every release of .Net. Some of them are not frequently used or mentioned in public, but can be useful when its time to implement a tricky OpenAPI contract.

## On the contract side

There is a schema object in OpenAPI specification named Discriminator Object. It allows us to design an API data contract that could require to serialize and deserialize data by polymorphically matching a named property value to a specific complex type.

The discriminator is supported in schema definition only when using the composite keywords `oneOf`, `anyOf`, and `allOf`. The basic implementation involves `oneOf`/`anyOf` neighboring `discriminator` keyword. First, we must explicitly reference all component schemas involved in the descrimination under `oneOf`/`anyOf`. Than the discriminator object provides details on the property name and relation between its value and component schema.

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

The `propertyName` specified in the `discriminator` object refers to a property that must exist in each schema listed under `oneOf`. This property is used to determine which specific .NET type should be instantiated during deserialization. The `mapping` section explicitly associates each possible value of the discriminator property with a corresponding schema, declaring the correct type to be expected based on the provided value.


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

The example JSON schema is an array of requests for sharing documents among different types of audience. Objects share an identical structure except for the 'audience' property, which varies in its required properties depending on the audience type.


## On the backend side

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

Using the provided annotaitons, you can customize the discriminator name and declare mapping of the subtype to the discriminator value just like we did before in the contract definition.

By default, the discriminator name is of `$type` value and the base type is free to omit the matching property. Parameter values in attributes are case-censitive, which means that you should be careful when reusing the name of a property with `nameof()` operator in names and values.

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

Each derived type is expected to have its own implementation with properties, methods and any other business logic that needs to be isolated to keep single responsibility of your code. 

Alternative design, not leveraging the polymorphyc serialization, would force us to deep dive into implementation of a custom JSON converter for a base type or workaround with exposing a single request DTO with all the necessary properties of a nullable type.

Request validation becomes complex with multiple conditions on how to treat the request based on the contents of the properties, application code performs more conditional checks than implements business logic. 

```csharp
// TODO: example of the deserialized request from contract and command handler for a single audience
```

With the provided annotaitons, you can deserialize the `audience` array into a collection of strongly-typed objects, each deserialized to a dedicated audience type and processed by a command handlers designed for processing each audience accordingly following business rules and domain model.

## Conclusion

This design allows you to handle multiple audience types in a single request, making batch operations straightforward. By using a discriminator property, you can easily extend the contract to support new audience types without breaking existing functionality.

The polymorphic approach also keeps your codebase clean and maintainable, as you only need to deal with audience types...


## Useful Links

- https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/polymorphism
- https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/converters-how-to#custom-converter-patterns
- https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/converters-how-to#support-polymorphic-deserialization
