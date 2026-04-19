import { createPairingPrefixStripper } from "openclaw/plugin-sdk/channel-pairing";
import { PAIRING_APPROVED_MESSAGE } from "openclaw/plugin-sdk/channel-status";
import type { WineryClawConfig } from "./runtime-api.js";
import { normalizeBlueBubblesHandle } from "./targets.js";

type SendBlueBubblesMessage = (
  id: string,
  message: string,
  params: {
    cfg: WineryClawConfig;
    accountId?: string;
  },
) => Promise<unknown>;

export function createBlueBubblesPairingText(sendMessageBlueBubbles: SendBlueBubblesMessage) {
  return {
    idLabel: "bluebubblesSenderId",
    message: PAIRING_APPROVED_MESSAGE,
    normalizeAllowEntry: createPairingPrefixStripper(/^bluebubbles:/i, normalizeBlueBubblesHandle),
    notify: async ({
      cfg,
      id,
      message,
      accountId,
    }: {
      cfg: WineryClawConfig;
      id: string;
      message: string;
      accountId?: string;
    }) => {
      await sendMessageBlueBubbles(id, message, {
        cfg,
        accountId,
      });
    },
  };
}
