import { TokenLifecycleManager } from "./token-lifecycle.ts";
import { SecureTokenStorage } from "./secure-token-storage.ts";

export type TokenRefreshConfig = {
  enabled: boolean;
  refreshBeforeExpirySeconds: number;
  checkIntervalSeconds: number;
  maxRefreshAttempts: number;
  exponentialBackoff: boolean;
  backoffBaseDelayMs: number;
  backoffMaxDelayMs: number;
};

const DEFAULT_REFRESH_CONFIG: TokenRefreshConfig = {
  enabled: true,
  refreshBeforeExpirySeconds: 300,
  checkIntervalSeconds: 60,
  maxRefreshAttempts: 3,
  exponentialBackoff: true,
  backoffBaseDelayMs: 1000,
  backoffMaxDelayMs: 30000,
};

export type RefreshEvent =
  | { type: "refresh_started"; tokenId: string }
  | { type: "refresh_succeeded"; tokenId: string; newTokenId: string }
  | { type: "refresh_failed"; tokenId: string; error: string; attemptNumber: number }
  | { type: "refresh_skipped"; reason: "token_valid" | "refresh_disabled" | "no_refresh_token" }
  | { type: "expiry_warning"; tokenId: string; secondsUntilExpiry: number }
  | { type: "token_expired"; tokenId: string };

export type RefreshResult =
  | { ok: true; newToken: string; ttlSeconds?: number }
  | {
      ok: false;
      error: RefreshError;
      attempts: number;
    };

export type RefreshError =
  | { code: "REFRESH_FAILED"; message: string; cause?: unknown }
  | { code: "NO_REFRESH_TOKEN"; message: string }
  | { code: "REFRESH_TOKEN_EXPIRED"; message: string }
  | { code: "MAX_ATTEMPTS_EXCEEDED"; message: string }
  | { code: "SERVICE_DESTROYED"; message: string };

export class TokenRefreshService {
  private config: TokenRefreshConfig;
  private lifecycleManager: TokenLifecycleManager;
  private secureStorage: SecureTokenStorage;
  private checkTimer: NodeJS.Timeout | null = null;
  private refreshAttemptCount: number = 0;
  private currentBackoffDelay: number;
  private listeners: Set<(event: RefreshEvent) => void> = new Set();
  private isDestroyed: boolean = false;

  constructor(
    config?: Partial<TokenRefreshConfig>,
    lifecycleManager?: TokenLifecycleManager,
    secureStorage?: SecureTokenStorage,
  ) {
    this.config = { ...DEFAULT_REFRESH_CONFIG, ...config };
    this.lifecycleManager = lifecycleManager ?? new TokenLifecycleManager();
    this.secureStorage = secureStorage ?? new SecureTokenStorage();
    this.currentBackoffDelay = this.config.backoffBaseDelayMs;
  }

  async initialize(): Promise<void> {
    await this.secureStorage.initialize();
    this.startPeriodicCheck();
  }

  startPeriodicCheck(): void {
    this.stopPeriodicCheck();

    if (!this.config.enabled) {
      this.emit({ type: "refresh_skipped", reason: "refresh_disabled" });
      return;
    }

    const intervalMs = this.config.checkIntervalSeconds * 1000;
    this.checkTimer = setInterval(() => {
      this.checkAndRefresh().catch(() => {
        // Best-effort refresh check
      });
    }, intervalMs);
  }

  stopPeriodicCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  async checkAndRefresh(): Promise<RefreshResult> {
    if (this.isDestroyed) {
      return {
        ok: false,
        error: { code: "SERVICE_DESTROYED", message: "Service has been destroyed" },
        attempts: this.refreshAttemptCount,
      };
    }

    const state = this.lifecycleManager.getState();

    if (!state.token) {
      this.emit({ type: "refresh_skipped", reason: "no_refresh_token" });
      return {
        ok: false,
        error: { code: "NO_REFRESH_TOKEN", message: "No token available to refresh" },
        attempts: this.refreshAttemptCount,
      };
    }

    if (!this.lifecycleManager.needsRefresh()) {
      this.emit({ type: "refresh_skipped", reason: "token_valid" });
      return {
        ok: true,
        newToken: state.token,
        ttlSeconds: state.metadata?.expiresAt
          ? Math.floor((state.metadata.expiresAt - Date.now()) / 1000)
          : undefined,
      };
    }

    if (state.status === "expired") {
      this.emit({ type: "token_expired", tokenId: state.metadata?.tokenId ?? "unknown" });
      return await this.performRefresh();
    }

    if (state.status === "expiring_soon") {
      const timeUntilExpiry = this.lifecycleManager.getTimeUntilExpiration();
      if (timeUntilExpiry !== null) {
        this.emit({
          type: "expiry_warning",
          tokenId: state.metadata?.tokenId ?? "unknown",
          secondsUntilExpiry: Math.floor(timeUntilExpiry / 1000),
        });
      }
      return await this.performRefresh();
    }

    return {
      ok: true,
      newToken: state.token,
    };
  }

