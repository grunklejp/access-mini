import { describe, it, expect } from "bun:test";
import {
  createPermissionDefinition,
  createPermissions,
  type Args,
  type ActionHandler,
  type ActionMap,
  type PermissionDefinition,
  type Permissions,
} from "../src/index";

// Test types
type User = {
  id: string;
  name: string;
  role: "admin" | "user";
  createdAt: Date;
};

type Post = {
  id: string;
  title: string;
  authorId: string;
  published: boolean;
};

type PostAttributes = {
  visibility: "public" | "private";
  tags?: string[];
};

describe("createPermissionDefinition", () => {
  it("should create a permission definition with resource and handlers", () => {
    const def = createPermissionDefinition("post", {
      create: ({ actor }: { actor: User }) => actor.role === "admin",
      read: ({ actor }: { actor: User }) => true,
    });

    expect(def.resource).toBe("post");
    expect(def.handlers).toBeDefined();
    expect(typeof def.handlers.create).toBe("function");
    expect(typeof def.handlers.read).toBe("function");
  });

  it("should handle complex permission logic", () => {
    const def = createPermissionDefinition("post", {
      create: ({ actor }: { actor: User }) => {
        return (
          actor.role === "admin" || actor.createdAt < new Date("2025-01-01")
        );
      },
      edit: ({ actor, entity }: { actor: User; entity: Post }) => {
        return actor.role === "admin" || actor.id === entity.authorId;
      },
      delete: ({ actor }: { actor: User }) => actor.role === "admin",
    });

    const admin: User = {
      id: "1",
      name: "Admin",
      role: "admin",
      createdAt: new Date("2024-01-01"),
    };
    const oldUser: User = {
      id: "2",
      name: "Old User",
      role: "user",
      createdAt: new Date("2024-01-01"),
    };
    const newUser: User = {
      id: "3",
      name: "New User",
      role: "user",
      createdAt: new Date("2025-06-01"),
    };
    const post: Post = {
      id: "post1",
      title: "Test",
      authorId: "2",
      published: true,
    };

    // Test create permission
    expect(def.handlers.create({ actor: admin })).toBe(true);
    expect(def.handlers.create({ actor: oldUser })).toBe(true);
    expect(def.handlers.create({ actor: newUser })).toBe(false);

    // Test edit permission
    expect(def.handlers.edit({ actor: admin, entity: post })).toBe(true);
    expect(def.handlers.edit({ actor: oldUser, entity: post })).toBe(true);
    expect(def.handlers.edit({ actor: newUser, entity: post })).toBe(false);

    // Test delete permission
    expect(def.handlers.delete({ actor: admin })).toBe(true);
    expect(def.handlers.delete({ actor: oldUser })).toBe(false);
    expect(def.handlers.delete({ actor: newUser })).toBe(false);
  });

  it("should handle async permission handlers", async () => {
    const def = createPermissionDefinition("async-resource", {
      asyncAction: async ({ actor }: { actor: User }) => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 1));
        return actor.role === "admin";
      },
    });

    const admin: User = {
      id: "1",
      name: "Admin",
      role: "admin",
      createdAt: new Date(),
    };
    const user: User = {
      id: "2",
      name: "User",
      role: "user",
      createdAt: new Date(),
    };

    const adminResult = await def.handlers.asyncAction({ actor: admin });
    const userResult = await def.handlers.asyncAction({ actor: user });

    expect(adminResult).toBe(true);
    expect(userResult).toBe(false);
  });
});

