import { TokenAutoAcquisition } from "./token-auto-acquisition.ts";
import { TokenRefreshService } from "./token-refresh-service.ts";
import { TokenLifecycleManager } from "./token-lifecycle.ts";
import { SecureTokenStorage } from "./secure-token-storage.ts";

export type SeamlessLoginConfig = {
  enabled: boolean;
  autoAcquisitionEnabled: boolean;
  autoRefreshEnabled: boolean;
  backgroundRefreshEnabled: boolean;
  maxLoginAttempts: number;
  loginTimeoutMs: number;
  showProgressNotifications: boolean;
  allowManualLogin: boolean;
};

const DEFAULT_LOGIN_CONFIG: SeamlessLoginConfig = {
  enabled: true,
  autoAcquisitionEnabled: true,
  autoRefreshEnabled: true,
  backgroundRefreshEnabled: true,
  maxLoginAttempts: 3,
  loginTimeoutMs: 60000,
  showProgressNotifications: true,
  allowManualLogin: true,
};

export type LoginStage =
  | "idle"
  | "acquiring_token"
  | "validating_token"
  | "refreshing_token"
  | "performing_login"
  | "authenticated"
  | "failed";

export type LoginProgress = {
  stage: LoginStage;
  progress: number;
  message: string;
  error?: string;
  attemptsRemaining?: number;
};

export type LoginResult =
  | { ok: true; token: string; authenticatedAt: number; method: "auto" | "manual" }
  | { ok: false; error: LoginError; stage: LoginStage };

export type LoginError =
  | { code: "NO_CREDENTIALS"; message: string }
  | { code: "AUTHENTICATION_FAILED"; message: string; reason?: string }
  | { code: "NETWORK_ERROR"; message: string; cause?: unknown }
  | { code: "TIMEOUT"; message: string }
  | { code: "MAX_ATTEMPTS_EXCEEDED"; message: string }
  | { code: "SERVICE_UNAVAILABLE"; message: string };

export type LoginEvent =
  | { type: "login_started" }
  | { type: "login_stage_changed"; stage: LoginStage; message?: string }
  | { type: "login_progress"; progress: LoginProgress }
  | { type: "login_succeeded"; method: "auto" | "manual"; duration: number }
  | { type: "login_failed"; error: LoginError; stage: LoginStage; attempts: number }
  | { type: "token_expiring_soon"; secondsRemaining: number }
  | { type: "token_expired"; wasAutoRefreshing: boolean }
  | { type: "logout_completed" };

export class SeamlessLoginFlow {
  private config: SeamlessLoginConfig;
  private tokenAcquisition: TokenAutoAcquisition;
  private tokenRefresh: TokenRefreshService;
  private lifecycleManager: TokenLifecycleManager;
  private secureStorage: SecureTokenStorage;
  private currentStage: LoginStage = "idle";
  private loginAttempts: number = 0;
  private authenticatedAt: number | null = null;
  private listeners: Set<(event: LoginEvent) => void> = new Set();
  private progressListeners: Set<(progress: LoginProgress) => void> = new Set();
  private isDestroyed: boolean = false;

  constructor(
    config?: Partial<SeamlessLoginConfig>,
    tokenAcquisition?: TokenAutoAcquisition,
    tokenRefresh?: TokenRefreshService,
    lifecycleManager?: TokenLifecycleManager,
    secureStorage?: SecureTokenStorage,
  ) {
    this.config = { ...DEFAULT_LOGIN_CONFIG, ...config };
    this.lifecycleManager = lifecycleManager ?? new TokenLifecycleManager();
    this.secureStorage = secureStorage ?? new SecureTokenStorage();
    this.tokenAcquisition =
      tokenAcquisition ??
      new TokenAutoAcquisition({}, this.lifecycleManager, this.secureStorage);
    this.tokenRefresh =
      tokenRefresh ??
      new TokenRefreshService({}, this.lifecycleManager, this.secureStorage);

    this.setupLifecycleSubscription();
    this.setupRefreshSubscription();
  }

  async initialize(): Promise<void> {
    await this.tokenAcquisition.initialize();
    await this.secureStorage.initialize();

    if (this.config.autoRefreshEnabled && this.config.backgroundRefreshEnabled) {
      await this.tokenRefresh.initialize();
    }
  }

  private setupLifecycleSubscription(): void {
    this.lifecycleManager.subscribe((state) => {
      if (state.status === "expiring_soon") {
        const timeUntilExpiry = this.lifecycleManager.getTimeUntilExpiration();
        if (timeUntilExpiry !== null) {
          this.emit({
            type: "token_expiring_soon",
            secondsRemaining: Math.floor(timeUntilExpiry / 1000),
          });
        }
      } else if (state.status === "expired") {
        this.emit({ type: "token_expired", wasAutoRefreshing: this.config.autoRefreshEnabled });
        if (this.config.autoAcquisitionEnabled && !this.isDestroyed) {
          this.authenticate().catch(() => {
            // Best-effort re-authentication
          });
        }
      }
    });
  }

