import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

async function fixture(t, { stored, systemDark = false, denied = false, publicPreference } = {}) {
  const beforeWindow = globalThis.window;
  const beforeDocument = globalThis.document;
  const callbacks = {};
  const media = {
    matches: systemDark,
    addEventListener: (_event, fn) => {
      callbacks.media = fn;
    },
  };
  const storage = new Map(stored === undefined ? [] : [["prakash-venue-theme", stored]]);
  const classes = new Set();
  globalThis.document = {
    querySelector: () => (publicPreference ? { content: publicPreference } : null),
    documentElement: {
      classList: { toggle: (key, on) => (on ? classes.add(key) : classes.delete(key)) },
      style: {},
      dataset: {},
    },
  };
  globalThis.window = {
    matchMedia: () => media,
    addEventListener: (_event, fn) => {
      callbacks.storage = fn;
    },
    localStorage: {
      getItem: (key) => {
        if (denied) throw new Error("storage denied");
        return storage.get(key) ?? null;
      },
      setItem: (key, value) => {
        if (denied) throw new Error("storage denied");
        storage.set(key, value);
      },
    },
  };
  t.after(() => {
    globalThis.window = beforeWindow;
    globalThis.document = beforeDocument;
  });
  const store = await import(`../src/theme/themeStore.js?case=${encodeURIComponent(t.name)}`);
  return { store, storage, classes, callbacks, media };
}

test("stored theme overrides system, updates document and persists toggle", async (t) => {
  const { store, storage, classes } = await fixture(t, { stored: "light", systemDark: true });
  assert.equal(store.getTheme(), "light");
  assert.equal(store.getThemePreference(), "light");
  assert.equal(classes.has("dark"), false);
  let notifications = 0;
  const unsubscribe = store.subscribeTheme(() => notifications++);
  store.setTheme("dark");
  assert.equal(store.getTheme(), "dark");
  assert.equal(classes.has("dark"), true);
  assert.equal(document.documentElement.style.colorScheme, "dark");
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(storage.get(store.THEME_STORAGE_KEY), "dark");
  assert.equal(notifications, 1);
  unsubscribe();
  store.setTheme("light");
  assert.equal(notifications, 1);
});

test("system mode can be selected again after choosing an explicit appearance", async (t) => {
  const { store, callbacks, storage } = await fixture(t, { systemDark: true });
  assert.equal(store.getTheme(), "dark");
  assert.equal(store.getThemePreference(), "system");
  callbacks.media({ matches: false });
  assert.equal(store.getTheme(), "light");
  store.setTheme("dark");
  callbacks.media({ matches: false });
  assert.equal(store.getTheme(), "dark");
  store.setTheme("system");
  assert.equal(store.getTheme(), "light");
  assert.equal(store.getThemePreference(), "system");
  assert.equal(storage.get(store.THEME_STORAGE_KEY), "system");
  callbacks.media({ matches: true });
  assert.equal(store.getTheme(), "dark");
});

test("storage restrictions and invalid preferences do not break toggle", async (t) => {
  const { store } = await fixture(t, { denied: true });
  assert.equal(store.getTheme(), "light");
  assert.doesNotThrow(() => store.setTheme("dark"));
  assert.equal(store.getTheme(), "dark");
  store.setTheme("invalid");
  assert.equal(store.getTheme(), "dark");
});

test("theme syncs across tabs and removed preference follows system", async (t) => {
  const { store, callbacks } = await fixture(t, { stored: "invalid", systemDark: false });
  assert.equal(store.getTheme(), "light");
  callbacks.storage({ key: store.THEME_STORAGE_KEY, newValue: "dark" });
  assert.equal(store.getTheme(), "dark");
  callbacks.storage({ key: store.THEME_STORAGE_KEY, newValue: null });
  assert.equal(store.getTheme(), "light");
  assert.equal(store.getThemePreference(), "system");
  callbacks.media({ matches: true });
  assert.equal(store.getTheme(), "dark");
  callbacks.storage({ key: "unrelated", newValue: "light" });
  assert.equal(store.getTheme(), "dark");
});