describe("createPermissions", () => {
  const postDef = createPermissionDefinition("post", {
    create: ({ actor }: { actor: User }) => actor.role === "admin",
    read: ({ actor, entity }: { actor: User; entity?: Post }) => true,
    edit: ({ actor, entity }: { actor: User; entity: Post }) => {
      return actor.role === "admin" || actor.id === entity.authorId;
    },
  });

  const userDef = createPermissionDefinition("user", {
    view: ({ actor }: { actor: User }) => true,
    edit: ({ actor, entity }: { actor: User; entity: User }) => {
      return actor.role === "admin" || actor.id === entity.id;
    },
  });

  it("should create permissions with no initial definitions", () => {
    const permissions = createPermissions();
    expect(permissions).toBeDefined();
    expect(typeof permissions.get).toBe("function");
    expect(typeof permissions.can).toBe("function");
  });

  it("should create permissions with initial definitions", () => {
    const permissions = createPermissions([postDef, userDef]);
    expect(permissions).toBeDefined();
    expect(typeof permissions.get).toBe("function");
    expect(typeof permissions.can).toBe("function");
  });

  describe("get() method", () => {
    const permissions = createPermissions([postDef, userDef]);

    it("should return resource accessor for valid resource", () => {
      const postAccess = permissions.get("post");
      expect(postAccess).toBeDefined();
      expect(typeof postAccess.can).toBe("function");
    });

    it("should throw error for invalid resource", () => {
      expect(() => {
        permissions.get("nonexistent" as any);
      }).toThrow("No permission definition for resource: nonexistent");
    });

    it("should provide builder pattern API", () => {
      const admin: User = {
        id: "1",
        name: "Admin",
        role: "admin",
        createdAt: new Date(),
      };
      const user: User = {
        id: "2",
        name: "User",
        role: "user",
        createdAt: new Date(),
      };
      const post: Post = {
        id: "post1",
        title: "Test",
        authorId: "2",
        published: true,
      };

      const postAccess = permissions.get("post").can(admin);

      expect(typeof postAccess.create).toBe("function");
      expect(typeof postAccess.read).toBe("function");
      expect(typeof postAccess.edit).toBe("function");

      // Test the builder methods
      expect(postAccess.create()).toBe(true);
      expect(postAccess.read()).toBe(true);
      expect(postAccess.edit(post)).toBe(true); // admin can edit any post
    });

    it("should handle entity and attributes in builder pattern", () => {
      const user: User = {
        id: "2",
        name: "User",
        role: "user",
        createdAt: new Date(),
      };
      const post: Post = {
        id: "post1",
        title: "Test",
        authorId: "2",
        published: true,
      };

      const postAccess = permissions.get("post").can(user);

      expect(postAccess.create()).toBe(false);
      expect(postAccess.read()).toBe(true);
      expect(postAccess.read(post)).toBe(true);
      expect(postAccess.edit(post)).toBe(true); // user can edit their own post
    });
  });

  describe("can() method - original signature", () => {
    const permissions = createPermissions([postDef, userDef]);

    it("should work with original can(resource, ctx) signature", () => {
      const admin: User = {
        id: "1",
        name: "Admin",
        role: "admin",
        createdAt: new Date(),
      };
      const user: User = {
        id: "2",
        name: "User",
        role: "user",
        createdAt: new Date(),
      };
      const post: Post = {
        id: "post1",
        title: "Test",
        authorId: "2",
        published: true,
      };

      const adminPostActions = permissions.can("post", {
        actor: admin,
        entity: post,
      });
      const userPostActions = permissions.can("post", {
        actor: user,
        entity: post,
      });

      expect(typeof adminPostActions.create).toBe("function");
      expect(typeof adminPostActions.read).toBe("function");
      expect(typeof adminPostActions.edit).toBe("function");

      expect(adminPostActions.create()).toBe(true);
      expect(adminPostActions.read()).toBe(true);
      expect(adminPostActions.edit()).toBe(true);

      expect(userPostActions.create()).toBe(false);
      expect(userPostActions.read()).toBe(true);
      expect(userPostActions.edit()).toBe(true); // user can edit their own post
    });

    it("should throw error for invalid resource", () => {
      const user: User = {
        id: "1",
        name: "User",
        role: "user",
        createdAt: new Date(),
      };

      expect(() => {
        //@ts-expect-error
        permissions.can("nonexistent" as any, { actor: user });
      }).toThrow("No permission definition for resource: nonexistent");
    });
  });

  describe("can() method - new signature", () => {
    const permissions = createPermissions([postDef, userDef]);

    it("should work with new can(resource, action, ctx) signature", () => {
      const admin: User = {
        id: "1",
        name: "Admin",
        role: "admin",
        createdAt: new Date(),
      };
      const user: User = {
        id: "2",
        name: "User",
        role: "user",
        createdAt: new Date(),
      };
      const post: Post = {
        id: "post1",
        title: "Test",
        authorId: "2",
        published: true,
      };

      // Test admin permissions
      expect(
        permissions.can("post", "create", {
          actor: admin,
          entity: {
            id: "",
            title: "",
            authorId: "",
            published: false,
          },
        })
      ).toBe(true);
      expect(
        permissions.can("post", "read", { actor: admin, entity: post })
      ).toBe(true);
      expect(
        permissions.can("post", "edit", { actor: admin, entity: post })
      ).toBe(true);

      // Test user permissions
      expect(
        permissions.can("post", "create", {
          actor: user,
          entity: {
            id: "",
            title: "",
            authorId: "",
            published: false,
          },
        })
      ).toBe(false);
      expect(
        permissions.can("post", "read", { actor: user, entity: post })
      ).toBe(true);
      expect(
        permissions.can("post", "edit", { actor: user, entity: post })
      ).toBe(true);

      // Test user permissions with different post
      const otherPost: Post = {
        id: "post2",
        title: "Other",
        authorId: "3",
        published: true,
      };
      expect(
        permissions.can("post", "edit", { actor: user, entity: otherPost })
      ).toBe(false);
    });

    it("should throw error for invalid resource", () => {
      const user: User = {
        id: "1",
        name: "User",
        role: "user",
        createdAt: new Date(),
      };

      expect(() => {
        permissions.can("nonexistent" as any, "create", {
          actor: user,
          entity: {
            id: "",
            name: "",
            role: "admin",
            createdAt: new Date(),
          },
        });
      }).toThrow("No permission definition for resource: nonexistent");
    });

    it("should throw error for invalid action", () => {
      const user: User = {
        id: "1",
        name: "User",
        role: "user",
        createdAt: new Date(),
      };

      expect(() => {
        return permissions.can("post", "nonexistent" as any, {
          actor: user,
          entity: {
            id: "",
            title: "",
            authorId: "",
            published: false,
          },
        });
      }).toThrow("No handler for action 'nonexistent' on resource 'post'");
    });

    it("should handle async actions", async () => {
      const asyncDef = createPermissionDefinition("async", {
        asyncAction: async ({ actor }: { actor: User }) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return actor.role === "admin";
        },
      });

      const asyncPermissions = createPermissions([asyncDef]);
      const admin: User = {
        id: "1",
        name: "Admin",
        role: "admin",
        createdAt: new Date(),
      };
      const user: User = {
        id: "2",
        name: "User",
        role: "user",
        createdAt: new Date(),
      };

      const adminResult = await asyncPermissions.can("async", "asyncAction", {
        actor: admin,
      });
      const userResult = await asyncPermissions.can("async", "asyncAction", {
        actor: user,
      });

      expect(adminResult).toBe(true);
      expect(userResult).toBe(false);
    });
  });

  describe("mixed usage scenarios", () => {
    const permissions = createPermissions([postDef, userDef]);

    it("should work with both API styles interchangeably", () => {
      const admin: User = {
        id: "1",
        name: "Admin",
        role: "admin",
        createdAt: new Date(),
      };
      const post: Post = {
        id: "post1",
        title: "Test",
        authorId: "2",
        published: true,
      };

      // Original style
      const originalResult = permissions
        .can("post", { actor: admin, entity: post })
        .create();

      // New style
      const newResult = permissions.can("post", "create", {
        actor: admin,
        entity: post,
      });

      expect(originalResult).toBe(newResult);
      expect(originalResult).toBe(true);
    });

    it("should handle complex permission scenarios", () => {
      const complexDef = createPermissionDefinition("document", {
        read: ({
          actor,
          entity,
          attributes,
        }: {
          actor: User;
          entity?: { visibility: string };
          attributes?: { requesterRole?: string };
        }) => {
          if (actor.role === "admin") return true;
          if (entity?.visibility === "public") return true;
          if (attributes?.requesterRole === "editor") return true;
          return false;
        },
      });

      const complexPermissions = createPermissions([complexDef]);
      const user: User = {
        id: "1",
        name: "User",
        role: "user",
        createdAt: new Date(),
      };
      const admin: User = {
        id: "2",
        name: "Admin",
        role: "admin",
        createdAt: new Date(),
      };

      // Admin can always read
      expect(complexPermissions.can("document", "read", { actor: admin })).toBe(
        true
      );

      // User cannot read private document
      expect(
        complexPermissions.can("document", "read", {
          actor: user,
          entity: { visibility: "private" },
        })
      ).toBe(false);

      // User can read public document
      expect(
        complexPermissions.can("document", "read", {
          actor: user,
          entity: { visibility: "public" },
        })
      ).toBe(true);

      // User with editor role can read
      expect(
        complexPermissions.can("document", "read", {
          actor: user,
          entity: { visibility: "private" },
          attributes: { requesterRole: "editor" },
        })
      ).toBe(true);
    });
  });
});

