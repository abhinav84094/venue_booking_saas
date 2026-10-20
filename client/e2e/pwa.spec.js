import { test, expect } from "@playwright/test";
import { isSafePrecachePath } from "../src/pwa/policy.js";

test.beforeEach(async ({ request }) => {
  const response = await request.post("/__browser-tests/reset-rate-limits", {
    headers: { "X-Requested-With": "venue-dashboard" },
  });
  expect(response.ok()).toBe(true);
});

const signIn = async (page) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("browser-owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("BrowserTestOnly123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/venues$/);
};
const waitForOwnerWorker = async (page) => {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return (
          registrations.some((registration) => registration.active) &&
          Boolean(navigator.serviceWorker.controller)
        );
      }),
    )
    .toBe(true);
};
const cachedRequests = (page) =>
  page.evaluate(async () => {
    const result = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        result.push({ name, url: request.url, type: response.headers.get("content-type") });
      }
    }
    return result;
  });
const simulateStandalone = (page) =>
  page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = original(query);
      if (query.includes("display-mode: standalone"))
        Object.defineProperty(result, "matches", { value: true });
      return result;
    };
  });
const dispatchInstallPrompt = (page) =>
  page.evaluate(() => {
    let resolveChoice;
    window.testInstallPrompt = {
      calls: 0,
      choice: new Promise((resolve) => {
        resolveChoice = resolve;
      }),
      resolve: (outcome) => resolveChoice({ outcome, platform: "web" }),
    };
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: {
        value: async () => {
          window.testInstallPrompt.calls++;
        },
      },
      userChoice: { value: window.testInstallPrompt.choice },
    });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });

test("production assets, owner manifest and a real controlling service worker are delivered", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/pwa-icons/apple-touch-icon.png",
  );
  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    id: "/owner-app",
    name: "Prakash SaaS Venue",
    short_name: "Prakash Venue",
    start_url: "/login",
    scope: "/",
    display: "standalone",
  });
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect(response.ok(), icon.src).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
    const bytes = await response.body();
    expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`).toBe(icon.sizes);
  }
  await waitForOwnerWorker(page);
  const registration = await page.evaluate(async () => {
    const value = await navigator.serviceWorker.ready;
    return { scope: value.scope, script: value.active.scriptURL };
  });
  expect(new URL(registration.scope).pathname).toBe("/");
  expect(new URL(registration.script).pathname).toBe("/sw.js");
  const workerResponse = await page.request.get("/sw.js");
  expect(workerResponse.ok()).toBe(true);
  expect(workerResponse.headers()["content-type"]).toMatch(/javascript/);
});

test("simulated standalone launch preserves password login, protected routes and logout", async ({
  page,
}) => {
  await simulateStandalone(page);
  await page.goto("/venues");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByText("Having trouble with Google sign-in in the app?", { exact: true }).click();
  await expect(
    page.getByText(/open .*\/login in Safari, Chrome or your default browser/),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("browser-owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("BrowserTestOnly123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/venues$/);
  await page.goto("/login"); // Manifest start URL follows the existing authenticated redirect.
  await expect(page).toHaveURL(/\/venues$/);
  await page.goto("/account");
  await expect(page.getByLabel("Account email")).toHaveValue("browser-owner@example.test");
  await dispatchInstallPrompt(page);
  await expect(page.getByRole("button", { name: "Install App", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
  const cached = await cachedRequests(page);
  expect(cached.some(({ url }) => /\/api\/|\/account(?:\?|$)|\/venues(?:\?|$)/.test(url))).toBe(
    false,
  );
});

test("Google fixture registration and linked login remain functional in simulated standalone mode", async ({
  page,
}) => {
  // The Google provider is a local fixture, as in authentication.spec.js.
  // This validates our app integration, not live Google consent or OS install.
  await simulateStandalone(page);
  await page.route("https://accounts.google.com/gsi/client*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.google = { accounts: { id: {
      initialize(options) { this.options = options; },
      renderButton(container) {
        const options = this.options;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Continue with Google";
        button.onclick = () => options.callback({ credential: JSON.stringify({
          testOnly: "venue-browser-fixture", sub: "pwa-standalone-google-owner",
          email: "pwa-standalone-owner@example.test", nonce: options.nonce
        }) });
        container.replaceChildren(button);
      }, cancel() {}
    } } };`,
    }),
  );
  await page.goto("/register");
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await expect(page).toHaveURL(/\/google\/set-password$/);
  await page.getByLabel("New password", { exact: true }).fill("PwaStandalonePassword123!");
  await page.getByLabel("Confirm password", { exact: true }).fill("PwaStandalonePassword123!");
  await page.getByRole("button", { name: "Complete registration" }).click();
  await expect(page).toHaveURL(/\/venues\/new$/);
  await page.request.post("/api/auth/logout", {
    headers: { "X-Requested-With": "venue-dashboard" },
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await expect(page).toHaveURL(/\/venues$/);
});

