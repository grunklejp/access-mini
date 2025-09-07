import { describe, it, expect } from "bun:test";
import { createPermissionDefinition, createPermissions } from "../src/index";

// Integration tests that test the full system working together

describe("Integration Tests", () => {
  // Realistic user types
  type User = {
    id: string;
    email: string;
    role: "admin" | "editor" | "viewer" | "banned";
    department: string;
    createdAt: Date;
  };

  type Document = {
    id: string;
    title: string;
    authorId: string;
    department: string;
    classification: "public" | "internal" | "confidential" | "secret";
    published: boolean;
    createdAt: Date;
  };

  type DocumentAttributes = {
    requestReason?: string;
    accessLevel?: "read" | "write" | "admin";
    approvedBy?: string[];
  };

  // Complex permission definitions
  const documentPermissions = createPermissionDefinition("document", {
    create: ({ actor }: { actor: User }) => {
      return (
        ["admin", "editor"].includes(actor.role) && actor.role !== "banned"
      );
    },

    read: ({
      actor,
      entity,
      attributes,
    }: {
      actor: User;
      entity: Document;
      attributes?: DocumentAttributes;
    }) => {
      // Banned users can't read anything
      if (actor.role === "banned") return false;

      // Admins can read everything
      if (actor.role === "admin") return true;

      // Public documents can be read by anyone
      if (entity.classification === "public") return true;

      // Internal documents can be read by same department
      if (
        entity.classification === "internal" &&
        actor.department === entity.department
      ) {
        return true;
      }

      // Confidential documents require editor role or higher in same department
      if (entity.classification === "confidential") {
        return (
          ["admin", "editor"].includes(actor.role) &&
          actor.department === entity.department
        );
      }

      // Secret documents require admin approval
      if (entity.classification === "secret") {
        return attributes?.approvedBy?.includes(actor.id) ?? false;
      }

      return false;
    },

    edit: ({
      actor,
      entity,
      attributes,
    }: {
      actor: User;
      entity: Document;
      attributes?: DocumentAttributes;
    }) => {
      // Banned users can't edit
      if (actor.role === "banned") return false;

      // Admins can edit everything
      if (actor.role === "admin") return true;

      // Authors can edit their own documents if they're editors
      if (actor.id === entity.authorId && actor.role === "editor") {
        return true;
      }

      // Editors in same department can edit non-secret documents
      if (
        actor.role === "editor" &&
        actor.department === entity.department &&
        entity.classification !== "secret"
      ) {
        return true;
      }

      // Special admin access level
      if (
        attributes?.accessLevel === "admin" &&
        attributes?.approvedBy?.includes("system-admin")
      ) {
        return true;
      }

      return false;
    },

    delete: ({ actor, entity }: { actor: User; entity: Document }) => {
      // Only admins can delete, and only from their department or if they're the author
      return (
        actor.role === "admin" &&
        (actor.department === entity.department || actor.id === entity.authorId)
      );
    },

    publish: ({ actor, entity }: { actor: User; entity: Document }) => {
      // Only editors and admins can publish, and only in their department
      return (
        ["admin", "editor"].includes(actor.role) &&
        actor.department === entity.department &&
        !entity.published
      );
    },
  });

  const userPermissions = createPermissionDefinition("user", {
    view: ({ actor, entity }: { actor: User; entity: User }) => {
      // Users can view themselves, admins can view anyone in their department
      return (
        actor.id === entity.id ||
        (actor.role === "admin" && actor.department === entity.department)
      );
    },

    edit: ({ actor, entity }: { actor: User; entity: User }) => {
      // Users can edit themselves, admins can edit anyone in their department
      return (
        actor.id === entity.id ||
        (actor.role === "admin" && actor.department === entity.department)
      );
    },

    promote: ({ actor, entity }: { actor: User; entity: User }) => {
      // Only admins can promote users in their department
      return (
        actor.role === "admin" &&
        actor.department === entity.department &&
        entity.role !== "admin"
      );
    },
  });

  const permissions = createPermissions([documentPermissions, userPermissions]);

  // Test users
  const admin = {
    id: "admin1",
    email: "admin@company.com",
    role: "admin" as const,
    department: "IT",
    createdAt: new Date("2023-01-01"),
  };

  const editor = {
    id: "editor1",
    email: "editor@company.com",
    role: "editor" as const,
    department: "IT",
    createdAt: new Date("2023-06-01"),
  };

  const viewer = {
    id: "viewer1",
    email: "viewer@company.com",
    role: "viewer" as const,
    department: "HR",
    createdAt: new Date("2024-01-01"),
  };

  const banned = {
    id: "banned1",
    email: "banned@company.com",
    role: "banned" as const,
    department: "IT",
    createdAt: new Date("2024-01-01"),
  };

  // Test documents
  const publicDoc = {
    id: "doc1",
    title: "Public Announcement",
    authorId: "editor1",
    department: "IT",
    classification: "public" as const,
    published: true,
    createdAt: new Date("2024-01-01"),
  };

  const internalDoc = {
    id: "doc2",
    title: "Internal IT Procedures",
    authorId: "admin1",
    department: "IT",
    classification: "internal" as const,
    published: true,
    createdAt: new Date("2024-01-01"),
  };

  const confidentialDoc = {
    id: "doc3",
    title: "Confidential IT Report",
    authorId: "admin1",
    department: "IT",
    classification: "confidential" as const,
    published: false,
    createdAt: new Date("2024-01-01"),
  };

  const secretDoc = {
    id: "doc4",
    title: "Secret Security Protocol",
    authorId: "admin1",
    department: "IT",
    classification: "secret" as const,
    published: false,
    createdAt: new Date("2024-01-01"),
  };

  describe("Document Access Control", () => {
    describe("Reading documents", () => {
      it("should allow appropriate access to public documents", () => {
        // Everyone except banned can read public docs
        expect(
          permissions.can("document", "read", {
            actor: admin,
            entity: publicDoc,
          })
        ).toBe(true);
        expect(
          permissions.can("document", "read", {
            actor: editor,
            entity: publicDoc,
          })
        ).toBe(true);
        expect(
          permissions.can("document", "read", {
            actor: viewer,
            entity: publicDoc,
          })
        ).toBe(true);
        expect(
          permissions.can("document", "read", {
            actor: banned,
            entity: publicDoc,
          })
        ).toBe(false);
      });

      it("should enforce department restrictions on internal documents", () => {
        // Only IT department can read internal IT doc
        expect(
          permissions.can("document", "read", {
            actor: admin,
            entity: internalDoc,
          })
        ).toBe(true);
        expect(
          permissions.can("document", "read", {
            actor: editor,
            entity: internalDoc,
          })
        ).toBe(true);
        expect(
          permissions.can("document", "read", {
            actor: viewer,
            entity: internalDoc,
          })
        ).toBe(false); // Different department
        expect(
          permissions.can("document", "read", {
            actor: banned,
            entity: internalDoc,
          })
        ).toBe(false);
      });

      it("should enforce role and department restrictions on confidential documents", () => {
        // Only admin/editor in same department can read confidential docs
        expect(
          permissions.can("document", "read", {
            actor: admin,
            entity: confidentialDoc,
          })
        ).toBe(true);
        expect(
          permissions.can("document", "read", {
            actor: editor,
            entity: confidentialDoc,
          })
        ).toBe(true);
        expect(
          permissions.can("document", "read", {
            actor: viewer,
            entity: confidentialDoc,
          })
        ).toBe(false); // Wrong role and department
        expect(
          permissions.can("document", "read", {
            actor: banned,
            entity: confidentialDoc,
          })
        ).toBe(false);
      });

      it("should enforce approval requirements for secret documents", () => {
        // Secret docs require admin role or explicit approval
        expect(
          permissions.can("document", "read", {
            actor: admin,
            entity: secretDoc,
          })
        ).toBe(true);
        expect(
          permissions.can("document", "read", {
            actor: editor,
            entity: secretDoc,
          })
        ).toBe(false);

        // With approval
        expect(
          permissions.can("document", "read", {
            actor: editor,
            entity: secretDoc,
            attributes: { approvedBy: ["editor1"] },
          })
        ).toBe(true);

        expect(
          permissions.can("document", "read", {
            actor: viewer,
            entity: secretDoc,
            attributes: { approvedBy: ["viewer1"] },
          })
        ).toBe(true);
      });
    });

    describe("Creating documents", () => {
      it("should allow only appropriate roles to create documents", () => {
        expect(
          permissions.can("document", "create", {
            actor: admin,
            entity: {
              id: "",
              title: "",
              authorId: "",
              department: "",
              classification: "public",
              published: false,
              createdAt: new Date(),
            },
          })
        ).toBe(true);
        expect(
          permissions.can("document", "create", {
            actor: editor,
            entity: {
              id: "",
              title: "",
              authorId: "",
              department: "",
              classification: "public",
              published: false,
              createdAt: new Date(),
            },
          })
        ).toBe(true);
        expect(
          permissions.can("document", "create", {
            actor: viewer,
            entity: {
              id: "",
              title: "",
              authorId: "",
              department: "",
              classification: "public",
              published: false,
              createdAt: new Date(),
            },
          })
        ).toBe(false);
        expect(
          permissions.can("document", "create", {
            actor: banned,
            entity: {
              id: "",
              title: "",
              authorId: "",
              department: "",
              classification: "public",
              published: false,
              createdAt: new Date(),
            },
          })
        ).toBe(false);
      });
    });

    describe("Editing documents", () => {
      it("should allow admins to edit all documents", () => {
        expect(
          permissions.can("document", "edit", {
            actor: admin,
            entity: publicDoc,
          })
        ).toBe(true);
        expect(
          permissions.can("document", "edit", {
            actor: admin,
            entity: internalDoc,
          })
        ).toBe(true);
        expect(
          permissions.can("document", "edit", {
            actor: admin,
            entity: confidentialDoc,
          })
        ).toBe(true);
        expect(
          permissions.can("document", "edit", {
            actor: admin,
            entity: secretDoc,
          })
        ).toBe(true);
      });

      it("should allow authors to edit their own documents", () => {
        // Editor can edit their own public doc
        expect(
          permissions.can("document", "edit", {
            actor: editor,
            entity: publicDoc,
          })
        ).toBe(true);

        // But not others' docs without proper permissions
        expect(
          permissions.can("document", "edit", {
            actor: editor,
            entity: internalDoc,
          })
        ).toBe(true); // Same dept, non-secret
        expect(
          permissions.can("document", "edit", {
            actor: editor,
            entity: secretDoc,
          })
        ).toBe(false); // Secret doc
      });

      it("should handle special admin access attributes", () => {
        expect(
          permissions.can("document", "edit", {
            actor: viewer,
            entity: secretDoc,
            attributes: {
              accessLevel: "admin",
              approvedBy: ["system-admin"],
            },
          })
        ).toBe(true);
      });
    });

    describe("Publishing documents", () => {
      const unpublishedDoc = { ...confidentialDoc, published: false };

      it("should allow appropriate roles to publish in their department", () => {
        expect(
          permissions.can("document", "publish", {
            actor: admin,
            entity: unpublishedDoc,
          })
        ).toBe(true);
        expect(
          permissions.can("document", "publish", {
            actor: editor,
            entity: unpublishedDoc,
          })
        ).toBe(true);
        expect(
          permissions.can("document", "publish", {
            actor: viewer,
            entity: unpublishedDoc,
          })
        ).toBe(false);
      });

      it("should not allow publishing already published documents", () => {
        expect(
          permissions.can("document", "publish", {
            actor: admin,
            entity: publicDoc,
          })
        ).toBe(false);
        expect(
          permissions.can("document", "publish", {
            actor: editor,
            entity: publicDoc,
          })
        ).toBe(false);
      });
    });
  });

  describe("User Management", () => {
    it("should allow users to view and edit themselves", () => {
      expect(
        permissions.can("user", "view", { actor: editor, entity: editor })
      ).toBe(true);
      expect(
        permissions.can("user", "edit", { actor: editor, entity: editor })
      ).toBe(true);
      expect(
        permissions.can("user", "view", { actor: viewer, entity: viewer })
      ).toBe(true);
      expect(
        permissions.can("user", "edit", { actor: viewer, entity: viewer })
      ).toBe(true);
    });

    it("should allow admins to manage users in their department", () => {
      expect(
        permissions.can("user", "view", { actor: admin, entity: editor })
      ).toBe(true);
      expect(
        permissions.can("user", "edit", { actor: admin, entity: editor })
      ).toBe(true);
      expect(
        permissions.can("user", "promote", { actor: admin, entity: editor })
      ).toBe(true);

      // But not users in other departments
      expect(
        permissions.can("user", "view", { actor: admin, entity: viewer })
      ).toBe(false);
      expect(
        permissions.can("user", "edit", { actor: admin, entity: viewer })
      ).toBe(false);
    });

    it("should not allow promoting other admins", () => {
      const anotherAdmin = { ...admin, id: "admin2" };
      expect(
        permissions.can("user", "promote", {
          actor: admin,
          entity: anotherAdmin,
        })
      ).toBe(false);
    });
  });

  describe("Complex workflow scenarios", () => {
    it("should handle document creation and publishing workflow", () => {
      // Editor creates a document
      expect(
        permissions.can("document", "create", {
          actor: editor,
          entity: {
            id: "",
            title: "",
            authorId: "",
            department: "",
            classification: "public",
            published: false,
            createdAt: new Date(),
          },
        })
      ).toBe(true);

      // Create an unpublished document
      const newDoc = {
        id: "new-doc",
        title: "New Document",
        authorId: editor.id,
        department: editor.department,
        classification: "internal" as const,
        published: false,
        createdAt: new Date(),
      };

      // Editor can edit their own document
      expect(
        permissions.can("document", "edit", { actor: editor, entity: newDoc })
      ).toBe(true);

      // Editor can publish it
      expect(
        permissions.can("document", "publish", {
          actor: editor,
          entity: newDoc,
        })
      ).toBe(true);

      // After publishing, can't publish again
      const publishedDoc = { ...newDoc, published: true };
      expect(
        permissions.can("document", "publish", {
          actor: editor,
          entity: publishedDoc,
        })
      ).toBe(false);

      // But can still edit
      expect(
        permissions.can("document", "edit", {
          actor: editor,
          entity: publishedDoc,
        })
      ).toBe(true);
    });

    it("should handle cross-department document sharing", () => {
      // HR viewer can't read IT internal doc
      expect(
        permissions.can("document", "read", {
          actor: viewer,
          entity: internalDoc,
        })
      ).toBe(false);

      // But with proper approval for secret doc
      expect(
        permissions.can("document", "read", {
          actor: viewer,
          entity: secretDoc,
          attributes: { approvedBy: [viewer.id] },
        })
      ).toBe(true);
    });
  });

  describe("Async permission handling", () => {
    const asyncDef = createPermissionDefinition("async-resource", {
      slowCheck: async ({ actor }: { actor: User }) => {
        // Simulate database lookup or external API call
        await new Promise((resolve) => setTimeout(resolve, 10));
        return actor.role === "admin";
      },

      fastCheck: ({ actor }: { actor: User }) => {
        return actor.role === "admin";
      },
    });

    const asyncPermissions = createPermissions([asyncDef]);

    it("should handle async permissions correctly", async () => {
      const adminResult = await asyncPermissions.can(
        "async-resource",
        "slowCheck",
        { actor: admin }
      );
      const userResult = await asyncPermissions.can(
        "async-resource",
        "slowCheck",
        { actor: viewer }
      );

      expect(adminResult).toBe(true);
      expect(userResult).toBe(false);
    });

    it("should work with both sync and async in same definition", async () => {
      // Sync method
      expect(
        asyncPermissions.can("async-resource", "fastCheck", { actor: admin })
      ).toBe(true);
      expect(
        asyncPermissions.can("async-resource", "fastCheck", { actor: viewer })
      ).toBe(false);

      // Async method
      const adminAsync = await asyncPermissions.can(
        "async-resource",
        "slowCheck",
        { actor: admin }
      );
      const userAsync = await asyncPermissions.can(
        "async-resource",
        "slowCheck",
        { actor: viewer }
      );

      expect(adminAsync).toBe(true);
      expect(userAsync).toBe(false);
    });

    it("should work with builder pattern and async", async () => {
      const adminActions = asyncPermissions.can("async-resource", {
        actor: admin,
      });
      const userActions = asyncPermissions.can("async-resource", {
        actor: viewer,
      });

      // Sync
      expect(adminActions.fastCheck()).toBe(true);
      expect(userActions.fastCheck()).toBe(false);

      // Async
      const adminSlowResult = await adminActions.slowCheck();
      const userSlowResult = await userActions.slowCheck();

      expect(adminSlowResult).toBe(true);
      expect(userSlowResult).toBe(false);
    });
  });
});
