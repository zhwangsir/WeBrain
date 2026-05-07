/**
 * Web Push Protocol — Browser push notifications
 * Uses web-push library for VAPID-based push
 */

import type { ChannelConfig, ChannelProtocol } from "./channel-manager.js";

export interface WebPushConfig extends ChannelConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string; // mailto:your-email@example.com
}

// In-memory subscription store (replace with SQLite in production)
const subscriptions = new Map<string, any>();

export const WebPushProtocol: ChannelProtocol = {
  async sendMessage(recipient: string, content: string, config: ChannelConfig) {
    const c = config as WebPushConfig;
    const webpush = await import("web-push");

    webpush.setVapidDetails(
      c.vapidSubject,
      c.vapidPublicKey,
      c.vapidPrivateKey,
    );

    const sub = subscriptions.get(recipient);
    if (!sub) {
      throw new Error(`No subscription found for ${recipient}`);
    }

    await webpush.sendNotification(sub, JSON.stringify({
      title: "WeBrain",
      body: content.slice(0, 200),
      timestamp: new Date().toISOString(),
    }));

    return { ok: true };
  },

  async connect(config: ChannelConfig) {
    const c = config as WebPushConfig;
    if (!c.vapidPublicKey || !c.vapidPrivateKey) {
      return { ok: false, error: "Missing VAPID keys" };
    }
    try {
      const webpush = await import("web-push");
      webpush.setVapidDetails(c.vapidSubject, c.vapidPublicKey, c.vapidPrivateKey);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  },

  async disconnect() {},

  async health() {
    return true;
  },
};

export function registerSubscription(userId: string, subscription: any): void {
  subscriptions.set(userId, subscription);
}

export function unregisterSubscription(userId: string): void {
  subscriptions.delete(userId);
}

export function listSubscriptions(): Array<{ userId: string; endpoint: string }> {
  return Array.from(subscriptions.entries()).map(([userId, sub]) => ({
    userId,
    endpoint: sub.endpoint || "",
  }));
}