test("cache storage contains only static assets and dedicated offline HTML after authenticated API reads", async ({
  page,
}) => {
  await signIn(page);
  await waitForOwnerWorker(page);
  const responses = await page.evaluate(async () => {
    const result = [];
    for (const path of ["/api/auth/me", "/api/venues"]) {
      const response = await fetch(path, { credentials: "same-origin" });
      result.push({ path, status: response.status });
    }
    return result;
  });
  expect(responses.every(({ status }) => status === 200)).toBe(true);
  await page.goto("/account");
  await expect(page.getByLabel("Account email")).toBeVisible();
  const cached = await cachedRequests(page);
  expect(cached.length).toBeGreaterThan(5);
  for (const entry of cached) {
    const url = new URL(entry.url);
    expect(url.origin).toBe(new URL(page.url()).origin);
    expect(isSafePrecachePath(url.pathname), entry.url).toBe(true);
    expect(url.searchParams.has("token"), entry.url).toBe(false);
    if (entry.type?.includes("text/html")) expect(url.pathname).toBe("/offline.html");
    const response = await page.evaluate(async (entry) => {
      const cache = await caches.open(entry.name);
      const response = await cache.match(entry.url);
      return response.headers.get("set-cookie");
    }, entry);
    expect(response).toBeNull();
  }
  expect(cached.some(({ url }) => /\/offline\.html(?:\?|$)/.test(url))).toBe(true);
});

test("warm and cold offline owner navigation show fallback and live operations remain network dependent", async ({
  page,
  context,
}, testInfo) => {
  await signIn(page);
  await waitForOwnerWorker(page);
  await page.goto("/account");
  await expect(page.getByLabel("Account email")).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/internet connection/i);
  await expect(page.getByLabel("Account email")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("pwa-offline.png"), fullPage: true });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    /offline|internet connection/i,
  );
  await expect(page.getByRole("button", { name: "Retry connection", exact: true })).toBeVisible();
  await expect(page.getByLabel("Account email")).toHaveCount(0);
  const cold = await context.newPage();
  await cold.goto("/venues/a/halls/b/payments");
  await expect(cold.getByRole("heading", { level: 1 })).toContainText(
    /offline|internet connection/i,
  );
  await expect(cold.getByRole("button", { name: /pay|confirm booking|activate/i })).toHaveCount(0);
  const operations = await cold.evaluate(async () => {
    const requests = [
      ["/api/auth/me", "GET"],
      ["/api/venues/a/halls/b/availability/b?startDate=2026-10-20&endDate=2026-10-21", "GET"],
      ["/api/venues/a/halls/b/subscription/checkout", "POST"],
      ["/api/venues/a/halls/b/subscription/verify", "POST"],
    ];
    return Promise.all(
      requests.map(async ([url, method]) => {
        try {
          const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json", "X-Requested-With": "venue-dashboard" },
            ...(method === "POST" ? { body: "{}" } : {}),
          });
          return { url, resolved: true, status: response.status };
        } catch {
          return { url, resolved: false };
        }
      }),
    );
  });
  expect(operations.every(({ resolved }) => resolved === false)).toBe(true);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Retry connection", exact: true }).click();
  await expect(page.getByLabel("Account email")).toBeVisible();
});

test("public venue navigation has no owner manifest, installation action or service-worker registration", async ({
  page,
}) => {
  await page.goto("/v/pwa-unavailable-venue");
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Install App", exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
  ).toBe(0);
});

test("unrelated customer origins do not opt into the owner PWA even when serving the same frontend", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  try {
    await context.route("https://grandhall.venue.prakashsaas.com/**", async (route) => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: `${baseURL}${url.pathname}${url.search}` });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    await page.goto("https://grandhall.venue.prakashsaas.com/login");
    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(0);
    expect(
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
    ).toBe(0);
  } finally {
    await context.close();
  }
});

test("mock native install prompt is click-only, dismissal is quiet and acceptance hides the action", async ({
  page,
}, testInfo) => {
  await signIn(page);
  await page.goto("/account");
  await expect(page.getByLabel("Account email")).toBeVisible();
  expect(await dispatchInstallPrompt(page)).toBe(true);
  const action = page.getByRole("button", { name: "Install App", exact: true });
  await expect(action).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("pwa-install-desktop.png"), fullPage: true });
  expect(await page.evaluate(() => window.testInstallPrompt.calls)).toBe(0);
  await action.click();
  expect(await page.evaluate(() => window.testInstallPrompt.calls)).toBe(1);
  await page.evaluate(() => window.testInstallPrompt.resolve("dismissed"));
  await expect(action).toHaveCount(0);
  await dispatchInstallPrompt(page);
  await expect(action).toBeVisible();
  await action.click();
  await page.evaluate(() => window.testInstallPrompt.resolve("accepted"));
  await expect(action).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(action).toHaveCount(0);
});

