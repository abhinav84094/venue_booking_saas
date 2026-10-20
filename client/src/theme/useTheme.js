import { useSyncExternalStore } from "react";
import {
  getTheme,
  getServerTheme,
  getThemePreference,
  getServerThemePreference,
  subscribeTheme,
} from "./themeStore";

export function useTheme() {
  return useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
}

export function useThemePreference() {
  return useSyncExternalStore(subscribeTheme, getThemePreference, getServerThemePreference);
}
