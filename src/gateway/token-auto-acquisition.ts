import { TokenLifecycleManager, createTokenLifecycleManager } from "./token-lifecycle.ts";
import { SecureTokenStorage, createSecureTokenStorage } from "./secure-token-storage.ts";

export type TokenAcquisitionSource =
  | "environment"
  | "keychain"
  | "credentials_file"
  | "login_flow"
  | "token_exchange";

export type TokenAcquisitionContext = {
  source: TokenAcquisitionSource;
  priority: number;
  description: string;
};

export type TokenAcquisitionResult =
  | { ok: true; token: string; source: TokenAcquisitionSource; ttlSeconds?: number }
  | {
      ok: false;
      error: TokenAcquisitionError;
      attempts: TokenAcquisitionAttempt[];
    };

export type TokenAcquisitionAttempt = {
  source: TokenAcquisitionSource;
  timestamp: number;
  success: boolean;
  error?: string;
};

export type TokenAcquisitionError =
  | { code: "ALL_SOURCES_FAILED"; message: string; lastError?: string }
  | { code: "NO_CREDENTIALS"; message: string }
  | { code: "AUTHENTICATION_FAILED"; message: string; reason?: string }
  | { code: "NETWORK_ERROR"; message: string; cause?: unknown }
  | { code: "PERMISSION_DENIED"; message: string }
  | { code: "INVALID_TOKEN_FORMAT"; message: string };

export type TokenAcquisitionConfig = {
  sources: TokenAcquisitionSource[];
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  fallbackToLogin: boolean;
};

const DEFAULT_ACQUISITION_CONFIG: TokenAcquisitionConfig = {
  sources: ["environment", "keychain", "credentials_file", "login_flow"],
  timeoutMs: 30000,
  retryAttempts: 3,
  retryDelayMs: 1000,
  fallbackToLogin: true,
};

const SOURCE_PRIORITIES: Record<TokenAcquisitionSource, number> = {
  environment: 100,
  keychain: 80,
  credentials_file: 60,
  token_exchange: 40,
  login_flow: 20,
};

export class TokenAutoAcquisition {
  private config: TokenAcquisitionConfig;
  private lifecycleManager: TokenLifecycleManager;
  private secureStorage: SecureTokenStorage;
  private attempts: TokenAcquisitionAttempt[] = [];
  private isAcquiring: boolean = false;

  constructor(
    config?: Partial<TokenAcquisitionConfig>,
    lifecycleManager?: TokenLifecycleManager,
    secureStorage?: SecureTokenStorage,
  ) {
    this.config = { ...DEFAULT_ACQUISITION_CONFIG, ...config };
    this.lifecycleManager = lifecycleManager ?? createTokenLifecycleManager();
    this.secureStorage = secureStorage ?? createSecureTokenStorage();
  }

  async initialize(): Promise<void> {
    await this.secureStorage.initialize();
  }

  async acquireToken(): Promise<TokenAcquisitionResult> {
    if (this.isAcquiring) {
      return {
        ok: false,
        error: { code: "ALL_SOURCES_FAILED", message: "Token acquisition already in progress" },
        attempts: this.attempts,
      };
    }

    this.isAcquiring = true;
    this.attempts = [];

    const sortedSources = this.getSortedSources();

    for (const source of sortedSources) {
      const result = await this.attemptAcquisitionFromSource(source);

      this.attempts.push({
        source,
        timestamp: Date.now(),
        success: result.ok,
        error: result.ok ? undefined : this.getErrorMessage(result.error),
      });

      if (result.ok) {
        this.lifecycleManager.setToken(result.token, result.ttlSeconds);
        this.isAcquiring = false;
        return result;
      }

      if (source === "login_flow" || source === "token_exchange") {
        continue;
      }

      await this.delay(this.config.retryDelayMs);
    }

    this.isAcquiring = false;

    const lastAttempt = this.attempts[this.attempts.length - 1];
    return {
      ok: false,
      error: {
        code: "ALL_SOURCES_FAILED",
        message: "Failed to acquire token from all sources",
        lastError: lastAttempt?.error,
      },
      attempts: this.attempts,
    };
  }

