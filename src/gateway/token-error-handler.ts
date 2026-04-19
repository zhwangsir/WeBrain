export type ErrorSeverity = "critical" | "high" | "medium" | "low" | "info";

export type ErrorCategory =
  | "authentication"
  | "authorization"
  | "network"
  | "storage"
  | "validation"
  | "timeout"
  | "permission"
  | "unknown";

export type ErrorContext = {
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: number;
  retryable: boolean;
  recoverable: boolean;
  userMessage: string;
  technicalMessage: string;
  cause?: unknown;
  stack?: string;
  metadata?: Record<string, unknown>;
};

export type ErrorAction =
  | { type: "retry"; delayMs?: number; maxAttempts?: number }
  | { type: "fallback" }
  | { type: "reauthenticate" }
  | { type: "ignore" }
  | { type: "escalate" }
  | { type: "logout" };

export type ErrorRecommendation = {
  action: ErrorAction;
  message: string;
  automaticallyExecutable: boolean;
};

export type TokenErrorDetails = {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  recoverable: boolean;
  userMessage: string;
  technicalDetails?: string;
  resolution?: string;
  documentation?: string;
};

const ERROR_CODE_MAPPINGS: Record<string, TokenErrorDetails> = {
  ALL_SOURCES_FAILED: {
    code: "ALL_SOURCES_FAILED",
    message: "Failed to acquire token from all configured sources",
    category: "authentication",
    severity: "critical",
    retryable: true,
    recoverable: true,
    userMessage: "Unable to authenticate. All credential sources have failed.",
    technicalDetails: "Token acquisition attempted environment, keychain, credentials file, and login flow without success.",
    resolution: "Check environment variables, verify keychain access, or re-authenticate manually.",
    documentation: "https://docs.wineryclaw.ai/authentication/troubleshooting",
  },
  NO_CREDENTIALS: {
    code: "NO_CREDENTIALS",
    message: "No credentials available for authentication",
    category: "authentication",
    severity: "high",
    retryable: false,
    recoverable: true,
    userMessage: "No authentication credentials found. Please log in.",
    technicalDetails: "No token was found in any configured storage location.",
    resolution: "Run 'wineryclaw login' to authenticate, or set WINERYCLAW_GATEWAY_TOKEN environment variable.",
    documentation: "https://docs.wineryclaw.ai/authentication/getting-started",
  },
  AUTHENTICATION_FAILED: {
    code: "AUTHENTICATION_FAILED",
    message: "Authentication attempt failed",
    category: "authentication",
    severity: "critical",
    retryable: true,
    recoverable: true,
    userMessage: "Authentication failed. Please check your credentials and try again.",
    technicalDetails: "The authentication server rejected the provided credentials.",
    resolution: "Verify your credentials are correct and have not expired. Re-authenticate if necessary.",
    documentation: "https://docs.wineryclaw.ai/authentication/credentials",
  },
  TOKEN_EXPIRED: {
    code: "TOKEN_EXPIRED",
    message: "Authentication token has expired",
    category: "authentication",
    severity: "high",
    retryable: true,
    recoverable: true,
    userMessage: "Your session has expired. Attempting to refresh automatically...",
    technicalDetails: "The provided token has passed its expiration time and cannot be used for authentication.",
    resolution: "Token will be automatically refreshed if a refresh token is available. Otherwise, re-authentication will be required.",
    documentation: "https://docs.wineryclaw.ai/authentication/token-lifecycle",
  },
  TOKEN_INVALID: {
    code: "TOKEN_INVALID",
    message: "Authentication token is invalid",
    category: "authentication",
    severity: "critical",
    retryable: false,
    recoverable: true,
    userMessage: "Your authentication token is invalid. Please log in again.",
    technicalDetails: "The token format is incorrect or the token has been revoked.",
    resolution: "Clear your stored credentials and re-authenticate using 'wineryclaw login'.",
    documentation: "https://docs.wineryclaw.ai/authentication/token-lifecycle",
  },
  NETWORK_ERROR: {
    code: "NETWORK_ERROR",
    message: "Network error occurred during authentication",
    category: "network",
    severity: "high",
    retryable: true,
    recoverable: true,
    userMessage: "Network error occurred. Retrying...",
    technicalDetails: "Failed to connect to authentication server due to network issues.",
    resolution: "Check your internet connection and firewall settings. Automatic retry will be attempted.",
    documentation: "https://docs.wineryclaw.ai/troubleshooting/network-issues",
  },
  TIMEOUT: {
    code: "TIMEOUT",
    message: "Authentication request timed out",
    category: "timeout",
    severity: "medium",
    retryable: true,
    recoverable: true,
    userMessage: "Authentication request timed out. Retrying with a longer timeout...",
    technicalDetails: "The authentication server did not respond within the expected time.",
    resolution: "Try again. If the problem persists, the authentication server may be experiencing high load.",
    documentation: "https://docs.wineryclaw.ai/troubleshooting/timeout-issues",
  },
  PERMISSION_DENIED: {
    code: "PERMISSION_DENIED",
    message: "Permission denied when accessing credentials",
    category: "permission",
    severity: "high",
    retryable: false,
    recoverable: false,
    userMessage: "Permission denied. Unable to access stored credentials.",
    technicalDetails: "The process does not have permission to read/write to the secure storage location.",
    resolution: "Check file permissions for ~/.openclaw or the configured secure storage directory.",
    documentation: "https://docs.wineryclaw.ai/troubleshooting/permission-issues",
  },
  STORAGE_ERROR: {
    code: "STORAGE_ERROR",
    message: "Error accessing secure storage",
    category: "storage",
    severity: "high",
    retryable: true,
    recoverable: true,
    userMessage: "Error accessing secure storage. Retrying...",
    technicalDetails: "Failed to read from or write to the secure token storage.",
    resolution: "Check disk space and permissions. Restart the application if the problem persists.",
    documentation: "https://docs.wineryclaw.ai/troubleshooting/storage-issues",
  },
  MAX_ATTEMPTS_EXCEEDED: {
    code: "MAX_ATTEMPTS_EXCEEDED",
    message: "Maximum authentication attempts exceeded",
    category: "authentication",
    severity: "critical",
    retryable: false,
    recoverable: true,
    userMessage: "Too many failed attempts. Please wait before trying again.",
    technicalDetails: "The number of consecutive authentication failures has exceeded the configured threshold.",
    resolution: "Wait for the cooldown period to expire, or restart the application to reset the attempt counter.",
    documentation: "https://docs.wineryclaw.ai/authentication/rate-limiting",
  },
};

