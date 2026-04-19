import crypto from "node:crypto";

export type TokenStatus =
  | "valid"
  | "expiring_soon"
  | "expired"
  | "missing"
  | "invalid";

export type TokenMetadata = {
  createdAt: number;
  expiresAt: number | null;
  lastRefreshedAt: number | null;
  refreshCount: number;
  tokenId: string;
};

export type TokenLifecycleState = {
  token: string | null;
  status: TokenStatus;
  metadata: TokenMetadata | null;
  error: string | null;
};

export type TokenLifecycleConfig = {
  refreshThresholdSeconds: number;
  refreshIntervalSeconds: number;
  maxRefreshAttempts: number;
  expirationWarningThresholdSeconds: number;
};

const DEFAULT_CONFIG: TokenLifecycleConfig = {
  refreshThresholdSeconds: 300,
  refreshIntervalSeconds: 60,
  maxRefreshAttempts: 3,
  expirationWarningThresholdSeconds: 600,
};

export class TokenLifecycleManager {
  private state: TokenLifecycleState;
  private config: TokenLifecycleConfig;
  private refreshTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(state: TokenLifecycleState) => void> = new Set();

  constructor(config: Partial<TokenLifecycleConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  private createInitialState(): TokenLifecycleState {
    return {
      token: null,
      status: "missing",
      metadata: null,
      error: null,
    };
  }

  getState(): TokenLifecycleState {
    return { ...this.state };
  }

  getConfig(): TokenLifecycleConfig {
    return { ...this.config };
  }

  subscribe(listener: (state: TokenLifecycleState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // Best-effort notification
      }
    }
  }

  setToken(token: string, ttlSeconds?: number): void {
    const now = Date.now();
    const metadata: TokenMetadata = {
      createdAt: now,
      expiresAt: ttlSeconds ? now + ttlSeconds * 1000 : null,
      lastRefreshedAt: null,
      refreshCount: 0,
      tokenId: crypto.randomBytes(8).toString("hex"),
    };

    this.state = {
      token,
      status: this.computeStatus(token, metadata),
      metadata,
      error: null,
    };
    this.notifyListeners();
    this.scheduleRefresh();
  }

  clearToken(): void {
    this.cancelScheduledRefresh();
    this.state = this.createInitialState();
    this.notifyListeners();
  }

  markInvalid(errorMessage?: string): void {
    this.state = {
      ...this.state,
      status: "invalid",
      error: errorMessage ?? "Token is invalid",
    };
    this.notifyListeners();
  }

  getTimeUntilExpiration(): number | null {
    if (!this.state.metadata?.expiresAt) {
      return null;
    }
    return Math.max(0, this.state.metadata.expiresAt - Date.now());
  }

  needsRefresh(): boolean {
    const { status, metadata } = this.state;
    if (status === "expired" || status === "missing" || status === "invalid") {
      return true;
    }

    if (status === "expiring_soon") {
      return true;
    }

    if (!metadata?.expiresAt) {
      return false;
    }

    const timeUntilExpiration = this.getTimeUntilExpiration();
    if (timeUntilExpiration === null) {
      return false;
    }

    return timeUntilExpiration < this.config.refreshThresholdSeconds * 1000;
  }

  private computeStatus(token: string | null, metadata: TokenMetadata | null): TokenStatus {
    if (!token) {
      return "missing";
    }

    if (!metadata?.expiresAt) {
      return "valid";
    }

    const now = Date.now();
    const timeUntilExpiration = metadata.expiresAt - now;

    if (timeUntilExpiration <= 0) {
      return "expired";
    }

    if (timeUntilExpiration < this.config.expirationWarningThresholdSeconds * 1000) {
      return "expiring_soon";
    }

    return "valid";
  }

  recordSuccessfulRefresh(newToken: string, ttlSeconds?: number): void {
    const now = Date.now();
    const metadata: TokenMetadata = {
      ...(this.state.metadata ?? {
        createdAt: now,
        tokenId: crypto.randomBytes(8).toString("hex"),
      }),
      expiresAt: ttlSeconds ? now + ttlSeconds * 1000 : null,
      lastRefreshedAt: now,
      refreshCount: (this.state.metadata?.refreshCount ?? 0) + 1,
    };

    this.state = {
      token: newToken,
      status: this.computeStatus(newToken, metadata),
      metadata,
      error: null,
    };
    this.notifyListeners();
    this.scheduleRefresh();
  }

  recordFailedRefresh(error: string): void {
    this.state = {
      ...this.state,
      status: "invalid",
      error,
    };
    this.notifyListeners();
  }

  private scheduleRefresh(): void {
    this.cancelScheduledRefresh();

    if (!this.needsRefresh()) {
      return;
    }

    const delay = this.config.refreshIntervalSeconds * 1000;
    this.refreshTimer = setTimeout(() => {
      this.notifyListeners();
    }, delay);
  }

  private cancelScheduledRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  destroy(): void {
    this.cancelScheduledRefresh();
    this.state = this.createInitialState();
    this.listeners.clear();
  }
}

export const createTokenLifecycleManager = (
  config?: Partial<TokenLifecycleConfig>,
): TokenLifecycleManager => {
  return new TokenLifecycleManager(config);
};
