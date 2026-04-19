import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export type SecureStorageConfig = {
  storageDir: string;
  encryptionEnabled: boolean;
  useKeychain: boolean;
  fileMode: number;
  dirMode: number;
};

const DEFAULT_CONFIG: SecureStorageConfig = {
  storageDir: ".wineryclaw-secure",
  encryptionEnabled: true,
  useKeychain: false,
  fileMode: 0o600,
  dirMode: 0o700,
};

export type TokenData = {
  token: string;
  metadata: {
    createdAt: number;
    expiresAt: number | null;
    refreshToken?: string;
    tokenType?: string;
  };
};

export type SecureStorageResult =
  | { ok: true; value: TokenData }
  | { ok: false; error: SecureStorageError };

export type SecureStorageError =
  | { code: "STORAGE_NOT_FOUND"; message: string }
  | { code: "STORAGE_READ_ERROR"; message: string; cause?: unknown }
  | { code: "STORAGE_WRITE_ERROR"; message: string; cause?: unknown }
  | { code: "STORAGE_PERMISSION_ERROR"; message: string; cause?: unknown }
  | { code: "STORAGE_ENCRYPTION_ERROR"; message: string; cause?: unknown }
  | { code: "STORAGE_DECRYPTION_ERROR"; message: string; cause?: unknown }
  | { code: "KEYCHAIN_ERROR"; message: string; cause?: unknown }
  | { code: "INVALID_TOKEN_DATA"; message: string };

export class SecureTokenStorage {
  private config: SecureStorageConfig;
  private storagePath: string;
  private keychainService: string = "WineryClaw";

  constructor(config?: Partial<SecureStorageConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storagePath = this.resolveStoragePath();
  }