export class TokenErrorHandler {
  private errorLog: ErrorContext[] = [];
  private listeners: Set<(context: ErrorContext) => void> = new Set();
  private maxLogSize: number;
  private errorCounts: Map<string, number> = new Map();

  constructor(maxLogSize: number = 100) {
    this.maxLogSize = maxLogSize;
  }

  handleError(error: unknown, context?: Partial<ErrorContext>): ErrorContext {
    const errorContext = this.createErrorContext(error, context);
    this.logError(errorContext);
    this.notifyListeners(errorContext);
    return errorContext;
  }

  private createErrorContext(error: unknown, context?: Partial<ErrorContext>): ErrorContext {
    const errorCode = this.extractErrorCode(error);
    const errorDetails = ERROR_CODE_MAPPINGS[errorCode] ?? this.createDefaultErrorDetails(error);

    return {
      category: context?.category ?? errorDetails.category,
      severity: context?.severity ?? errorDetails.severity,
      timestamp: Date.now(),
      retryable: context?.retryable ?? errorDetails.retryable,
      recoverable: context?.recoverable ?? errorDetails.recoverable,
      userMessage: context?.userMessage ?? errorDetails.userMessage,
      technicalMessage: context?.technicalMessage ?? errorDetails.message,
      cause: error,
      stack: error instanceof Error ? error.stack : undefined,
      metadata: context?.metadata,
    };
  }

  private extractErrorCode(error: unknown): string {
    if (typeof error === "object" && error !== null) {
      const e = error as Record<string, unknown>;
      if (typeof e.code === "string") {
        return e.code;
      }
      if (typeof e.message === "string") {
        const msg = e.message.toUpperCase();
        for (const code of Object.keys(ERROR_CODE_MAPPINGS)) {
          if (msg.includes(code.replace(/_/g, " "))) {
            return code;
          }
        }
      }
    }
    return "UNKNOWN";
  }

