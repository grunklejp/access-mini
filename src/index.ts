export type AttributeValue = string | number | boolean | null | undefined;

export type Args<A, E = unknown, Attr = unknown> = {
  actor: A;
  entity?: E;
  attributes?: Attr;
};

// More flexible action handler that accepts any args structure
export type ActionHandler<Args = any> = (
  args: Args
) => boolean | Promise<boolean>;

export type ActionMap = Record<string, ActionHandler<any>>;

export interface PermissionDefinition<R extends string, H extends ActionMap> {
  resource: R;
  handlers: H;
}

// Extract argument types from handlers, supporting both optional and required properties
type ArgsOf<H> = H extends Record<string, (args: infer P) => any> ? P : never;
type ActorOf<H> = ArgsOf<H> extends { actor: infer A } ? A : never;

export type CreateActionRule<
  A, // Actor type
  E = never, // Entity type (optional)
  Attr = never // Attributes type (optional)
> = [E] extends [never]
  ? [Attr] extends [never]
    ? ActionHandler<{ actor: A }>
    : ActionHandler<{ actor: A; attributes: Attr }>
  : [Attr] extends [never]
  ? ActionHandler<{ actor: A; entity: E }>
  : ActionHandler<{ actor: A; entity: E; attributes: Attr }>;

export function createPermissionDefinition<
  R extends string,
  H extends ActionMap
>(resource: R, handlers: H): PermissionDefinition<R, H> {
  return { resource, handlers };
}

type ActionsOf<D> = D extends PermissionDefinition<any, infer H>
  ? keyof H & string
  : never;
type HandlersOf<D> = D extends PermissionDefinition<any, infer H> ? H : never;

// Extract the parameter type for a specific action handler
type HandlerArgsOf<H, K extends keyof H> = H[K] extends (args: infer P) => any
  ? P
  : never;

// Check if entity is required (not optional) for a specific action
type IsEntityRequired<H, K extends keyof H> = HandlerArgsOf<H, K> extends {
  entity: any;
}
  ? true
  : false;

// Check if attributes is required (not optional) for a specific action
type IsAttributesRequired<H, K extends keyof H> = HandlerArgsOf<H, K> extends {
  attributes: any;
}
  ? true
  : false;

// Extract entity type for a specific action
type EntityTypeOf<H, K extends keyof H> = HandlerArgsOf<H, K> extends {
  entity?: infer E;
}
  ? E
  : HandlerArgsOf<H, K> extends { entity: infer E }
  ? E
  : never;

// Extract attributes type for a specific action
type AttributesTypeOf<H, K extends keyof H> = HandlerArgsOf<H, K> extends {
  attributes?: infer A;
}
  ? A
  : HandlerArgsOf<H, K> extends { attributes: infer A }
  ? A
  : never;

// Builder types that respect the exact parameter requirements
type ActionMethod<H, K extends keyof H> = IsEntityRequired<H, K> extends true
  ? IsAttributesRequired<H, K> extends true
    ? (
        entity: EntityTypeOf<H, K>,
        attributes: AttributesTypeOf<H, K>
      ) => boolean | Promise<boolean>
    : (
        entity: EntityTypeOf<H, K>,
        attributes?: AttributesTypeOf<H, K>
      ) => boolean | Promise<boolean>
  : IsAttributesRequired<H, K> extends true
  ? (
      entity?: EntityTypeOf<H, K>,
      attributes?: AttributesTypeOf<H, K>
    ) => boolean | Promise<boolean>
  : (
      entity?: EntityTypeOf<H, K>,
      attributes?: AttributesTypeOf<H, K>
    ) => boolean | Promise<boolean>;

type ActionInvoker<D extends PermissionDefinition<any, any>> = {
  [K in ActionsOf<D>]: ActionMethod<HandlersOf<D>, K>;
};

type ResourceAccessor<D extends PermissionDefinition<any, any>> = (
  actor: ActorOf<HandlersOf<D>>
) => ActionInvoker<D>;

type ActionObject<D extends PermissionDefinition<any, any>> = {
  [K in ActionsOf<D>]: () => boolean | Promise<boolean>;
};

