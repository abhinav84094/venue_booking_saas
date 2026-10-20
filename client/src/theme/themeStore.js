export const THEME_STORAGE_KEY = "prakash-venue-theme";
export const THEME_PREFERENCES = ["light", "dark", "system"];
const listeners = new Set();
const media = window.matchMedia("(prefers-color-scheme: dark)");
let publicPreference =
  document.querySelector?.('meta[name="venue-appearance"]')?.content ||
  document.documentElement.dataset.websiteAppearance;
const normalize = (value) => (THEME_PREFERENCES.includes(value) ? value : "system");
let preference = "system";
let systemDark = media.matches;
try {
  preference = normalize(window.localStorage.getItem(THEME_STORAGE_KEY));
} catch {
  /* Theme still works when storage is unavailable. */
}
let theme = resolveTheme();

function resolveTheme() {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

function applyTheme() {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  if (THEME_PREFERENCES.includes(publicPreference)) {
    document.documentElement.dataset.publicAppearance =
      publicPreference === "system" ? (systemDark ? "dark" : "light") : publicPreference;
  } else delete document.documentElement.dataset.publicAppearance;
  document.documentElement.style.colorScheme =
    document.documentElement.dataset.publicAppearance || theme;
}
function emit() {
  theme = resolveTheme();
  applyTheme();
  listeners.forEach((listener) => listener());
}
applyTheme();

export const getTheme = () => theme;
export const getThemePreference = () => preference;
export const getServerTheme = () => "light";
export const getServerThemePreference = () => "system";
// Public website appearance is document-local and never writes app preferences.
export function setPublicAppearanceHint(next) {
  publicPreference = THEME_PREFERENCES.includes(next) ? next : undefined;
  applyTheme();
}
export function subscribeTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function setTheme(next) {
  if (!THEME_PREFERENCES.includes(next)) return;
  preference = next;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* Optional persistence. */
  }
  emit();
}
media.addEventListener("change", (event) => {
  systemDark = event.matches;
  if (preference === "system") emit();
  else if (publicPreference === "system") applyTheme();
});
window.addEventListener("storage", (event) => {
  if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
  preference = normalize(event.newValue);
  emit();
});
