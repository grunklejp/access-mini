# access-mini

Type-safe ABAC library (pure TypeScript, Bun-native), 0 runtime deps.

## Setup
```bash
bun install
```

## Scripts
- Test (100% coverage): `bun test --coverage --bail`
- Build types+ESM to `dist/`: `bun run build`
- Type-check only: `bun run typecheck`

## Usage
```ts
import { createPermissionDefinition, createPermissions } from "access-mini";

// Define permissions for a resource (e.g., "post")
type Actor = { id: string; role: string };
type Post = { ownerId: string };
type Attributes = { ip?: string };

const postDef = createPermissionDefinition("post", {
  create: ({ actor, entity }: { actor: Actor; entity: Post }) => actor.id === entity.ownerId,
});

const permissions = createPermissions().add(postDef);

// Builder API
const canPost = permissions.get("post").can({ id: "u1", role: "user" }).create({ ownerId: "u1" }).with();

// Function API
const post = { ownerId: "u1" };
const user = { id: "u1", role: "user" };
const can = permissions.can("post", { actor: user, entity: post });
const canCreate = await can.create();
```

This project was created using `bun init` (v1.2.19).