// Extract resource names from an array of permission definitions
type ResourceNamesOf<T extends readonly PermissionDefinition<any, any>[]> =
  T[number]["resource"];

export interface Permissions<
  T extends readonly PermissionDefinition<any, any>[] = PermissionDefinition<
    any,
    any
  >[]
> {
  get: <R extends ResourceNamesOf<T>>(
    resource: R
  ) => {
    can: ResourceAccessor<Extract<T[number], PermissionDefinition<R, any>>>;
  };
  can: {
    <R extends ResourceNamesOf<T>>(
      resource: R,
      ctx: ArgsOf<HandlersOf<Extract<T[number], PermissionDefinition<R, any>>>>
    ): ActionObject<Extract<T[number], PermissionDefinition<R, any>>>;
    <
      R extends ResourceNamesOf<T>,
      A extends ActionsOf<Extract<T[number], PermissionDefinition<R, any>>>
    >(
      resource: R,
      action: A,
      ctx: ArgsOf<HandlersOf<Extract<T[number], PermissionDefinition<R, any>>>>
    ): boolean | Promise<boolean>;
  };
}

export function createPermissions<
  T extends readonly PermissionDefinition<any, any>[] = []
>(initialDefs?: T): Permissions<T> {
  const defs = new Map<string, PermissionDefinition<any, any>>();

  // Add initial definitions if provided
  if (initialDefs) {
    for (const def of initialDefs) {
      defs.set(def.resource, def);
    }
  }

  function get(resource: string) {
    const def = defs.get(resource);
    if (!def)
      throw new Error(`No permission definition for resource: ${resource}`);

    const can: ResourceAccessor<typeof def> = (actor) => {
      const invoker: Record<string, any> = {};
      for (const action of Object.keys(def.handlers)) {
        invoker[action] = (entity?: unknown, attributes?: unknown) =>
          def.handlers[action]({ actor, entity, attributes });
      }
      return invoker as ActionInvoker<typeof def>;
    };

    return { can } as any;
  }

  function can(resource: string, actionOrCtx: any, ctx?: any) {
    const def = defs.get(resource);
    if (!def)
      throw new Error(`No permission definition for resource: ${resource}`);

    // Check if we have the new signature: can(resource, action, ctx)
    if (typeof actionOrCtx === "string" && ctx !== undefined) {
      const action = actionOrCtx;
      if (!(action in def.handlers)) {
        throw new Error(
          `No handler for action '${action}' on resource '${resource}'`
        );
      }
      return def.handlers[action](ctx);
    }

    // Original signature: can(resource, ctx)
    const result: Record<string, any> = {};
    for (const action of Object.keys(def.handlers)) {
      result[action] = () => def.handlers[action](actionOrCtx);
    }
    return result as ActionObject<typeof def>;
  }

  const api = { get, can } as Permissions<T>;
  return api;
}

// USAGE:

// type User = {
//   id: string;
//   name: string;
//   createdAt: Date;
// };

// const messageRule: CreateActionRule<
//   User,
//   { id: string; contents: string; sentAt: Date },
//   {
//     to: User;
//     friendsList: string[];
//   }
// > = (constraints) =>
//   constraints.attributes.friendsList.includes(constraints.attributes.to.id);

// const userPermissions = createPermissionDefinition("user", {
//   sendMessage: messageRule,
// });

// const postPermissions = createPermissionDefinition("post", {
//   create: ({ actor }: { actor: User }) => {
//     if (actor.createdAt < new Date("2025-01-01")) {
//       return true;
//     } else if (actor.id === "1") {
//       return true;
//     } else {
//       return false;
//     }
//   },
// });

// const permissions = createPermissions([userPermissions, postPermissions]);

// const canMessage = await permissions
//   .get("user")
//   .can({ id: "1", createdAt: new Date(), name: "jp" })
//   .sendMessage(
//     { contents: "hey", id: "1", sentAt: new Date() },
//     {
//       to: { id: "2", createdAt: new Date(), name: "nadi" },
//       friendsList: ["2"],
//     }
//   );