  private setupRefreshSubscription(): void {
    this.tokenRefresh.subscribe((event) => {
      switch (event.type) {
        case "refresh_succeeded":
          this.emit({
            type: "login_succeeded",
            method: "auto",
            duration: Date.now() - (this.authenticatedAt ?? Date.now()),
          });
          break;
        case "refresh_failed":
          this.notifyProgress({
            stage: "failed",
            progress: 100,
            message: `Token refresh failed: ${event.error}`,
            error: event.error,
          });
          break;
        case "token_expired":
          this.emit({ type: "token_expired", wasAutoRefreshing: false });
          break;
      }
    });
  }

  async authenticate(): Promise<LoginResult> {
    if (this.isDestroyed) {
      return {
        ok: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "Login service has been destroyed" },
        stage: this.currentStage,
      };
    }

    if (this.loginAttempts >= this.config.maxLoginAttempts) {
      return {
        ok: false,
        error: { code: "MAX_ATTEMPTS_EXCEEDED", message: "Maximum login attempts exceeded" },
        stage: this.currentStage,
      };
    }

    this.loginAttempts++;
    const startTime = Date.now();
    this.emit({ type: "login_started" });

    try {
      if (this.config.autoAcquisitionEnabled) {
        const acquisitionResult = await this.performAutoAcquisition();
        if (!acquisitionResult.ok) {
          return this.handleAcquisitionFailure(acquisitionResult, startTime);
        }
      }

      const validationResult = await this.validateCurrentToken();
      if (!validationResult.ok) {
        return this.handleValidationFailure(validationResult, startTime);
      }

      return this.handleSuccessfulLogin("auto", startTime);
    } catch (error) {
      return this.handleUnexpectedError(error, startTime);
    }
  }

  private async performAutoAcquisition(): Promise<
    { ok: true; token: string } | { ok: false; error: { message: string } }
  > {
    this.setStage("acquiring_token");
    this.notifyProgress({
      stage: "acquiring_token",
      progress: 10,
      message: "Acquiring authentication token...",
      attemptsRemaining: this.config.maxLoginAttempts - this.loginAttempts,
    });

    if (this.config.autoRefreshEnabled && this.lifecycleManager.needsRefresh()) {
      const refreshResult = await this.tokenRefresh.performRefresh();
      if (refreshResult.ok) {
        return { ok: true, token: refreshResult.newToken };
      }
    }

    const acquisitionResult = await this.tokenAcquisition.acquireToken();

    if (acquisitionResult.ok) {
      this.notifyProgress({
        stage: "acquiring_token",
        progress: 30,
        message: "Token acquired successfully",
      });
      return { ok: true, token: acquisitionResult.token };
    }

    return {
      ok: false,
      error: { message: this.getErrorMessage(acquisitionResult.error) },
    };
  }

  private async validateCurrentToken(): Promise<{ ok: true } | { ok: false; error: { message: string } }> {
    this.setStage("validating_token");
    this.notifyProgress({
      stage: "validating_token",
      progress: 50,
      message: "Validating token...",
    });

    const state = this.lifecycleManager.getState();

    if (!state.token) {
      return { ok: false, error: { message: "No token available" } };
    }

    if (state.status === "expired") {
      return { ok: false, error: { message: "Token has expired" } };
    }

    if (state.status === "invalid") {
      return { ok: false, error: { message: state.error ?? "Token is invalid" } };
    }

    this.notifyProgress({
      stage: "validating_token",
      progress: 70,
      message: "Token validated",
    });

    return { ok: true };
  }

  private handleAcquisitionFailure(
    result: { ok: false; error: { message: string } },
    startTime: number,
  ): LoginResult {
    const duration = Date.now() - startTime;

    if (result.error.message.includes("Login flow") || result.error.message.includes("authentication")) {
      this.setStage("performing_login");
      this.notifyProgress({
        stage: "performing_login",
        progress: 80,
        message: "Performing login...",
      });

      const loginResult = this.performSeamlessLogin();
      if (loginResult.ok) {
        return this.handleSuccessfulLogin("auto", startTime);
      }

      return this.handleLoginFailure(loginResult, startTime);
    }

    return this.handleLoginFailure(
      { ok: false, error: { code: "AUTHENTICATION_FAILED", message: result.error.message } },
      startTime,
    );
  }

  private handleValidationFailure(
    result: { ok: false; error: { message: string } },
    startTime: number,
  ): LoginResult {
    return this.handleLoginFailure(
      { ok: false, error: { code: "AUTHENTICATION_FAILED", message: result.error.message } },
      startTime,
    );
  }

  private handleUnexpectedError(error: unknown, startTime: number): LoginResult {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("timeout") || errorMessage.includes("TIMEOUT")) {
      return {
        ok: false,
        error: { code: "TIMEOUT", message: `Login timed out: ${errorMessage}` },
        stage: this.currentStage,
      };
    }

    if (errorMessage.includes("network") || errorMessage.includes("ECONNREFUSED")) {
      return {
        ok: false,
        error: { code: "NETWORK_ERROR", message: `Network error during login: ${errorMessage}`, cause: error },
        stage: this.currentStage,
      };
    }

    return {
      ok: false,
      error: { code: "AUTHENTICATION_FAILED", message: `Unexpected error: ${errorMessage}`, cause: error },
      stage: this.currentStage,
    };
  }

  private handleLoginFailure(
    result: { ok: false; error: { code: string; message: string } },
    startTime: number,
  ): LoginResult {
    const duration = Date.now() - startTime;
    const errorCode = result.error.code as LoginError["code"];

    this.setStage("failed");
    this.emit({
      type: "login_failed",
      error: {
        code: errorCode,
        message: result.error.message,
      },
      stage: this.currentStage,
      attempts: this.loginAttempts,
    });

    return {
      ok: false,
      error: {
        code: errorCode,
        message: result.error.message,
      },
      stage: this.currentStage,
    };
  }

  private handleSuccessfulLogin(method: "auto" | "manual", startTime: number): LoginResult {
    const duration = Date.now() - startTime;
    this.authenticatedAt = Date.now();

    this.setStage("authenticated");
    this.emit({
      type: "login_succeeded",
      method,
      duration,
    });

    this.notifyProgress({
      stage: "authenticated",
      progress: 100,
      message: "Authentication successful",
    });

    return {
      ok: true,
      token: this.lifecycleManager.getState().token!,
      authenticatedAt: this.authenticatedAt,
      method,
    };
  }

  private performSeamlessLogin(): { ok: true } | { ok: false; error: { code: string; message: string } } {
    try {
      const state = this.lifecycleManager.getState();
      if (state.token) {
        return { ok: true };
      }
      return { ok: false, error: { code: "AUTHENTICATION_FAILED", message: "No token after seamless login" } };
    } catch (error) {
      return { ok: false, error: { code: "AUTHENTICATION_FAILED", message: String(error) } };
    }
  }

  private setStage(stage: LoginStage): void {
    this.currentStage = stage;
    this.emit({ type: "login_stage_changed", stage, message: this.getStageMessage(stage) });
  }

  private getStageMessage(stage: LoginStage): string {
    switch (stage) {
      case "idle":
        return "Idle";
      case "acquiring_token":
        return "Acquiring token...";
      case "validating_token":
        return "Validating token...";
      case "refreshing_token":
        return "Refreshing token...";
      case "performing_login":
        return "Performing seamless login...";
      case "authenticated":
        return "Authenticated";
      case "failed":
        return "Authentication failed";
    }
  }

  private getErrorMessage(error: unknown): string {
    if (typeof error === "object" && error !== null && "message" in error) {
      return String((error as { message: unknown }).message);
    }
    return String(error);
  }

  private notifyProgress(progress: LoginProgress): void {
    if (!this.config.showProgressNotifications) {
      return;
    }

    for (const listener of this.progressListeners) {
      try {
        listener(progress);
      } catch {
        // Best-effort notification
      }
    }
  }

  subscribe(listener: (event: LoginEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeToProgress(listener: (progress: LoginProgress) => void): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  private emit(event: LoginEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Best-effort event emission
      }
    }
  }

  getCurrentStage(): LoginStage {
    return this.currentStage;
  }

  getLoginAttempts(): number {
    return this.loginAttempts;
  }

  getAuthenticatedAt(): number | null {
    return this.authenticatedAt;
  }

  isAuthenticated(): boolean {
    return this.currentStage === "authenticated" && this.authenticatedAt !== null;
  }

  async logout(): Promise<void> {
    this.lifecycleManager.clearToken();
    await this.secureStorage.delete("gateway-token");
    this.authenticatedAt = null;
    this.setStage("idle");
    this.emit({ type: "logout_completed" });
  }

  getTokenLifecycleManager(): TokenLifecycleManager {
    return this.lifecycleManager;
  }

  getTokenRefreshService(): TokenRefreshService {
    return this.tokenRefresh;
  }

  destroy(): void {
    this.isDestroyed = true;
    this.tokenAcquisition.destroy();
    this.tokenRefresh.destroy();
    this.listeners.clear();
    this.progressListeners.clear();
    this.loginAttempts = 0;
  }
}

export const createSeamlessLoginFlow = (
  config?: Partial<SeamlessLoginConfig>,
  tokenAcquisition?: TokenAutoAcquisition,
  tokenRefresh?: TokenRefreshService,
  lifecycleManager?: TokenLifecycleManager,
  secureStorage?: SecureTokenStorage,
): SeamlessLoginFlow => {
  return new SeamlessLoginFlow(
    config,
    tokenAcquisition,
    tokenRefresh,
    lifecycleManager,
    secureStorage,
  );
};