  private resolveStoragePath(): string {
    const baseDir =
      process.env.WINERYCLAW_SECURE_STORAGE_DIR ??
      path.join(os.homedir(), ".wineryclaw");
    return path.join(baseDir, this.config.storageDir);
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureStorageDirectory();
      if (this.config.useKeychain) {
        await this.verifyKeychainAccess();
      }
    } catch (error) {
      throw new Error(`Failed to initialize secure storage: ${error}`);
    }
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.storagePath, {
        mode: this.config.dirMode,
        recursive: true,
      });
      await this.lockDirectory();
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }

  private async lockDirectory(): Promise<void> {
    const platform = process.platform;
    if (platform === "darwin" || platform === "linux") {
      try {
        await fs.promises.chmod(this.storagePath, this.config.dirMode);
      } catch {
        // Best-effort permission locking
      }
    }
  }

  private getTokenFilePath(key: string): string {
    const safeKey = this.sanitizeKey(key);
    return path.join(this.storagePath, `${safeKey}.json.enc`);
  }

  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  private validateTokenData(data: unknown): data is TokenData {
    if (typeof data !== "object" || data === null) {
      return false;
    }
    const d = data as Record<string, unknown>;
    return (
      typeof d.token === "string" &&
      typeof d.metadata === "object" &&
      d.metadata !== null &&
      typeof (d.metadata as Record<string, unknown>).createdAt === "number"
    );
  }

  async store(key: string, data: TokenData): Promise<SecureStorageResult> {
    if (!this.validateTokenData(data)) {
      return {
        ok: false,
        error: { code: "INVALID_TOKEN_DATA", message: "Token data validation failed" },
      };
    }

    try {
      const filePath = this.getTokenFilePath(key);
      const serialized = JSON.stringify(data);

      let stored: string;
      if (this.config.encryptionEnabled) {
        stored = this.encrypt(serialized);
      } else {
        stored = serialized;
      }

      await fs.promises.writeFile(filePath, stored, {
        mode: this.config.fileMode,
        flag: "w",
      });

      await this.lockFile(filePath);

      return { ok: true, value: data };
    } catch (error: unknown) {
      return this.handleStorageError("STORAGE_WRITE_ERROR", error);
    }
  }

  async retrieve(key: string): Promise<SecureStorageResult> {
    try {
      const filePath = this.getTokenFilePath(key);
      const exists = await this.fileExists(filePath);

      if (!exists) {
        return {
          ok: false,
          error: { code: "STORAGE_NOT_FOUND", message: `Token not found for key: ${key}` },
        };
      }

      const content = await fs.promises.readFile(filePath, "utf8");
      let deserialized: string;

      if (this.config.encryptionEnabled) {
        deserialized = this.decrypt(content);
      } else {
        deserialized = content;
      }

      const data = JSON.parse(deserialized) as TokenData;

      if (!this.validateTokenData(data)) {
        return {
          ok: false,
          error: { code: "INVALID_TOKEN_DATA", message: "Token data validation failed" },
        };
      }

      return { ok: true, value: data };
    } catch (error: unknown) {
      if ((error as SecureStorageError & { code?: string }).code === "STORAGE_NOT_FOUND") {
        return error as SecureStorageResult;
      }
      return this.handleStorageError("STORAGE_READ_ERROR", error);
    }
  }

  async delete(key: string): Promise<SecureStorageResult> {
    try {
      const filePath = this.getTokenFilePath(key);
      const exists = await this.fileExists(filePath);

      if (!exists) {
        return {
          ok: false,
          error: { code: "STORAGE_NOT_FOUND", message: `Token not found for key: ${key}` },
        };
      }

      await this.secureDelete(filePath);
      return { ok: true, value: { token: "", metadata: { createdAt: 0, expiresAt: null } } };
    } catch (error: unknown) {
      return this.handleStorageError("STORAGE_WRITE_ERROR", error);
    }
  }

  async listKeys(): Promise<{ ok: true; value: string[] } | { ok: false; error: SecureStorageError }> {
    try {
      const files = await fs.promises.readdir(this.storagePath);
      const keys = files
        .filter((f) => f.endsWith(".json.enc"))
        .map((f) => f.slice(0, -9));
      return { ok: true, value: keys };
    } catch (error: unknown) {
      return this.handleStorageError("STORAGE_READ_ERROR", error);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async lockFile(filePath: string): Promise<void> {
    const platform = process.platform;
    if (platform === "darwin" || platform === "linux") {
      try {
        await fs.promises.chmod(filePath, this.config.fileMode);
      } catch {
        // Best-effort permission locking
      }
    }
  }

  private async secureDelete(filePath: string): Promise<void> {
    const platform = process.platform;
    if (platform === "darwin") {
      try {
        const { execSync } = await import("node:child_process");
        execSync(`rm -P "${filePath}"`, { stdio: "pipe" });
        return;
      } catch {
        // Fall through to basic deletion
      }
    }
    await fs.promises.unlink(filePath);
  }

  private encrypt(content: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(content, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString("hex"),
      data: encrypted,
      tag: authTag.toString("hex"),
    });
  }

  private decrypt(encryptedContent: string): string {
    try {
      const { iv: ivHex, data, tag } = JSON.parse(encryptedContent);
      const key = this.getEncryptionKey();
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(tag, "hex");

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(data, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      return this.handleStorageError("STORAGE_DECRYPTION_ERROR", error);
    }
  }

  private getEncryptionKey(): Buffer {
    const envKey = process.env.WINERYCLAW_TOKEN_ENCRYPTION_KEY;
    if (envKey) {
      return crypto.createHash("sha256").update(envKey).digest();
    }

    const machineId = this.getMachineIdentifier();
    const salt = "WineryClaw-TokenEncryption-v1";
    return crypto.createHash("sha256").update(machineId + salt).digest();
  }

  private getMachineIdentifier(): string {
    const platform = process.platform;
    if (platform === "darwin") {
      try {
        const { execSync } = require("node:child_process");
        const result = execSync(
          "ioreg -rd1 -c IOPlatformExpertDevice | grep -o 'IOPlatformUUID' | head -1 && ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID | cut -d\\\"\\\" -f4",
          { encoding: "utf8", maxBuffer: 1024 * 1024 }
        );
        return result.trim();
      } catch {
        // Fall through to default
      }
    }

    return os.homedir() + os.arch() + os.platform();
  }

  private async verifyKeychainAccess(): Promise<void> {
    if (process.platform !== "darwin") {
      return;
    }

    try {
      const { execSync } = await import("node:child_process");
      execSync(
        `security find-generic-password -s "${this.keychainService}" -w`,
        { encoding: "utf8", stdio: "pipe" }
      );
    } catch {
      // Keychain may not have entry yet, which is fine
    }
  }

  async storeInKeychain(account: string, password: string): Promise<SecureStorageResult> {
    if (process.platform !== "darwin") {
      return {
        ok: false,
        error: { code: "KEYCHAIN_ERROR", message: "Keychain is only available on macOS" },
      };
    }

    try {
      const { execSync } = await import("node:child_process");
      const escapedPassword = password.replace(/'/g, "'\\''");
      const escapedService = this.keychainService.replace(/'/g, "'\\''");
      const escapedAccount = account.replace(/'/g, "'\\''");

      execSync(
        `security add-generic-password -s "${escapedService}" -a "${escapedAccount}" -w "${escapedPassword}" -U`,
        { encoding: "utf8", stdio: "pipe" }
      );

      return {
        ok: true,
        value: {
          token: password,
          metadata: { createdAt: Date.now(), expiresAt: null },
        },
      };
    } catch (error: unknown) {
      return {
        ok: false,
        error: { code: "KEYCHAIN_ERROR", message: `Keychain storage failed: ${error}`, cause: error },
      };
    }
  }

  async retrieveFromKeychain(account: string): Promise<SecureStorageResult> {
    if (process.platform !== "darwin") {
      return {
        ok: false,
        error: { code: "KEYCHAIN_ERROR", message: "Keychain is only available on macOS" },
      };
    }

    try {
      const { execSync } = await import("node:child_process");
      const escapedService = this.keychainService.replace(/'/g, "'\\''");
      const escapedAccount = account.replace(/'/g, "'\\''");

      const password = execSync(
        `security find-generic-password -s "${escapedService}" -a "${escapedAccount}" -w`,
        { encoding: "utf8", stdio: "pipe" }
      ).trim();

      return {
        ok: true,
        value: {
          token: password,
          metadata: { createdAt: Date.now(), expiresAt: null },
        },
      };
    } catch (error: unknown) {
      return {
        ok: false,
        error: { code: "KEYCHAIN_ERROR", message: `Keychain retrieval failed: ${error}`, cause: error },
      };
    }
  }

  private handleStorageError(code: SecureStorageError["code"], error: unknown): SecureStorageResult {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT" || err.code === "STORAGE_NOT_FOUND") {
      return { ok: false, error: { code: "STORAGE_NOT_FOUND", message: String(error) } };
    }
    if (err.code === "EACCES" || err.code === "EPERM") {
      return { ok: false, error: { code: "STORAGE_PERMISSION_ERROR", message: String(error), cause: error } };
    }
    return { ok: false, error: { code, message: String(error), cause: error } };
  }

  getStoragePath(): string {
    return this.storagePath;
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.listKeys();
      if (keys.ok) {
        for (const key of keys.value) {
          await this.delete(key);
        }
      }
    } catch {
      // Best-effort cleanup
    }
  }
}

export const createSecureTokenStorage = (
  config?: Partial<SecureStorageConfig>,
): SecureTokenStorage => {
  return new SecureTokenStorage(config);
};
