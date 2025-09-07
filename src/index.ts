/**
 * Represents a primitive value that can be used as an attribute in permission checks.
 *
 * @public
 */
export type AttributeValue = string | number | boolean | null | undefined;

/**
 * Arguments structure for permission handlers, containing actor, optional entity, and optional attributes.
 *
 * @template A - The actor type (user, service account, etc.)
 * @template E - The entity type being accessed (post, document, etc.)
 * @template Attr - Additional attributes for context-aware permissions
 *
 * @public
 */
export type Args<A, E = unknown, Attr = unknown> = {
  /** The actor performing the action */
  actor: A;
  /** The entity being accessed (optional) */
  entity?: E;
  /** Additional context attributes (optional) */
  attributes?: Attr;
};

/**
 * A function that evaluates whether an action is permitted based on the provided arguments.
 *
 * @template Args - The arguments structure containing actor, entity, and attributes
 * @param args - The permission check arguments
 * @returns A boolean or Promise<boolean> indicating if the action is allowed
 *
 * @example
 * ```typescript
 * const canEdit: ActionHandler<{actor: User, entity: Post}> = ({actor, entity}) => {
 *   return actor.id === entity.authorId || actor.role === 'admin';
 * };
 * ```
 *
 * @public
 */
export type ActionHandler<Args = any> = (
  args: Args
) => boolean | Promise<boolean>;

/**
 * A mapping of action names to their corresponding permission handlers.
 *
 * @example
 * ```typescript
 * const postActions: ActionMap = {
 *   create: ({actor}) => actor.role === 'admin',
 *   read: ({actor, entity}) => entity.published || actor.id === entity.authorId
 * };
 * ```
 *
 * @public
 */
export type ActionMap = Record<string, ActionHandler<any>>;

/**
 * Defines permissions for a specific resource with associated action handlers.
 *
 * @template R - The resource name type
 * @template H - The action handlers map type
 *
 * @public
 */
export interface PermissionDefinition<R extends string, H extends ActionMap> {
  /** The name of the resource this definition applies to */
  resource: R;
  /** Map of action names to their permission handlers */
  handlers: H;
}

// Extract argument types from handlers, supporting both optional and required properties
type ArgsOf<H> = H extends Record<string, (args: infer P) => any> ? P : never;
type ActorOf<H> = ArgsOf<H> extends { actor: infer A } ? A : never;

/**
 * Helper type for creating type-safe action handlers with proper argument constraints.
 * Automatically constructs the correct Args type based on which parameters are provided.
 *
 * @template A - The actor type (required)
 * @template E - The entity type (optional, defaults to never)
 * @template Attr - The attributes type (optional, defaults to never)
 *
 * @example
 * ```typescript
 * // Handler with only actor
 * const simpleRule: CreateActionRule<User> = ({actor}) => actor.role === 'admin';
 *
 * // Handler with actor and entity
 * const entityRule: CreateActionRule<User, Post> = ({actor, entity}) =>
 *   actor.id === entity.authorId;
 *
 * // Handler with all parameters
 * const fullRule: CreateActionRule<User, Post, {reason: string}> =
 *   ({actor, entity, attributes}) =>
 *     actor.role === 'admin' || (entity.draft && attributes.reason === 'review');
 * ```
 *
 * @public
 */
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

/**
 * Creates a permission definition for a specific resource with its associated action handlers.
 * This is the primary way to define what actions are available on a resource and how they should be evaluated.
 *
 * @template R - The resource name type (must extend string)
 * @template H - The action handlers map type (must extend ActionMap)
 *
 * @param resource - The name of the resource (e.g., 'post', 'user', 'document')
 * @param handlers - An object mapping action names to their permission handler functions
 * @returns A PermissionDefinition that can be used with createPermissions
 *
 * @example
 * ```typescript
 * // Create permission definition for posts
 * const postPermissions = createPermissionDefinition('post', {
 *   // Simple action with only actor
 *   create: ({ actor }: { actor: User }) => actor.role === 'admin',
 *
 *   // Action with actor and entity
 *   edit: ({ actor, entity }: { actor: User; entity: Post }) =>
 *     actor.role === 'admin' || actor.id === entity.authorId,
 *
 *   // Action with all parameters
 *   publish: ({ actor, entity, attributes }: {
 *     actor: User;
 *     entity: Post;
 *     attributes: { reason: string }
 *   }) => entity.authorId === actor.id && attributes.reason.length > 10
 * });
 *
 * // Use with createPermissions
 * const permissions = createPermissions([postPermissions]);
 * ```
 *
 * @public
 */
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