describe("type exports", () => {
  it("should export all required types", () => {
    // These are compile-time checks that the types are properly exported
    const args: Args<User, Post, PostAttributes> = {
      actor: { id: "1", name: "Test", role: "user", createdAt: new Date() },
      entity: { id: "post1", title: "Test", authorId: "1", published: true },
      attributes: { visibility: "public", tags: ["test"] },
    };

    const handler: ActionHandler<typeof args> = (args) =>
      args.actor.role === "admin";

    const actionMap: ActionMap = {
      create: handler,
      read: handler,
    };

    const definition: PermissionDefinition<"test", typeof actionMap> = {
      resource: "test",
      handlers: actionMap,
    };

    expect(args.actor.id).toBe("1");
    expect(typeof handler).toBe("function");
    expect(actionMap.create).toBe(handler);
    expect(definition.resource).toBe("test");
  });
});

describe("Method chaining API", () => {
  type User = {
    id: string;
    name: string;
    role: "admin" | "user";
    createdAt: Date;
  };

  type Message = {
    id: string;
    contents: string;
    sentAt: Date;
  };

  type MessageAttributes = {
    to: User;
    friendsList: string[];
  };

  type Post = {
    id: string;
    title: string;
    authorId: string;
    published: boolean;
  };

  type PostAttributes = {
    visibility: "public" | "private";
    tags?: string[];
  };

  const userPermissions = createPermissionDefinition("user", {
    // Actor only
    view: ({ actor }: { actor: User }) => actor.role === "admin",

    // Actor + Entity
    edit: ({ actor, entity }: { actor: User; entity: User }) => {
      return actor.role === "admin" || actor.id === entity.id;
    },

    // Actor + Entity + Attributes (all required)
    sendMessage: ({
      actor,
      entity,
      attributes,
    }: {
      actor: User;
      entity: Message;
      attributes: MessageAttributes;
    }) => {
      return attributes.friendsList.includes(attributes.to.id);
    },

    // Actor + optional Entity + optional Attributes
    browse: ({
      actor,
      entity,
      attributes,
    }: {
      actor: User;
      entity?: User;
      attributes?: { filter?: string };
    }) => {
      if (actor.role === "admin") return true;
      if (attributes?.filter === "public") return true;
      return entity?.id === actor.id;
    },
  });

  const postPermissions = createPermissionDefinition("post", {
    // Actor only
    create: ({ actor }: { actor: User }) => actor.role === "admin",

    // Actor + Entity (required)
    read: ({ actor, entity }: { actor: User; entity: Post }) => {
      return actor.role === "admin" || entity.published;
    },

    // Actor + Entity + optional Attributes
    edit: ({
      actor,
      entity,
      attributes,
    }: {
      actor: User;
      entity: Post;
      attributes?: PostAttributes;
    }) => {
      if (actor.role === "admin") return true;
      if (actor.id === entity.authorId) return true;
      return attributes?.visibility === "public";
    },

    // Async handler
    delete: async ({
      actor,
      entity,
    }: {
      actor: User;
      entity: Post;
    }): Promise<boolean> => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 1));
      return actor.role === "admin" && actor.id === entity.authorId;
    },
  });

  const permissions = createPermissions([userPermissions, postPermissions]);

  const admin: User = {
    id: "1",
    name: "Admin",
    role: "admin",
    createdAt: new Date("2024-01-01"),
  };

  const regularUser: User = {
    id: "2",
    name: "User",
    role: "user",
    createdAt: new Date("2024-06-01"),
  };

  const targetUser: User = {
    id: "3",
    name: "Target",
    role: "user",
    createdAt: new Date("2024-03-01"),
  };

  const message: Message = {
    id: "msg1",
    contents: "Hello!",
    sentAt: new Date(),
  };

  const post: Post = {
    id: "post1",
    title: "Test Post",
    authorId: "2",
    published: true,
  };

  describe("Actor-only actions", () => {
    it("should work with admin user", () => {
      const canView = permissions.get("user").can(admin).view();
      expect(canView).toBe(true);

      const canCreate = permissions.get("post").can(admin).create();
      expect(canCreate).toBe(true);
    });

    it("should work with regular user", () => {
      const canView = permissions.get("user").can(regularUser).view();
      expect(canView).toBe(false);

      const canCreate = permissions.get("post").can(regularUser).create();
      expect(canCreate).toBe(false);
    });
  });

  describe("Actor + Entity actions", () => {
    it("should handle user editing themselves", () => {
      const canEdit = permissions
        .get("user")
        .can(regularUser)
        .edit(regularUser);
      expect(canEdit).toBe(true);
    });

    it("should handle user editing others", () => {
      const canEdit = permissions.get("user").can(regularUser).edit(targetUser);
      expect(canEdit).toBe(false);
    });

    it("should handle admin editing anyone", () => {
      const canEdit = permissions.get("user").can(admin).edit(targetUser);
      expect(canEdit).toBe(true);
    });

    it("should handle post reading with published post", () => {
      const canRead = permissions.get("post").can(regularUser).read(post);
      expect(canRead).toBe(true);
    });

    it("should handle post reading with unpublished post", () => {
      const unpublishedPost = { ...post, published: false };
      const canRead = permissions
        .get("post")
        .can(regularUser)
        .read(unpublishedPost);
      expect(canRead).toBe(false);

      const adminCanRead = permissions
        .get("post")
        .can(admin)
        .read(unpublishedPost);
      expect(adminCanRead).toBe(true);
    });
  });

  describe("Actor + Entity + Attributes actions", () => {
    it("should handle sendMessage with friend in list", () => {
      const canSend = permissions
        .get("user")
        .can(regularUser)
        .sendMessage(message, {
          to: targetUser,
          friendsList: ["3"], // targetUser.id is "3"
        });
      expect(canSend).toBe(true);
    });

    it("should handle sendMessage with friend not in list", () => {
      const canSend = permissions
        .get("user")
        .can(regularUser)
        .sendMessage(message, {
          to: targetUser,
          friendsList: ["1", "4"], // targetUser.id "3" not in list
        });
      expect(canSend).toBe(false);
    });

    it("should handle post editing with optional attributes", () => {
      const authorPost = { ...post, authorId: regularUser.id };

      // Author can edit without attributes
      const canEditAsAuthor = permissions
        .get("post")
        .can(regularUser)
        .edit(authorPost);
      expect(canEditAsAuthor).toBe(true);

      // Non-author (targetUser) with public visibility
      const canEditPublic = permissions
        .get("post")
        .can(targetUser)
        .edit(post, { visibility: "public" });
      expect(canEditPublic).toBe(true);

      // Non-author (targetUser) with private visibility should return false
      const canEditPrivate = permissions
        .get("post")
        .can(targetUser)
        .edit(post, { visibility: "private" });
      expect(canEditPrivate).toBe(false);

      // Non-author (targetUser) without attributes should return false
      const canEditNoAttrs = permissions.get("post").can(targetUser).edit(post);
      expect(canEditNoAttrs).toBe(false);
    });
  });

  describe("Optional parameters", () => {
    it("should handle browse with no parameters", () => {
      const adminCanBrowse = permissions.get("user").can(admin).browse();
      expect(adminCanBrowse).toBe(true);

      const userCanBrowse = permissions.get("user").can(regularUser).browse();
      expect(userCanBrowse).toBe(false);
    });

    it("should handle browse with entity only", () => {
      const canBrowseSelf = permissions
        .get("user")
        .can(regularUser)
        .browse(regularUser);
      expect(canBrowseSelf).toBe(true);

      const canBrowseOther = permissions
        .get("user")
        .can(regularUser)
        .browse(targetUser);
      expect(canBrowseOther).toBe(false);
    });

    it("should handle browse with attributes only", () => {
      const canBrowsePublic = permissions
        .get("user")
        .can(regularUser)
        .browse(undefined, { filter: "public" });
      expect(canBrowsePublic).toBe(true);

      const canBrowsePrivate = permissions
        .get("user")
        .can(regularUser)
        .browse(undefined, { filter: "private" });
      expect(canBrowsePrivate).toBe(false);
    });

    it("should handle browse with both entity and attributes", () => {
      const canBrowse = permissions
        .get("user")
        .can(regularUser)
        .browse(targetUser, { filter: "public" });
      expect(canBrowse).toBe(true);
    });
  });

  describe("Async actions", () => {
    it("should handle async delete action", async () => {
      const adminPost = { ...post, authorId: admin.id };

      const canDelete = await permissions
        .get("post")
        .can(admin)
        .delete(adminPost);
      expect(canDelete).toBe(true);
    });

    it("should handle async delete action - unauthorized", async () => {
      const canDelete = await permissions
        .get("post")
        .can(regularUser)
        .delete(post);
      expect(canDelete).toBe(false);
    });

    it("should handle async delete action - admin but not author", async () => {
      const otherPost = { ...post, authorId: "999" };

      const canDelete = await permissions
        .get("post")
        .can(admin)
        .delete(otherPost);
      expect(canDelete).toBe(false);
    });
  });

  describe("Complex chaining scenarios", () => {
    it("should handle multiple permission checks in sequence", async () => {
      const userActions = permissions.get("user").can(admin);
      const postActions = permissions.get("post").can(admin);

      expect(userActions.view()).toBe(true);
      expect(userActions.edit(targetUser)).toBe(true);
      expect(postActions.create()).toBe(true);
      expect(postActions.read(post)).toBe(true);

      const adminPost = { ...post, authorId: admin.id };
      const canDelete = await postActions.delete(adminPost);
      expect(canDelete).toBe(true);
    });

    it("should work with different actors on same resource", () => {
      const adminUserActions = permissions.get("user").can(admin);
      const regularUserActions = permissions.get("user").can(regularUser);

      expect(adminUserActions.view()).toBe(true);
      expect(regularUserActions.view()).toBe(false);

      expect(adminUserActions.edit(targetUser)).toBe(true);
      expect(regularUserActions.edit(targetUser)).toBe(false);
      expect(regularUserActions.edit(regularUser)).toBe(true);
    });

    it("should demonstrate the example from the usage comment", () => {
      const canMessage = permissions
        .get("user")
        .can({
          id: "1",
          createdAt: new Date(),
          name: "jp",
          role: "user",
        })
        .sendMessage(
          { contents: "hey", id: "1", sentAt: new Date() },
          {
            to: {
              id: "2",
              createdAt: new Date(),
              name: "nadi",
              role: "user",
            },
            friendsList: ["2"],
          }
        );

      expect(canMessage).toBe(true);
    });

    it("should demonstrate async usage pattern", async () => {
      const canMessage = await permissions
        .get("user")
        .can({
          id: "1",
          createdAt: new Date(),
          name: "jp",
          role: "user",
        })
        .sendMessage(
          { contents: "hey", id: "1", sentAt: new Date() },
          {
            to: {
              id: "2",
              createdAt: new Date(),
              name: "nadi",
              role: "user",
            },
            friendsList: ["2"],
          }
        );

      expect(canMessage).toBe(true);
    });
  });
});
