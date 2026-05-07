/**
 * Email Protocol — IMAP inbound + SMTP outbound
 * Uses nodemailer for SMTP and imap-simple for IMAP
 */

import type { ChannelConfig, ChannelProtocol, InboundMessage } from "./channel-manager.js";

export interface EmailConfig extends ChannelConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPass: string;
  pollInterval?: number;
}

export const EmailProtocol: ChannelProtocol = {
  async sendMessage(recipient: string, content: string, config: ChannelConfig) {
    const c = config as EmailConfig;
    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.createTransporter({
      host: c.smtpHost,
      port: c.smtpPort || 587,
      secure: c.smtpSecure ?? false,
      auth: { user: c.smtpUser, pass: c.smtpPass },
    });

    const info = await transporter.sendMail({
      from: `"WeBrain" <${c.smtpUser}>`,
      to: recipient,
      subject: "Message from WeBrain",
      text: content,
    });

    return { ok: true, messageId: info.messageId };
  },

  async connect(config: ChannelConfig) {
    const c = config as EmailConfig;
    if (!c.smtpHost || !c.smtpUser || !c.smtpPass) {
      return { ok: false, error: "Missing SMTP configuration" };
    }
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransporter({
        host: c.smtpHost,
        port: c.smtpPort || 587,
        secure: c.smtpSecure ?? false,
        auth: { user: c.smtpUser, pass: c.smtpPass },
      });
      await transporter.verify();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: `SMTP connection failed: ${err.message}` };
    }
  },

  async disconnect() {},

  async health() {
    return true;
  },
};

/**
 * Poll IMAP inbox for new messages
 */
export async function startEmailPolling(
  channelId: string,
  config: EmailConfig,
  onMessage: (msg: InboundMessage) => void,
): Promise<{ stop: () => void }> {
  const imaps = await import("imap-simple");
  let stopped = false;

  const connect = async () => {
    return imaps.connect({
      imap: {
        user: config.imapUser,
        password: config.imapPass,
        host: config.imapHost,
        port: config.imapPort || 993,
        tls: config.imapSecure ?? true,
        authTimeout: 10000,
      },
    });
  };

  let connection: any = null;

  const tick = async () => {
    if (stopped) return;
    try {
      if (!connection) {
        connection = await connect();
      }
      await connection.openBox("INBOX");
      const searchCriteria = ["UNSEEN"];
      const fetchOptions = { bodies: ["HEADER.FIELDS (FROM SUBJECT DATE)", "TEXT"], markSeen: true };
      const messages = await connection.search(searchCriteria, fetchOptions);

      for (const item of messages) {
        const header = item.parts.find((p: any) => p.which === "HEADER.FIELDS (FROM SUBJECT DATE)")?.body;
        const body = item.parts.find((p: any) => p.which === "TEXT")?.body;
        const from = header?.from?.[0] || "unknown";
        const subject = header?.subject?.[0] || "";
        const date = header?.date?.[0] || new Date().toISOString();

        onMessage({
          sender: from,
          content: `[${subject}]\n${body || ""}`,
          timestamp: new Date(date).toISOString(),
        });
      }
    } catch (err: any) {
      console.error(`[email-poll] error:`, err.message);
      connection = null;
    }
  };

  await tick();
  const interval = setInterval(tick, config.pollInterval || 30000);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
      if (connection) {
        connection.end();
        connection = null;
      }
    },
  };
}
