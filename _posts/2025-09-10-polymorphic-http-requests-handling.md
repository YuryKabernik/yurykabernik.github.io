---
layout: post
title: "Polymorphic HTTP requests handling"
date: 2025-09-10 00:00:01 -0200
categories: dotnet aspnetcore csharp serialization openapi discriminator
---

# .NET Serialization Polymorphism via Discriptor Object

## On the contract side

There is a schema object in OpenAPI specification named Discriminator Object. It allows us to design an API data contract that could be serialized and deserialized polymorphically matching a named property value to a specific complex type.

The discriminator is supported in schema definition only when using the composite keywords `oneOf`, `anyOf`, `allOf`.The basic implementation involves `oneOf`/`anyOf` neighboring `discriminator` keyword. First, we must explicitly reference all possible component schemas involved in the descrimination under `oneOf`/`anyOf`. Than the discriminator object provides details on the property name and a mapping between its value and expected schema.

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

The `audience` property is defined as an array containing polymorphic objects, enabling a document to be shared with multiple audience types in a single request.

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

This design allows you to handle multiple audience types in a single request, making batch operations straightforward. By using a discriminator property, you can easily extend the contract to support new audience types without breaking existing functionality. The polymorphic approach also helps keep your codebase clean and maintainable, as you only need to deal with specific audience details when necessary.

## On the backend side

Starting with .NET 7, the `System.Text.Json` namespace provides functionality that supports polymorphic type hierarchy serialization and deserialization with attribute annotations.


```csharp
// Abstract base class for audience types
public abstract class Audience
{
    public string Type { get; set; }
}

// Concrete audience types
public class CompanyAudience : Audience
{
    public Guid CompanyId { get; set; }
}

public class GroupsAudience : Audience
{
    public List<Guid> GroupIds { get; set; }
}

public class ContactsAudience : Audience
{
    public List<Guid> ContactIds { get; set; }
}
```

With the provided contract, you can deserialize the `audience` array into a collection of strongly-typed objects, each deserialized under a different audience type and placed into the array of the common abstract class.

```csharp
public enum AudienceType
{
    None,
    Company,
    Group,
    Contacts
}

[JsonPolymorphic(TypeDiscriminatorPropertyName = nameof(Audience.Type))]
[JsonDerivedType(typeof(CompanyAudience), nameof(AudienceType.Company))]
[JsonDerivedType(typeof(GroupsAudience), nameof(AudienceType.Group))]
[JsonDerivedType(typeof(ContactsAudience), nameof(AudienceType.Contacts))]
public abstract class Audience
{
    public string Type { get; set; }
}

```

## Solution

## Implementation