test("iOS Safari detection offers manual Home Screen instructions in a mobile viewport", async ({
  browser,
  baseURL,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  try {
    const page = await context.newPage();
    await signIn(page);
    await page.goto("/account");
    await page.getByRole("button", { name: "How to install", exact: true }).click();
    await expect(page.getByText(/Tap Share in Safari, then Add to Home Screen\./)).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("pwa-ios-instructions.png"),
      fullPage: true,
    });
    await expect(page.getByRole("button", { name: "Install App", exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test("a waiting update stays user controlled and waits for a busy workflow", async ({ page }) => {
  // This exercises the real UI and update controller with the browser protocol
  // mocked. A single fixed build cannot provide an actual second deployment.
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "pwa-test-loads",
      String(Number(sessionStorage.getItem("pwa-test-loads")) + 1),
    );
    const worker = new EventTarget();
    worker.controller = {};
    const registration = new EventTarget();
    registration.waiting = {
      postMessage(message) {
        sessionStorage.setItem("pwa-test-update-message", JSON.stringify(message));
      },
    };
    registration.update = async () => {};
    worker.register = async () => registration;
    Object.defineProperty(navigator, "serviceWorker", { value: worker, configurable: true });
  });
  await page.goto("/login");
  const action = page.getByRole("button", { name: "Update and refresh", exact: true });
  await expect(action).toBeVisible();
  let loads = await page.evaluate(() => Number(sessionStorage.getItem("pwa-test-loads")));
  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event("controllerchange")));
  expect(await page.evaluate(() => Number(sessionStorage.getItem("pwa-test-loads")))).toBe(loads);
  expect(await page.evaluate(() => sessionStorage.getItem("pwa-test-update-message"))).toBeNull();
  await page.locator("form").evaluate((form) => form.setAttribute("aria-busy", "true"));
  await expect(action).toBeDisabled();
  await expect(page.getByText("Finish your current action before updating.")).toBeVisible();
  await page.locator("form").evaluate((form) => form.removeAttribute("aria-busy"));
  await expect(action).toBeEnabled();
  await page.getByLabel("Email address").fill("browser-owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("BrowserTestOnly123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/venues$/);
  await page.goto("/account");
  loads = await page.evaluate(() => Number(sessionStorage.getItem("pwa-test-loads")));
  let releaseLogout;
  let logoutStarted;
  const release = new Promise((resolve) => {
    releaseLogout = resolve;
  });
  const started = new Promise((resolve) => {
    logoutStarted = resolve;
  });
  await page.route("**/api/auth/logout", async (route) => {
    logoutStarted();
    await release;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "Disposable pending mutation fixture" }),
    });
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await started;
  await expect(action).toBeDisabled();
  expect(await page.locator('[aria-busy="true"]:not([data-pwa-control])').count()).toBe(0);
  releaseLogout();
  await expect(action).toBeEnabled();
  await action.click();
  expect(
    await page.evaluate(() => JSON.parse(sessionStorage.getItem("pwa-test-update-message"))),
  ).toEqual({ type: "SKIP_WAITING" });
  const reloaded = page.waitForEvent("load");
  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event("controllerchange")));
  await reloaded;
  expect(await page.evaluate(() => Number(sessionStorage.getItem("pwa-test-loads")))).toBe(
    loads + 1,
  );
});

test("an actual changed service worker waits and activates only after the owner accepts", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "pwa-update-loads",
      String(Number(sessionStorage.getItem("pwa-update-loads")) + 1),
    );
  });
  try {
    await page.goto("/login");
    await waitForOwnerWorker(page);
    const loads = await page.evaluate(() => Number(sessionStorage.getItem("pwa-update-loads")));
    // This disposable fixture changes only the real worker script's bytes.
    // It exercises actual browser install/wait/activate events without deployment.
    const changed = await page.request.post("/__browser-tests/pwa-worker-version", {
      data: { version: 1 },
      headers: { "X-Requested-With": "venue-dashboard" },
    });
    expect(changed.ok()).toBe(true);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      await registration.update();
    });
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration("/");
          return registration.waiting?.state;
        }),
      )
      .toBe("installed");
    const action = page.getByRole("button", { name: "Update and refresh", exact: true });
    await expect(action).toBeVisible();
    expect(await page.evaluate(() => Number(sessionStorage.getItem("pwa-update-loads")))).toBe(
      loads,
    );
    const reloaded = page.waitForEvent("load");
    await action.click();
    await reloaded;
    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
    await waitForOwnerWorker(page);
    expect(await page.evaluate(() => Number(sessionStorage.getItem("pwa-update-loads")))).toBe(
      loads + 1,
    );
    expect(
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration("/");
        return { active: registration.active.state, waiting: Boolean(registration.waiting) };
      }),
    ).toEqual({ active: "activated", waiting: false });
  } finally {
    await page.request.post("/__browser-tests/pwa-worker-version", {
      data: { version: 0 },
      headers: { "X-Requested-With": "venue-dashboard" },
    });
  }
});
