import { vi } from "vitest";
import { installChromeUserDataDirHooks } from "./chrome-user-data-dir.test-harness.js";

const chromeUserDataDir = { dir: "/tmp/openclaw" };
installChromeUserDataDirHooks(chromeUserDataDir);

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: vi.fn(async () => true),
  isChromeReachable: vi.fn(async () => true),
  launchWineryClawChrome: vi.fn(async () => {
    throw new Error("unexpected launch");
  }),
  resolveWineryClawUserDataDir: vi.fn(() => chromeUserDataDir.dir),
  stopWineryClawChrome: vi.fn(async () => {}),
}));
