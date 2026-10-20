import { useSyncExternalStore } from "react";

const query = "(prefers-color-scheme: dark)";
const subscribe = (listener) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};
const snapshot = () => window.matchMedia(query).matches;

// Public appearance is owned by the venue. It never writes to the owner's app theme.
export function useWebsiteAppearance(preference = "system", supportsDarkMode = true) {
  const systemDark = useSyncExternalStore(subscribe, snapshot, () => false);
  if (!supportsDarkMode) return "light";
  return preference === "system"
    ? systemDark
      ? "dark"
      : "light"
    : preference === "dark"
      ? "dark"
      : "light";
}
