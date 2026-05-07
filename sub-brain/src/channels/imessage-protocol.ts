/**
 * iMessage Protocol — macOS Messages.app integration
 * Uses AppleScript to send messages and polls ~/Library/Messages/chat.db for inbound
 */

import { execSync, spawn } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import type { ChannelConfig, ChannelProtocol, InboundMessage } from "./channel-manager.js";

const CHAT_DB = `${homedir()}/Library/Messages/chat.db`;

export const IMessageProtocol: ChannelProtocol = {
  async sendMessage(recipient: string, content: string, _config: ChannelConfig) {
    if (process.platform !== "darwin") {
      throw new Error("iMessage is only available on macOS");
    }

    const script = `
      tell application "Messages"
        set targetService to 1st service whose service type = iMessage
        set targetBuddy to buddy "${recipient.replace(/"/g, '\\"')}" of targetService
        send "${content.replace(/"/g, '\\"').replace(/\n/g, "\\n")}" to targetBuddy
      end tell
    `;

    try {
      execSync(`osascript -e '${script}'`, { timeout: 15000 });
      return { ok: true };
    } catch (err: any) {
      throw new Error(`iMessage send failed: ${err.message}`);
    }
  },

  async connect(config: ChannelConfig) {
    if (process.platform !== "darwin") {
      return { ok: false, error: "iMessage is only available on macOS" };
    }
    if (!existsSync(CHAT_DB)) {
      return { ok: false, error: "Messages database not found" };
    }
    return { ok: true };
  },

  async disconnect() {},

  async health() {
    return process.platform === "darwin" && existsSync(CHAT_DB);
  },
};

/**
 * Poll iMessage chat.db for new inbound messages.
 * Uses sqlite3 CLI to avoid native module dependency.
 */
export function startIMessagePolling(
  channelId: string,
  handle: string,
  onMessage: (msg: InboundMessage) => void,
  lastReadId: number = 0,
): { stop: () => void } {
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    try {
      const sql = `SELECT message.ROWID, message.text, message.date, handle.id as sender
        FROM message
        JOIN handle ON message.handle_id = handle.ROWID
        WHERE message.ROWID > ${lastReadId}
          AND handle.id = '${handle.replace(/'/g, "''")}'
          AND message.is_from_me = 0
        ORDER BY message.ROWID ASC
        LIMIT 50;`;

      const output = execSync(
        `sqlite3 "${CHAT_DB}" -json '${sql}'`,
        { encoding: "utf-8", timeout: 5000 },
      );

      const rows = output.trim() ? JSON.parse(output) : [];
      for (const row of rows) {
        lastReadId = Math.max(lastReadId, row.ROWID);
        onMessage({
          sender: row.sender || "unknown",
          content: row.text || "",
          timestamp: new Date((row.date / 1e9) + 978307200 * 1000).toISOString(),
        });
      }
    } catch (err: any) {
      // Silent fail — will retry next tick
    }
  };

  tick();
  const interval = setInterval(tick, 3000);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
    },
  };
}