/**
 * The main permissions interface providing type-safe access to permission checks.
 * Supports both builder-pattern and direct function call APIs.
 *
 * @template T - Array of PermissionDefinition types that this instance manages
 *
 * @public
 */
export interface Permissions<
  T extends readonly PermissionDefinition<any, any>[] = PermissionDefinition<
    any,
    any
  >[]
> {
  /**
   * Gets a resource-specific permission checker with builder-pattern API.
   *
   * @param resource - The name of the resource to check permissions for
   * @returns An object with a `can` method that accepts an actor and returns action methods
   *
   * @example
   * ```typescript
   * // Builder-pattern API
   * const canEdit = await permissions
   *   .get('post')
   *   .can(user)
   *   .edit(post, { reason: 'fixing typo' });
   * ```
   */
  get: <R extends ResourceNamesOf<T>>(
    resource: R
  ) => {
    can: ResourceAccessor<Extract<T[number], PermissionDefinition<R, any>>>;
  };

  /**
   * Direct permission checking with two overloads:
   * 1. Check all actions for a resource, returning an object of action functions
   * 2. Check a specific action directly, returning a boolean result
   */
  can: {
    /**
     * Returns an object containing all available actions as callable functions.
     *
     * @param resource - The name of the resource
     * @param ctx - The context containing actor, entity, and attributes
     * @returns An object with action methods that return boolean/Promise<boolean>
     *
     * @example
     * ```typescript
     * const actions = permissions.can('post', { actor: user, entity: post });
     * const canEdit = await actions.edit();
     * const canDelete = await actions.delete();
     * ```
     */
    <R extends ResourceNamesOf<T>>(
      resource: R,
      ctx: ArgsOf<HandlersOf<Extract<T[number], PermissionDefinition<R, any>>>>
    ): ActionObject<Extract<T[number], PermissionDefinition<R, any>>>;

    /**
     * Directly checks a specific action and returns the result.
     *
     * @param resource - The name of the resource
     * @param action - The specific action to check
     * @param ctx - The context containing actor, entity, and attributes
     * @returns Boolean or Promise<boolean> indicating if the action is permitted
     *
     * @example
     * ```typescript
     * const canEdit = await permissions.can('post', 'edit', {
     *   actor: user,
     *   entity: post
     * });
     * ```
     */
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

/**
 * Creates a type-safe permissions system from an array of permission definitions.
 * This is the main entry point for setting up your permission system.
 *
 * @template T - Array of PermissionDefinition types to include in this permissions instance
 *
 * @param initialDefs - Optional array of permission definitions to initialize with
 * @returns A Permissions instance with type-safe access to all defined resources and actions
 *
 * @example
 * ```typescript
 * // Define your types
 * type User = { id: string; role: 'admin' | 'user' };
 * type Post = { id: string; authorId: string; published: boolean };
 *
 * // Create permission definitions
 * const postPermissions = createPermissionDefinition('post', {
 *   create: ({ actor }: { actor: User }) => actor.role === 'admin',
 *   edit: ({ actor, entity }: { actor: User; entity: Post }) =>
 *     actor.role === 'admin' || actor.id === entity.authorId,
 *   read: ({ entity }: { actor: User; entity: Post }) => entity.published
 * });
 *
 * const userPermissions = createPermissionDefinition('user', {
 *   view: ({ actor }: { actor: User }) => true,
 *   admin: ({ actor }: { actor: User }) => actor.role === 'admin'
 * });
 *
 * // Create the permissions system
 * const permissions = createPermissions([postPermissions, userPermissions]);
 *
 * // Use builder pattern API
 * const user = { id: '123', role: 'user' as const };
 * const post = { id: '456', authorId: '123', published: true };
 *
 * const canEdit = await permissions.get('post').can(user).edit(post);
 *
 * // Or use direct API
 * const canCreate = await permissions.can('post', 'create', { actor: user });
 *
 * // Or get all actions for a resource
 * const postActions = permissions.can('post', { actor: user, entity: post });
 * const results = {
 *   canEdit: await postActions.edit(),
 *   canRead: await postActions.read()
 * };
 * ```
 *
 * @public
 */
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