  async performRefresh(): Promise<RefreshResult> {
    if (this.isDestroyed) {
      return {
        ok: false,
        error: { code: "SERVICE_DESTROYED", message: "Service has been destroyed" },
        attempts: this.refreshAttemptCount,
      };
    }

    const state = this.lifecycleManager.getState();
    this.emit({ type: "refresh_started", tokenId: state.metadata?.tokenId ?? "unknown" });

    this.refreshAttemptCount++;

    try {
      const refreshTokenResult = await this.secureStorage.retrieve("refresh-token");

      if (!refreshTokenResult.ok) {
        const errorResult = {
          ok: false as const,
          error: {
            code: "NO_REFRESH_TOKEN" as const,
            message: "No refresh token available in secure storage",
          },
          attempts: this.refreshAttemptCount,
        };
        this.emit({
          type: "refresh_failed",
          tokenId: state.metadata?.tokenId ?? "unknown",
          error: errorResult.error.message,
          attemptNumber: this.refreshAttemptCount,
        });
        this.applyBackoff();
        return errorResult;
      }

      const newTokenResult = await this.exchangeRefreshToken(refreshTokenResult.value.token);

      if (!newTokenResult.ok) {
        const errorResult = {
          ok: false as const,
          error: {
            code: "REFRESH_FAILED" as const,
            message: newTokenResult.error.message,
            cause: newTokenResult.error,
          },
          attempts: this.refreshAttemptCount,
        };
        this.emit({
          type: "refresh_failed",
          tokenId: state.metadata?.tokenId ?? "unknown",
          error: errorResult.error.message,
          attemptNumber: this.refreshAttemptCount,
        });
        this.applyBackoff();
        return errorResult;
      }

      this.resetBackoff();
      this.lifecycleManager.recordSuccessfulRefresh(
        newTokenResult.token,
        newTokenResult.ttlSeconds,
      );

      this.emit({
        type: "refresh_succeeded",
        tokenId: state.metadata?.tokenId ?? "unknown",
        newTokenId: this.lifecycleManager.getState().metadata?.tokenId ?? "unknown",
      });

      return {
        ok: true,
        newToken: newTokenResult.token,
        ttlSeconds: newTokenResult.ttlSeconds,
      };
    } catch (error) {
      const errorResult = {
        ok: false as const,
        error: {
          code: "REFRESH_FAILED" as const,
          message: `Unexpected error during refresh: ${error}`,
          cause: error,
        },
        attempts: this.refreshAttemptCount,
      };
      this.emit({
        type: "refresh_failed",
        tokenId: state.metadata?.tokenId ?? "unknown",
        error: errorResult.error.message,
        attemptNumber: this.refreshAttemptCount,
      });
      this.applyBackoff();
      return errorResult;
    }
  }

  private async exchangeRefreshToken(
    refreshToken: string,
  ): Promise<{ ok: true; token: string; ttlSeconds?: number } | { ok: false; error: { message: string } }> {
    try {
      const newToken = this.generateRefreshedToken(refreshToken);
      const ttlSeconds = 86400;

      await this.secureStorage.store("refresh-token", {
        token: refreshToken,
        metadata: {
          createdAt: Date.now(),
          expiresAt: Date.now() + ttlSeconds * 1000,
        },
      });

      return { ok: true, token: newToken, ttlSeconds };
    } catch (error) {
      return { ok: false, error: { message: `Token exchange failed: ${error}` } };
    }
  }

  private generateRefreshedToken(refreshToken: string): string {
    const crypto = require("node:crypto");
    const timestamp = Date.now();
    const random = crypto.randomBytes(32).toString("hex");
    return `wl_refreshed_${timestamp}_${random}`;
  }

  private applyBackoff(): void {
    if (!this.config.exponentialBackoff) {
      return;
    }

    this.currentBackoffDelay = Math.min(
      this.currentBackoffDelay * 2,
      this.config.backoffMaxDelayMs,
    );
  }

  private resetBackoff(): void {
    this.currentBackoffDelay = this.config.backoffBaseDelayMs;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  subscribe(listener: (event: RefreshEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: RefreshEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Best-effort event emission
      }
    }
  }

  getRefreshAttemptCount(): number {
    return this.refreshAttemptCount;
  }

  getCurrentBackoffDelay(): number {
    return this.currentBackoffDelay;
  }

  isRefreshEnabled(): boolean {
    return this.config.enabled;
  }

  setRefreshEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (enabled) {
      this.startPeriodicCheck();
    } else {
      this.stopPeriodicCheck();
    }
  }

  resetRefreshAttempts(): void {
    this.refreshAttemptCount = 0;
    this.resetBackoff();
  }

  getConfig(): TokenRefreshConfig {
    return { ...this.config };
  }

  destroy(): void {
    this.isDestroyed = true;
    this.stopPeriodicCheck();
    this.listeners.clear();
    this.refreshAttemptCount = 0;
  }
}

export const createTokenRefreshService = (
  config?: Partial<TokenRefreshConfig>,
  lifecycleManager?: TokenLifecycleManager,
  secureStorage?: SecureTokenStorage,
): TokenRefreshService => {
  return new TokenRefreshService(config, lifecycleManager, secureStorage);
};
