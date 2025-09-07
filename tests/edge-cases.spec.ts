import { describe, it, expect } from "bun:test";
import { createPermissionDefinition, createPermissions } from "../src/index";

// Test edge cases and error conditions

describe("Edge Cases", () => {
  describe("Empty and minimal configurations", () => {
    it("should handle empty permissions", () => {
      const permissions = createPermissions([]);
      expect(permissions).toBeDefined();
      expect(typeof permissions.get).toBe("function");
      expect(typeof permissions.can).toBe("function");
    });

    it("should handle permission definition with single action", () => {
      const singleActionDef = createPermissionDefinition("minimal", {
        action: ({ actor }: { actor: { id: string } }) =>
          actor.id === "allowed",
      });

      const permissions = createPermissions([singleActionDef]);
      const allowedActor = { id: "allowed" };
      const deniedActor = { id: "denied" };

      expect(
        permissions.can("minimal", "action", { actor: allowedActor })
      ).toBe(true);
      expect(permissions.can("minimal", "action", { actor: deniedActor })).toBe(
        false
      );
    });

    it("should handle permission definition with many actions", () => {
      const manyActionsDef = createPermissionDefinition("many", {
        action1: ({ actor }: { actor: { role: string } }) =>
          actor.role === "admin",
        action2: ({ actor }: { actor: { role: string } }) =>
          actor.role === "user",
        action3: ({ actor }: { actor: { role: string } }) =>
          actor.role === "guest",
        action4: ({ actor }: { actor: { role: string } }) => true,
        action5: ({ actor }: { actor: { role: string } }) => false,
      });

      const permissions = createPermissions([manyActionsDef]);
      const admin = { role: "admin" };
      const user = { role: "user" };
      const guest = { role: "guest" };

      // Test new API
      expect(permissions.can("many", "action1", { actor: admin })).toBe(true);
      expect(permissions.can("many", "action1", { actor: user })).toBe(false);
      expect(permissions.can("many", "action2", { actor: user })).toBe(true);
      expect(permissions.can("many", "action3", { actor: guest })).toBe(true);
      expect(permissions.can("many", "action4", { actor: guest })).toBe(true);
      expect(permissions.can("many", "action5", { actor: admin })).toBe(false);

      // Test original API
      const adminActions = permissions.can("many", { actor: admin });
      expect(adminActions.action1()).toBe(true);
      expect(adminActions.action2()).toBe(false);
      expect(adminActions.action4()).toBe(true);
      expect(adminActions.action5()).toBe(false);
    });
  });

  describe("Parameter edge cases", () => {
    const testDef = createPermissionDefinition("test", {
      withOptionals: ({
        actor,
        entity,
        attributes,
      }: {
        actor: { id: string };
        entity?: { name?: string };
        attributes?: { flag?: boolean };
      }) => {
        return (
          actor.id === "admin" ||
          entity?.name === "public" ||
          attributes?.flag === true
        );
      },
      actorOnly: ({ actor }: { actor: { id: string } }) => actor.id === "valid",
    });

    const permissions = createPermissions([testDef]);

    it("should handle undefined entity and attributes", () => {
      const actor = { id: "user" };

      // New API
      expect(permissions.can("test", "actorOnly", { actor })).toBe(false);
      expect(permissions.can("test", "withOptionals", { actor })).toBe(false);

      // Original API
      const actions = permissions.can("test", { actor });
      expect(actions.actorOnly()).toBe(false);
      expect(actions.withOptionals()).toBe(false);
    });

    it("should handle null and undefined values in context", () => {
      const actor = { id: "admin" };

      // Test with null entity
      expect(
        permissions.can("test", "withOptionals", {
          actor,
          entity: null as any,
        })
      ).toBe(true);

      // Test with undefined attributes
      expect(
        permissions.can("test", "withOptionals", {
          actor,
          entity: { name: "private" },
          attributes: undefined,
        })
      ).toBe(true);
    });

    it("should handle empty objects", () => {
      const actor = { id: "user" };
      const emptyEntity = {};
      const emptyAttributes = {};

      expect(
        permissions.can("test", "withOptionals", {
          actor,
          entity: emptyEntity,
          attributes: emptyAttributes,
        })
      ).toBe(false);
    });
  });

  describe("Action signature detection", () => {
    const testDef = createPermissionDefinition("signature-test", {
      test: ({ actor }: { actor: { id: string } }) => actor.id === "valid",
    });

    const permissions = createPermissions([testDef]);

    it("should correctly detect new signature with string action", () => {
      const actor = { id: "valid" };

      // This should use the new signature
      const result = permissions.can("signature-test", "test", { actor });
      expect(result).toBe(true);
    });

    it("should correctly detect original signature with object context", () => {
      const actor = { id: "valid" };

      // This should use the original signature
      const result = permissions.can("signature-test", { actor });
      expect(typeof result.test).toBe("function");
      expect(result.test()).toBe(true);
    });

    it("should handle edge case where context could be confused with action", () => {
      // Create a context object that has a string property that could be mistaken for an action
      const contextThatLooksLikeAction = { actor: { id: "valid" } };

      // This should still use the original signature because there's no third parameter
      const result = permissions.can(
        "signature-test",
        contextThatLooksLikeAction
      );
      expect(typeof result.test).toBe("function");
      expect(result.test()).toBe(true);
    });
  });

  describe("Resource name edge cases", () => {
    it("should handle resource names with special characters", () => {
      const specialDef = createPermissionDefinition(
        "special-resource_name.123",
        {
          action: ({ actor }: { actor: { id: string } }) => true,
        }
      );

      const permissions = createPermissions([specialDef]);
      const actor = { id: "test" };

      expect(
        permissions.can("special-resource_name.123", "action", { actor })
      ).toBe(true);
      expect(
        permissions.get("special-resource_name.123").can(actor).action()
      ).toBe(true);
    });

    it("should handle very long resource names", () => {
      const longResourceName = "a".repeat(100);
      const longDef = createPermissionDefinition(longResourceName, {
        action: ({ actor }: { actor: { id: string } }) => true,
      });

      const permissions = createPermissions([longDef]);
      const actor = { id: "test" };

      expect(permissions.can(longResourceName, "action", { actor })).toBe(true);
    });
  });

  describe("Handler return value edge cases", () => {
    const edgeCaseDef = createPermissionDefinition("edge-returns", {
      returnsTrue: () => true,
      returnsFalse: () => false,
      returnsUndefined: () => undefined as any,
      returnsNull: () => null as any,
      returnsZero: () => 0 as any,
      returnsEmptyString: () => "" as any,
      returnsObject: () => ({ result: true } as any),
    });

    const permissions = createPermissions([edgeCaseDef]);
    const actor = { id: "test" };

    it("should handle various return values correctly", () => {
      expect(permissions.can("edge-returns", "returnsTrue", { actor })).toBe(
        true
      );
      expect(permissions.can("edge-returns", "returnsFalse", { actor })).toBe(
        false
      );
      expect(
        permissions.can("edge-returns", "returnsUndefined", { actor })
      ).toBeUndefined();
      expect(
        permissions.can("edge-returns", "returnsNull", { actor })
      ).toBeNull();
      expect(permissions.can("edge-returns", "returnsZero", { actor })).toBe(0);
      expect(
        permissions.can("edge-returns", "returnsEmptyString", { actor })
      ).toBe("");
      expect(
        permissions.can("edge-returns", "returnsObject", { actor })
      ).toEqual({ result: true });
    });
  });

  describe("Multiple resources with same actions", () => {
    const postDef = createPermissionDefinition("post", {
      create: ({ actor }: { actor: { role: string } }) =>
        actor.role === "admin",
      read: ({ actor }: { actor: { role: string } }) => true,
    });

    const commentDef = createPermissionDefinition("comment", {
      create: ({ actor }: { actor: { role: string } }) =>
        actor.role !== "banned",
      read: ({ actor }: { actor: { role: string } }) => true,
    });

    const permissions = createPermissions([postDef, commentDef]);

    it("should handle different logic for same action names across resources", () => {
      const admin = { role: "admin" };
      const user = { role: "user" };
      const banned = { role: "banned" };

      // Post permissions
      expect(permissions.can("post", "create", { actor: admin })).toBe(true);
      expect(permissions.can("post", "create", { actor: user })).toBe(false);
      expect(permissions.can("post", "read", { actor: banned })).toBe(true);

      // Comment permissions
      expect(permissions.can("comment", "create", { actor: admin })).toBe(true);
      expect(permissions.can("comment", "create", { actor: user })).toBe(true);
      expect(permissions.can("comment", "create", { actor: banned })).toBe(
        false
      );
      expect(permissions.can("comment", "read", { actor: banned })).toBe(true);
    });
  });
});