  private createDefaultErrorDetails(error: unknown): TokenErrorDetails {
    return {
      code: "UNKNOWN",
      message: error instanceof Error ? error.message : String(error),
      category: "unknown",
      severity: "medium",
      retryable: true,
      recoverable: true,
      userMessage: "An unexpected error occurred. Please try again.",
      technicalDetails: error instanceof Error ? error.toString() : String(error),
    };
  }

  getRecommendation(errorContext: ErrorContext): ErrorRecommendation {
    if (!errorContext.retryable) {
      if (errorContext.category === "authentication") {
        return {
          action: { type: "reauthenticate" },
          message: "Re-authentication required",
          automaticallyExecutable: true,
        };
      }
      return {
        action: { type: "escalate" },
        message: "Error cannot be automatically resolved",
        automaticallyExecutable: false,
      };
    }

    if (errorContext.severity === "critical") {
      return {
        action: { type: "reauthenticate" },
        message: "Critical error requires re-authentication",
        automaticallyExecutable: true,
      };
    }

    if (errorContext.category === "network") {
      const currentCount = this.errorCounts.get("NETWORK_ERROR") ?? 0;
      if (currentCount >= 3) {
        return {
          action: { type: "fallback" },
          message: "Multiple network failures - attempting fallback",
          automaticallyExecutable: true,
        };
      }
      return {
        action: { type: "retry", delayMs: 2000 * (currentCount + 1) },
        message: "Retrying network operation",
        automaticallyExecutable: true,
      };
    }

    return {
      action: { type: "retry", delayMs: 1000 },
      message: "Retrying operation",
      automaticallyExecutable: true,
    };
  }

  private logError(context: ErrorContext): void {
    const code = this.extractErrorCode(context.cause);
    const currentCount = this.errorCounts.get(code) ?? 0;
    this.errorCounts.set(code, currentCount + 1);

    this.errorLog.push(context);
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }
  }

  private notifyListeners(context: ErrorContext): void {
    for (const listener of this.listeners) {
      try {
        listener(context);
      } catch {
        // Best-effort notification
      }
    }
  }

  subscribe(listener: (context: ErrorContext) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getErrorLog(): ErrorContext[] {
    return [...this.errorLog];
  }

  getErrorCount(code: string): number {
    return this.errorCounts.get(code) ?? 0;
  }

  getTotalErrorCount(): number {
    return this.errorLog.length;
  }

  clearErrorLog(): void {
    this.errorLog = [];
    this.errorCounts.clear();
  }

  formatErrorForUser(errorContext: ErrorContext): string {
    let message = errorContext.userMessage;

    if (errorContext.severity === "critical") {
      message = `🔴 ${message}`;
    } else if (errorContext.severity === "high") {
      message = `🟠 ${message}`;
    } else if (errorContext.severity === "medium") {
      message = `🟡 ${message}`;
    } else {
      message = `🔵 ${message}`;
    }

    const recommendation = this.getRecommendation(errorContext);
    message += `\n\nRecommendation: ${recommendation.message}`;

    if (recommendation.action.type === "retry" && recommendation.action.delayMs) {
      message += ` (retrying in ${Math.floor(recommendation.action.delayMs / 1000)}s)`;
    }

    return message;
  }

  formatErrorForTechnical(errorContext: ErrorContext): string {
    let details = `[${errorContext.category.toUpperCase()}] ${errorContext.technicalMessage}`;
    details += `\nSeverity: ${errorContext.severity}`;
    details += `\nTimestamp: ${new Date(errorContext.timestamp).toISOString()}`;
    details += `\nRetryable: ${errorContext.retryable}`;
    details += `\nRecoverable: ${errorContext.recoverable}`;

    if (errorContext.cause) {
      details += `\nCause: ${errorContext.cause}`;
    }

    return details;
  }
}

export const createTokenErrorHandler = (maxLogSize?: number): TokenErrorHandler => {
  return new TokenErrorHandler(maxLogSize);
};
