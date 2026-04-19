import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  SecureTokenStorage,
  createSecureTokenStorage,
  type TokenData,
} from "./secure-token-storage.js";

describe("SecureTokenStorage", () => {
  let storage: SecureTokenStorage;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `wineryclaw-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.promises.mkdir(tempDir, { recursive: true });
    storage = createSecureTokenStorage({
      storageDir: tempDir,
      encryptionEnabled: false,
      useKeychain: false,
    });
    await storage.initialize();
  });

  afterEach(async () => {
    try {
      await storage.clear();
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  });

  describe("initialize", () => {
    it("should create storage directory", async () => {
      const storagePath = storage.getStoragePath();
      const exists = await fs.promises.access(storagePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe("store and retrieve", () => {
    it("should store and retrieve token data", async () => {
      const tokenData: TokenData = {
        token: "test_token_123",
        metadata: {
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000,
        },
      };

      const storeResult = await storage.store("test-key", tokenData);
      expect(storeResult.ok).toBe(true);
      if (storeResult.ok) {
        expect(storeResult.value.token).toBe("test_token_123");
      }

      const retrieveResult = await storage.retrieve("test-key");
      expect(retrieveResult.ok).toBe(true);
      if (retrieveResult.ok) {
        expect(retrieveResult.value.token).toBe("test_token_123");
        expect(retrieveResult.value.metadata.expiresAt).toBeGreaterThan(Date.now());
      }
    });

    it("should return error for non-existent key", async () => {
      const result = await storage.retrieve("non-existent-key");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STORAGE_NOT_FOUND");
      }
    });
  });

  describe("delete", () => {
    it("should delete stored token", async () => {
      const tokenData: TokenData = {
        token: "test_token",
        metadata: { createdAt: Date.now(), expiresAt: null },
      };

      await storage.store("delete-test", tokenData);
      const deleteResult = await storage.delete("delete-test");
      expect(deleteResult.ok).toBe(true);

      const retrieveResult = await storage.retrieve("delete-test");
      expect(retrieveResult.ok).toBe(false);
    });

    it("should return error when deleting non-existent key", async () => {
      const result = await storage.delete("non-existent");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STORAGE_NOT_FOUND");
      }
    });
  });

  describe("listKeys", () => {
    it("should list all stored keys", async () => {
      await storage.store("key1", { token: "t1", metadata: { createdAt: Date.now(), expiresAt: null } });
      await storage.store("key2", { token: "t2", metadata: { createdAt: Date.now(), expiresAt: null } });
      await storage.store("key3", { token: "t3", metadata: { createdAt: Date.now(), expiresAt: null } });

      const result = await storage.listKeys();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(3);
        expect(result.value).toContain("key1");
        expect(result.value).toContain("key2");
        expect(result.value).toContain("key3");
      }
    });
  });

  describe("clear", () => {
    it("should clear all stored tokens", async () => {
      await storage.store("key1", { token: "t1", metadata: { createdAt: Date.now(), expiresAt: null } });
      await storage.store("key2", { token: "t2", metadata: { createdAt: Date.now(), expiresAt: null } });

      await storage.clear();

      const result = await storage.listKeys();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(0);
      }
    });
  });
});

describe("SecureTokenStorage validation", () => {
  let storage: SecureTokenStorage;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `wineryclaw-validate-${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });
    storage = createSecureTokenStorage({
      storageDir: tempDir,
      encryptionEnabled: false,
    });
    await storage.initialize();
  });

  afterEach(async () => {
    try {
      await storage.clear();
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  });

  it("should reject invalid token data", async () => {
    const invalidData = { not: "token" } as unknown as TokenData;
    const result = await storage.store("invalid", invalidData);
    expect(result.ok).toBe(false);
  });
});
