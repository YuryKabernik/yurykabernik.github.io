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

The value under `propertyName` is a name of a property presented in all components listed under `oneOf` composite keyword. It will be used to match a specific property value with the target dotnet type. The `mapping` keyword binds each supported value to a different schema component name explicitly defining the correlation of the type with the value.

```json
[
  {
    "documentId": "11111111-1111-1111-1111-111111111111",
    "ownerId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "access": "read",
    "audience": {
      "type": "company",
      "companyId": "123e4567-e89b-12d3-a456-426614174000"
    }
  },
  {
    "documentId": "22222222-2222-2222-2222-222222222222",
    "ownerId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "access": "write",
    "audience": {
      "type": "groups",
      "groupIds": [
        "987e6543-e21b-12d3-a456-426614174111",
        "987e6543-e21b-12d3-a456-426614174222"
      ]
    }
  },
  {
    "documentId": "33333333-3333-3333-3333-333333333333",
    "ownerId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "access": "read",
    "audience": {
      "type": "contacts",
      "contactIds": [
        "555e1234-e89b-12d3-a456-426614174999",
        "555e1234-e89b-12d3-a456-426614175000"
      ]
    }
  }
]
```

The example JSON schema is an array of requests for sharing documents among different types of audience. Objects share an identical structure except for the 'audience' property, which varies in its required properties depending on the audience type. This way, the contract allows us to implement an endpoint accepting a set of commands for document processing and handle them polymorphically by audience real type.

## On the backend side

Starting with .NET 7, the `System.Text.Json` namespace provides functionality that supports polymorphic type hierarchy serialization and deserialization.


## Solution

## Implementation