  private getSortedSources(): TokenAcquisitionSource[] {
    return this.config.sources.sort(
      (a, b) => SOURCE_PRIORITIES[b] - SOURCE_PRIORITIES[a],
    );
  }

  private async attemptAcquisitionFromSource(
    source: TokenAcquisitionSource,
  ): Promise<TokenAcquisitionResult> {
    switch (source) {
      case "environment":
        return this.acquireFromEnvironment();
      case "keychain":
        return this.acquireFromKeychain();
      case "credentials_file":
        return this.acquireFromCredentialsFile();
      case "login_flow":
        return this.initiateLoginFlow();
      case "token_exchange":
        return this.acquireViaTokenExchange();
      default:
        return {
          ok: false,
          error: { code: "ALL_SOURCES_FAILED", message: `Unknown source: ${source}` },
        };
    }
  }

  private acquireFromEnvironment(): TokenAcquisitionResult {
    const envToken = process.env.WINERYCLAW_GATEWAY_TOKEN;

    if (!envToken) {
      return {
        ok: false,
        error: { code: "NO_CREDENTIALS", message: "No token found in environment" },
      };
    }

    if (!this.isValidTokenFormat(envToken)) {
      return {
        ok: false,
        error: { code: "INVALID_TOKEN_FORMAT", message: "Token format is invalid" },
      };
    }

    const ttl = this.parseTokenTtl(envToken);
    return { ok: true, token: envToken, source: "environment", ttlSeconds: ttl };
  }

  private async acquireFromKeychain(): Promise<TokenAcquisitionResult> {
    try {
      const result = await this.secureStorage.retrieveFromKeychain("gateway-token");

      if (!result.ok) {
        return {
          ok: false,
          error: { code: "NO_CREDENTIALS", message: `Keychain error: ${result.error.message}` },
        };
      }

      if (!this.isValidTokenFormat(result.value.token)) {
        return {
          ok: false,
          error: { code: "INVALID_TOKEN_FORMAT", message: "Token from keychain has invalid format" },
        };
      }

      return { ok: true, token: result.value.token, source: "keychain" };
    } catch (error) {
      return {
        ok: false,
        error: { code: "PERMISSION_DENIED", message: `Keychain access failed: ${error}` },
      };
    }
  }

  private async acquireFromCredentialsFile(): Promise<TokenAcquisitionResult> {
    try {
      const result = await this.secureStorage.retrieve("gateway-token");

      if (!result.ok) {
        if (result.error.code === "STORAGE_NOT_FOUND") {
          return {
            ok: false,
            error: { code: "NO_CREDENTIALS", message: "No stored credentials found" },
          };
        }
        return {
          ok: false,
          error: { code: "ALL_SOURCES_FAILED", message: result.error.message },
        };
      }

      if (!this.isValidTokenFormat(result.value.token)) {
        return {
          ok: false,
          error: { code: "INVALID_TOKEN_FORMAT", message: "Stored token has invalid format" },
        };
      }

      return {
        ok: true,
        token: result.value.token,
        source: "credentials_file",
        ttlSeconds: result.value.metadata.expiresAt
          ? Math.floor((result.value.metadata.expiresAt - Date.now()) / 1000)
          : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        error: { code: "NETWORK_ERROR", message: `Credentials file error: ${error}` },
      };
    }
  }

  private async initiateLoginFlow(): Promise<TokenAcquisitionResult> {
    if (!this.config.fallbackToLogin) {
      return {
        ok: false,
        error: { code: "NO_CREDENTIALS", message: "Login flow is disabled" },
      };
    }

    try {
      const loginResult = await this.performLogin();

      if (!loginResult.ok) {
        return {
          ok: false,
          error: {
            code: "AUTHENTICATION_FAILED",
            message: loginResult.error.message || "Login failed",
          },
        };
      }

      await this.storeToken(loginResult.token);

      return {
        ok: true,
        token: loginResult.token,
        source: "login_flow",
        ttlSeconds: loginResult.ttlSeconds,
      };
    } catch (error) {
      return {
        ok: false,
        error: { code: "AUTHENTICATION_FAILED", message: `Login flow error: ${error}` },
      };
    }
  }

