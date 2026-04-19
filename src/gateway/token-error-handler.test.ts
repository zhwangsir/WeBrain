import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TokenErrorHandler,
  createTokenErrorHandler,
  type ErrorContext,
} from "./token-error-handler.js";

describe("TokenErrorHandler", () => {
  let handler: TokenErrorHandler;

  beforeEach(() => {
    handler = createTokenErrorHandler(10);
  });

  describe("handleError", () => {
    it("should create error context from Error object", () => {
      const error = new Error("Test error");
      const context = handler.handleError(error);
      expect(context.technicalMessage).toBe("Test error");
      expect(context.severity).toBe("medium");
      expect(context.category).toBe("unknown");
    });

    it("should use mapped message for known error codes", () => {
      const error = { code: "AUTHENTICATION_FAILED", message: "Auth failed" };
      const context = handler.handleError(error);
      expect(context.category).toBe("authentication");
      expect(context.technicalMessage).toBe("Authentication attempt failed");
    });

    it("should override properties with context parameter", () => {
      const error = new Error("Test");
      const context = handler.handleError(error, {
        severity: "critical",
        userMessage: "Custom user message",
      });
      expect(context.severity).toBe("critical");
      expect(context.userMessage).toBe("Custom user message");
    });

    it("should log error to internal log", () => {
      const error = new Error("Test error");
      handler.handleError(error);
      const logs = handler.getErrorLog();
      expect(logs.length).toBe(1);
      expect(logs[0].technicalMessage).toBe("Test error");
    });

    it("should limit log size", () => {
      for (let i = 0; i < 15; i++) {
        handler.handleError(new Error(`Error ${i}`));
      }
      const logs = handler.getErrorLog();
      expect(logs.length).toBe(10);
    });
  });

  describe("error code mappings", () => {
    it("should map ALL_SOURCES_FAILED correctly", () => {
      const error = { code: "ALL_SOURCES_FAILED", message: "All sources failed" };
      const context = handler.handleError(error);
      expect(context.category).toBe("authentication");
      expect(context.severity).toBe("critical");
      expect(context.retryable).toBe(true);
    });

    it("should map NO_CREDENTIALS correctly", () => {
      const error = { code: "NO_CREDENTIALS", message: "No credentials" };
      const context = handler.handleError(error);
      expect(context.category).toBe("authentication");
      expect(context.severity).toBe("high");
      expect(context.retryable).toBe(false);
    });

    it("should map NETWORK_ERROR correctly", () => {
      const error = { code: "NETWORK_ERROR", message: "Network error" };
      const context = handler.handleError(error);
      expect(context.category).toBe("network");
      expect(context.severity).toBe("high");
      expect(context.retryable).toBe(true);
    });

    it("should map TOKEN_EXPIRED correctly", () => {
      const error = { code: "TOKEN_EXPIRED", message: "Token expired" };
      const context = handler.handleError(error);
      expect(context.category).toBe("authentication");
      expect(context.severity).toBe("high");
      expect(context.retryable).toBe(true);
    });

    it("should map PERMISSION_DENIED correctly", () => {
      const error = { code: "PERMISSION_DENIED", message: "Permission denied" };
      const context = handler.handleError(error);
      expect(context.category).toBe("permission");
      expect(context.severity).toBe("high");
      expect(context.retryable).toBe(false);
      expect(context.recoverable).toBe(false);
    });
  });

  describe("getRecommendation", () => {
    it("should recommend retry for retryable errors", () => {
      const context: ErrorContext = {
        category: "network",
        severity: "medium",
        timestamp: Date.now(),
        retryable: true,
        recoverable: true,
        userMessage: "Network error",
        technicalMessage: "Network error",
      };
      const recommendation = handler.getRecommendation(context);
      expect(recommendation.action.type).toBe("retry");
      expect(recommendation.automaticallyExecutable).toBe(true);
    });

    it("should recommend reauthenticate for non-retryable auth errors", () => {
      const context: ErrorContext = {
        category: "authentication",
        severity: "critical",
        timestamp: Date.now(),
        retryable: false,
        recoverable: true,
        userMessage: "Auth failed",
        technicalMessage: "Auth failed",
      };
      const recommendation = handler.getRecommendation(context);
      expect(recommendation.action.type).toBe("reauthenticate");
    });

    it("should recommend fallback after multiple network errors", () => {
      handler.handleError({ code: "NETWORK_ERROR", message: "Network error" });
      handler.handleError({ code: "NETWORK_ERROR", message: "Network error" });
      handler.handleError({ code: "NETWORK_ERROR", message: "Network error" });

      const context: ErrorContext = {
        category: "network",
        severity: "high",
        timestamp: Date.now(),
        retryable: true,
        recoverable: true,
        userMessage: "Network error",
        technicalMessage: "Network error",
      };
      const recommendation = handler.getRecommendation(context);
      expect(recommendation.action.type).toBe("fallback");
    });
  });

  describe("error count tracking", () => {
    it("should track error counts by code", () => {
      handler.handleError({ code: "NETWORK_ERROR", message: "Error 1" });
      handler.handleError({ code: "NETWORK_ERROR", message: "Error 2" });
      handler.handleError({ code: "AUTH_FAILED", message: "Error 3" });

      expect(handler.getErrorCount("NETWORK_ERROR")).toBe(2);
      expect(handler.getErrorCount("AUTH_FAILED")).toBe(1);
      expect(handler.getErrorCount("UNKNOWN")).toBe(0);
    });

    it("should return total error count", () => {
      handler.handleError(new Error("Error 1"));
      handler.handleError(new Error("Error 2"));
      expect(handler.getTotalErrorCount()).toBe(2);
    });
  });

  describe("formatErrorForUser", () => {
    it("should format error with appropriate emoji for severity", () => {
      const criticalContext: ErrorContext = {
        category: "authentication",
        severity: "critical",
        timestamp: Date.now(),
        retryable: false,
        recoverable: true,
        userMessage: "Critical error occurred",
        technicalMessage: "Critical error",
      };
      const formatted = handler.formatErrorForUser(criticalContext);
      expect(formatted).toContain("🔴");
      expect(formatted).toContain("Critical error occurred");
    });

    it("should include recommendation in formatted output", () => {
      const context: ErrorContext = {
        category: "authentication",
        severity: "high",
        timestamp: Date.now(),
        retryable: false,
        recoverable: true,
        userMessage: "Please re-authenticate",
        technicalMessage: "Auth error",
      };
      const formatted = handler.formatErrorForUser(context);
      expect(formatted).toContain("Recommendation:");
    });
  });

  describe("subscribe", () => {
    it("should notify subscribers of new errors", () => {
      const listener = vi.fn();
      handler.subscribe(listener);
      handler.handleError(new Error("Test error"));
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should return unsubscribe function", () => {
      const listener = vi.fn();
      const unsubscribe = handler.subscribe(listener);
      unsubscribe();
      handler.handleError(new Error("Test error"));
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("clearErrorLog", () => {
    it("should clear all logged errors", () => {
      handler.handleError(new Error("Error 1"));
      handler.handleError(new Error("Error 2"));
      handler.clearErrorLog();
      expect(handler.getTotalErrorCount()).toBe(0);
    });
  });
});
