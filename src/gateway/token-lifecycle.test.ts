import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TokenLifecycleManager,
  createTokenLifecycleManager,
  type TokenLifecycleState,
  type TokenLifecycleConfig,
} from "./token-lifecycle.js";

describe("TokenLifecycleManager", () => {
  let manager: TokenLifecycleManager;

  beforeEach(() => {
    manager = createTokenLifecycleManager({
      refreshThresholdSeconds: 300,
      refreshIntervalSeconds: 60,
      maxRefreshAttempts: 3,
      expirationWarningThresholdSeconds: 600,
    });
  });

  describe("initialization", () => {
    it("should create initial state with missing token", () => {
      const state = manager.getState();
      expect(state.token).toBeNull();
      expect(state.status).toBe("missing");
      expect(state.metadata).toBeNull();
      expect(state.error).toBeNull();
    });

    it("should use custom config when provided", () => {
      const customManager = createTokenLifecycleManager({
        refreshThresholdSeconds: 600,
        expirationWarningThresholdSeconds: 1200,
      });
      const config = customManager.getConfig();
      expect(config.refreshThresholdSeconds).toBe(600);
      expect(config.expirationWarningThresholdSeconds).toBe(1200);
    });
  });

  describe("setToken", () => {
    it("should set token and compute valid status when no expiry", () => {
      manager.setToken("test_token_123");
      const state = manager.getState();
      expect(state.token).toBe("test_token_123");
      expect(state.status).toBe("valid");
      expect(state.metadata).not.toBeNull();
      expect(state.metadata?.expiresAt).toBeNull();
    });

    it("should set token with TTL and compute correct status", () => {
      manager.setToken("test_token_123", 3600);
      const state = manager.getState();
      expect(state.status).toBe("valid");
      expect(state.metadata?.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should set token as expiring_soon when TTL is below threshold", () => {
      manager.setToken("test_token_123", 100);
      const state = manager.getState();
      expect(state.status).toBe("expiring_soon");
    });

    it("should notify listeners when token is set", () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.setToken("test_token");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(manager.getState());
    });
  });

  describe("clearToken", () => {
    it("should clear token and reset to initial state", () => {
      manager.setToken("test_token");
      manager.clearToken();
      const state = manager.getState();
      expect(state.token).toBeNull();
      expect(state.status).toBe("missing");
    });

    it("should cancel scheduled refresh when clearing token", () => {
      manager.setToken("test_token", 7200);
      manager.clearToken();
      expect(manager.needsRefresh()).toBe(true);
    });
  });

  describe("markInvalid", () => {
    it("should mark token as invalid with error message", () => {
      manager.setToken("test_token");
      manager.markInvalid("Token validation failed");
      const state = manager.getState();
      expect(state.status).toBe("invalid");
      expect(state.error).toBe("Token validation failed");
    });
  });

  describe("needsRefresh", () => {
    it("should return true when token is missing", () => {
      expect(manager.needsRefresh()).toBe(true);
    });

    it("should return true when token is expired", () => {
      manager.setToken("test_token", -1);
      expect(manager.needsRefresh()).toBe(true);
    });

    it("should return true when token is expiring soon", () => {
      manager.setToken("test_token", 100);
      expect(manager.needsRefresh()).toBe(true);
    });

    it("should return false when token is valid with sufficient TTL", () => {
      manager.setToken("test_token", 7200);
      expect(manager.needsRefresh()).toBe(false);
    });

    it("should return false when token is valid without expiry", () => {
      manager.setToken("test_token");
      expect(manager.needsRefresh()).toBe(false);
    });
  });

  describe("recordSuccessfulRefresh", () => {
    it("should update token and increment refresh count", () => {
      manager.setToken("original_token");
      manager.recordSuccessfulRefresh("refreshed_token", 3600);
      const state = manager.getState();
      expect(state.token).toBe("refreshed_token");
      expect(state.metadata?.refreshCount).toBe(1);
      expect(state.metadata?.lastRefreshedAt).not.toBeNull();
    });
  });

  describe("recordFailedRefresh", () => {
    it("should mark token as invalid with error", () => {
      manager.setToken("test_token");
      manager.recordFailedRefresh("Refresh failed due to network error");
      const state = manager.getState();
      expect(state.status).toBe("invalid");
      expect(state.error).toBe("Refresh failed due to network error");
    });
  });

  describe("getTimeUntilExpiration", () => {
    it("should return null when no expiry is set", () => {
      manager.setToken("test_token");
      expect(manager.getTimeUntilExpiration()).toBeNull();
    });

    it("should return positive value for valid token with TTL", () => {
      manager.setToken("test_token", 3600);
      const timeUntil = manager.getTimeUntilExpiration();
      expect(timeUntil).not.toBeNull();
      expect(timeUntil!).toBeGreaterThan(0);
      expect(timeUntil!).toBeLessThanOrEqual(3600 * 1000);
    });

    it("should return 0 for expired token", () => {
      manager.setToken("test_token", -1);
      expect(manager.getTimeUntilExpiration()).toBe(0);
    });
  });

  describe("subscriber cleanup", () => {
    it("should return unsubscribe function", () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);
      unsubscribe();
      manager.setToken("test_token");
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("should cancel timers and clear listeners", () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.setToken("test_token");
      manager.destroy();
      const state = manager.getState();
      expect(state.token).toBeNull();
      expect(state.status).toBe("missing");
    });
  });
});

describe("TokenLifecycleManager edge cases", () => {
  it("should handle very long TTL", () => {
    const manager = createTokenLifecycleManager();
    manager.setToken("test_token", 86400 * 365);
    const state = manager.getState();
    expect(state.status).toBe("valid");
  });

  it("should handle very short TTL", () => {
    const manager = createTokenLifecycleManager();
    manager.setToken("test_token", 1);
    const state = manager.getState();
    expect(state.status).toBe("expiring_soon");
  });

  it("should handle concurrent token updates", () => {
    const manager = createTokenLifecycleManager();
    manager.setToken("token_1");
    manager.setToken("token_2");
    manager.setToken("token_3");
    const state = manager.getState();
    expect(state.token).toBe("token_3");
    expect(state.metadata?.refreshCount).toBe(0);
  });
});
