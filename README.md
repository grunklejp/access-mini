# access-mini

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen.svg)]()

> Type-safe ABAC (Attribute-Based Access Control) library with zero runtime dependencies

## Features

- 🔒 **Type-Safe** - Full TypeScript support with compile-time validation
- ⚡ **Zero Dependencies** - No external runtime dependencies
- 🎯 **Flexible APIs** - Builder pattern and direct function call support
- 🔄 **Async Ready** - Built-in support for asynchronous permission evaluation
- 📦 **Lightweight** - Minimal bundle size impact
- 🛡️ **Production Ready** - Comprehensive test coverage

## Installation

```bash
npm install access-mini
# or
yarn add access-mini
# or
bun add access-mini
```

## Quick Start

### 1. Define Your Types

```typescript
type User = {
  id: string;
  role: "admin" | "user" | "moderator";
  department: string;
};

type Post = {
  id: string;
  authorId: string;
  published: boolean;
};
```

### 2. Create Permission Definitions

```typescript
import { createPermissionDefinition, createPermissions } from "access-mini";

const postPermissions = createPermissionDefinition("post", {
  create: ({ actor }: { actor: User }) => actor.role === "admin",

  edit: ({ actor, entity }: { actor: User; entity: Post }) =>
    actor.role === "admin" || actor.id === entity.authorId,

  read: ({ entity }: { actor: User; entity: Post }) => entity.published,
});
```

### 3. Initialize Permissions System

```typescript
const permissions = createPermissions([postPermissions]);
```

### 4. Check Permissions

```typescript
const user = { id: "123", role: "user" as const, department: "engineering" };
const post = { id: "456", authorId: "123", published: false };

// Builder pattern (recommended)
const canEdit = await permissions.get("post").can(user).edit(post);

// Direct function call
const canRead = await permissions.can("post", "read", {
  actor: user,
  entity: post,
});

// Batch check
const actions = permissions.can("post", { actor: user, entity: post });
const canCreate = await actions.create();
```

## Advanced Usage

### Async Permission Handlers

```typescript
const documentPermissions = createPermissionDefinition("document", {
  read: async ({ actor, entity }) => {
    const userAccess = await getUserAccessLevel(actor.id, entity.id);
    return userAccess >= entity.requiredAccessLevel;
  },
});
```

### Complex Permission Logic

```typescript
const projectPermissions = createPermissionDefinition("project", {
  manage: ({ actor, entity, attributes }) => {
    if (actor.role === "admin") return true;
    if (entity.ownerId === actor.id) return true;
    if (attributes?.override && actor.role === "moderator") return true;
    return false;
  },
});
```

### Multiple Resources

```typescript
const permissions = createPermissions([
  postPermissions,
  userPermissions,
  documentPermissions,
]);

// Type-safe access to all resources
const canEditUser = await permissions.get("user").can(actor).edit(targetUser);
const canManageDoc = await permissions.get("document").can(actor).manage(doc);
```

## API Reference

### `createPermissionDefinition(resource, handlers)`

Creates a permission definition for a specific resource.

- `resource` - String name of the resource
- `handlers` - Object mapping action names to permission handler functions

### `createPermissions(definitions)`

Creates a permissions system from permission definitions.

- `definitions` - Array of permission definitions

### `permissions.get(resource).can(actor)`

Builder pattern API for fluent permission checking.

### `permissions.can(resource, action?, context)`

Direct permission checking with optional action parameter.

## License

MIT © [access-mini](https://github.com/grunklejp/access-mini)

---

## Disclaimer

Parts of this project's documentation, code, and code examples were created with AI assistance to ensure comprehensive coverage and clarity.
