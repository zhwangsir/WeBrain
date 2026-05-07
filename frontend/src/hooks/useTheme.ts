/**
 * Theme hook — syncs systemStore theme to <html data-theme>
 * Binary light / dark. Defaults to dark.
 */

import { useEffect } from "react";
import { useSystemStore } from "../stores/systemStore";

export function useThemeSync() {
  const { theme } = useSystemStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
}

export function useIsDark(): boolean {
  const { theme } = useSystemStore();
  return theme === "dark";
}