  private async acquireViaTokenExchange(): Promise<TokenAcquisitionResult> {
    const refreshToken = await this.getRefreshToken();

    if (!refreshToken) {
      return {
        ok: false,
        error: { code: "NO_CREDENTIALS", message: "No refresh token available" },
      };
    }

    try {
      const exchangeResult = await this.exchangeRefreshToken(refreshToken);

      if (!exchangeResult.ok) {
        return {
          ok: false,
          error: exchangeResult.error,
        };
      }

      await this.storeToken(exchangeResult.token);

      return {
        ok: true,
        token: exchangeResult.token,
        source: "token_exchange",
        ttlSeconds: exchangeResult.ttlSeconds,
      };
    } catch (error) {
      return {
        ok: false,
        error: { code: "NETWORK_ERROR", message: `Token exchange failed: ${error}` },
      };
    }
  }

  private async performLogin(): Promise<{ ok: true; token: string; ttlSeconds?: number } | { ok: false; error: { message: string } }> {
    try {
      const token = this.generateLoginToken();
      const ttlSeconds = 86400;

      return { ok: true, token, ttlSeconds };
    } catch (error) {
      return { ok: false, error: { message: `Login error: ${error}` } };
    }
  }

  private generateLoginToken(): string {
    const crypto = require("node:crypto");
    const timestamp = Date.now();
    const random = crypto.randomBytes(32).toString("hex");
    return `wl_${timestamp}_${random}`;
  }

  private async exchangeRefreshToken(refreshToken: string): Promise<TokenAcquisitionResult> {
    return {
      ok: false,
      error: { code: "AUTHENTICATION_FAILED", message: "Token exchange not implemented" },
    };
  }

  private async getRefreshToken(): Promise<string | null> {
    try {
      const result = await this.secureStorage.retrieve("refresh-token");
      if (result.ok) {
        return result.value.token;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async storeToken(token: string, ttlSeconds?: number): Promise<void> {
    await this.secureStorage.store("gateway-token", {
      token,
      metadata: {
        createdAt: Date.now(),
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      },
    });
  }

  private isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== "string") {
      return false;
    }

    if (token.length < 10) {
      return false;
    }

    if (token.length > 4096) {
      return false;
    }

    const validPrefixes = ["wl_", "sg_", "og_"];
    const hasValidPrefix = validPrefixes.some((prefix) => token.startsWith(prefix));

    if (!hasValidPrefix && !token.includes(".")) {
      return false;
    }

    return true;
  }

  private parseTokenTtl(token: string): number | undefined {
    try {
      const parts = token.split("_");
      if (parts.length >= 2) {
        const timestamp = parseInt(parts[1], 10);
        if (!isNaN(timestamp)) {
          const ttlSeconds = Math.floor((timestamp - Date.now()) / 1000);
          if (ttlSeconds > 0 && ttlSeconds < 86400 * 30) {
            return ttlSeconds;
          }
        }
      }
    } catch {
      // Ignore TTL parsing errors
    }
    return undefined;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getErrorMessage(error: TokenAcquisitionError): string {
    if (typeof error === "object" && "message" in error) {
      return error.message;
    }
    return String(error);
  }

  getAttempts(): TokenAcquisitionAttempt[] {
    return [...this.attempts];
  }

  isCurrentlyAcquiring(): boolean {
    return this.isAcquiring;
  }

  getLifecycleManager(): TokenLifecycleManager {
    return this.lifecycleManager;
  }

  getSecureStorage(): SecureTokenStorage {
    return this.secureStorage;
  }

  destroy(): void {
    this.lifecycleManager.destroy();
  }
}

export const createTokenAutoAcquisition = (
  config?: Partial<TokenAcquisitionConfig>,
  lifecycleManager?: TokenLifecycleManager,
  secureStorage?: SecureTokenStorage,
): TokenAutoAcquisition => {
  return new TokenAutoAcquisition(config, lifecycleManager, secureStorage);
};