test("blocking theme bootstrap agrees with saved and system preferences before React loads", async () => {
  const bootstrap = await readFile(new URL("../public/theme-init.js", import.meta.url), "utf8");
  for (const [saved, systemDark, expected] of [
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["system", true, "dark"],
    [null, false, "light"],
    ["invalid", true, "dark"],
  ]) {
    const element = { dataset: {}, style: {}, classList: { toggle() {} } };
    runInNewContext(bootstrap, {
      localStorage: { getItem: () => saved },
      matchMedia: () => ({ matches: systemDark }),
      document: { documentElement: element },
    });
    assert.equal(element.dataset.theme, expected);
    assert.equal(element.style.colorScheme, expected);
  }
});

test("both semantic palettes provide accessible text on surfaces, actions and feedback", async () => {
  const css = await readFile(new URL("../src/theme/theme.css", import.meta.url), "utf8");
  const palettes = [...css.matchAll(/--page:\s*#[\da-f]{6};[\s\S]*?--shadow:[^;]+;/g)];
  assert.equal(palettes.length, 2);
  const luminance = (hex) =>
    hex
      .match(/[\da-f]{2}/g)
      .map((value) => {
        const n = parseInt(value, 16) / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
  for (const [index, palette] of palettes.entries()) {
    const colors = Object.fromEntries(
      [...palette[0].matchAll(/--([\w-]+):\s*(#[\da-f]{6});/g)].map((entry) => [
        entry[1],
        entry[2],
      ]),
    );
    const pairs = [
      ...["text", "muted", "ink", "placeholder"].flatMap((text) =>
        ["page", "surface", "surface-subtle"].map((surface) => [text, surface]),
      ),
      ["on-action", "action"],
      ["on-action", "action-hover"],
      ...["positive", "warning", "danger", "info"].map((name) => [
        `${name}-text`,
        `${name}-surface`,
      ]),
    ];
    for (const [text, surface] of pairs) {
      const values = [luminance(colors[text]), luminance(colors[surface])].sort((a, b) => b - a);
      assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${index}: ${text} on ${surface}`);
    }
  }
});

test("public first-paint appearance stays separate and restores the dashboard on navigation", async (t) => {
  const { store, storage, callbacks } = await fixture(t, {
    stored: "light",
    systemDark: true,
    publicPreference: "dark",
  });
  assert.equal(store.getTheme(), "light");
  assert.equal(document.documentElement.dataset.publicAppearance, "dark");
  assert.equal(document.documentElement.style.colorScheme, "dark");
  assert.equal(storage.get(store.THEME_STORAGE_KEY), "light");
  store.setPublicAppearanceHint("system");
  callbacks.media({ matches: false });
  assert.equal(document.documentElement.dataset.publicAppearance, "light");
  callbacks.media({ matches: true });
  assert.equal(document.documentElement.dataset.publicAppearance, "dark");
  store.setPublicAppearanceHint(null);
  assert.equal(document.documentElement.dataset.publicAppearance, undefined);
  assert.equal(document.documentElement.style.colorScheme, "light");
  assert.equal(storage.get(store.THEME_STORAGE_KEY), "light");
});

test("public SSR appearance is resolved by the blocking bootstrap before app initialization", async () => {
  const bootstrap = await readFile(new URL("../public/theme-init.js", import.meta.url), "utf8");
  for (const publicPreference of ["light", "dark", "system"]) {
    const element = { dataset: {}, style: {}, classList: { toggle() {} } };
    runInNewContext(bootstrap, {
      localStorage: { getItem: () => "light" },
      matchMedia: () => ({ matches: true }),
      document: { documentElement: element, querySelector: () => ({ content: publicPreference }) },
    });
    assert.equal(element.dataset.theme, "light");
    assert.equal(element.dataset.publicAppearance, publicPreference === "light" ? "light" : "dark");
  }
});
