import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const fakeGoogleScript = `
  window.google = { accounts: { id: {
    initialize(options) { this.options = options; },
    renderButton(container) {
      const options = this.options;
      const button = document.createElement("button");
      button.textContent = "Continue with Google";
      button.type = "button";
      button.addEventListener("click", () => options.callback({ credential: JSON.stringify({
        testOnly: "venue-browser-fixture",
        sub: window.testGoogleSubject || "google-browser-owner",
        email: window.testGoogleEmail || "google-browser-owner@gmail.com",
        nonce: options.nonce
      }) }));
      container.replaceChildren(button);
    },
    cancel() {}
  } } };
`;
test.beforeEach(async ({ page }) => {
  await page.route("https://accounts.google.com/gsi/client*", (route) =>
    route.fulfill({ contentType: "application/javascript", body: fakeGoogleScript }),
  );
});
const verifyGoogle = async (page, path) => {
  await page.goto(path);
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await expect(page).toHaveURL(/\/google\/set-password$/);
};
const choosePassword = async (page, password = "GoogleBrowserPassword123!") => {
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
};
const signOut = async (page) => {
  await page.request.post("/api/auth/logout", {
    headers: { "X-Requested-With": "venue-dashboard" },
  });
};
test("Google-only registration, password setup, both logins and Google-only recovery", async ({
  page,
}, testInfo) => {
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/register");
  await expect(page.getByLabel("Email address")).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  const registrationAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(registrationAxe.violations.map((v) => v.id)).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeVisible();
  const challenge = (await page.context().cookies()).find(
    (cookie) => cookie.name === "venueGoogleChallenge",
  );
  expect(challenge.httpOnly).toBe(true);
  expect(challenge.sameSite).toBe("Lax");
  expect(challenge.path).toBe("/api/auth/google");
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await expect(page).toHaveURL(/\/google\/set-password$/);
  await page.reload(); // Setup survives reload using only the HttpOnly cookie.
  await choosePassword(page);
  const setupAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(setupAxe.violations.map((v) => v.id)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("google-password-setup.png"), fullPage: true });
  const authCookies = await page.context().cookies();
  const setup = authCookies.find((cookie) => cookie.name === "venueGoogleSetup");
  expect(setup.httpOnly).toBe(true);
  expect(setup.sameSite).toBe("Lax");
  expect(setup.path).toBe("/api/auth/google");
  await page.getByRole("button", { name: "Complete registration" }).click();
  await expect(page).toHaveURL(/\/venues\/new$/);
  await signOut(page);
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("google-browser-owner@gmail.com");
  await page.getByLabel("Password", { exact: true }).fill("GoogleBrowserPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/venues$/);
  await signOut(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await expect(page).toHaveURL(/\/venues$/);
  await signOut(page);
  await page.goto("/forgot-password");
  await expect(page.getByLabel("Email address")).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await expect(page).toHaveURL(/\/google\/set-password$/);
  await choosePassword(page, "GoogleBrowserChanged123!");
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("status")).toContainText("Password changed");
  await page.getByLabel("Email address").fill("google-browser-owner@gmail.com");
  await page.getByLabel("Password", { exact: true }).fill("GoogleBrowserChanged123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/venues$/);
  expect(requests.some((url) => /credential=|testOnly=|venueGoogleSetup=/.test(url))).toBe(false);
  const authRequests = requests
    .map((url) => new URL(url))
    .filter((url) => url.pathname.startsWith("/api/auth/"));
  expect(authRequests.length).toBeGreaterThan(0);
  expect(authRequests.every((url) => url.origin === new URL(page.url()).origin)).toBe(true);
  const browserState = await page.evaluate(() =>
    JSON.stringify({ history: history.state, localStorage, sessionStorage }),
  );
  expect(/credential|venue-browser-fixture|venueGoogleSetup/.test(browserState)).toBe(false);
  expect(errors).toEqual([]);
});

test.describe("Google authorization cookie recovery", () => {
  test.use({ serviceWorkers: "block" });

  test("a missing challenge cookie shows a session error and a fresh Google retry completes registration", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.testGoogleSubject = "google-browser-cookie-retry";
      window.testGoogleEmail = "google-browser-cookie-retry@gmail.com";
    });
    await page.goto("/register");
    const googleButton = page.getByRole("button", {
      name: "Continue with Google",
      exact: true,
    });
    await expect(googleButton).toBeVisible();
    const originalChallenge = (await page.context().cookies()).find(
      (cookie) => cookie.name === "venueGoogleChallenge",
    );
    expect(Boolean(originalChallenge)).toBe(true);
    // Reproduce a browser dropping the authorization cookie while preserving
    // the ID token and nonce returned by Google.
    await page.context().clearCookies({ name: "venueGoogleChallenge" });
    const failureResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/google" &&
        response.request().method() === "POST",
    );
    await googleButton.click();
    const failed = await failureResponse;
    expect(failed.status()).toBe(401);
    expect((await failed.json()).code).toBe("GOOGLE_SESSION_MISSING");
    await expect(page.getByRole("alert")).toContainText(
      "Your sign-in session could not be saved. Reload this page and try again.",
    );
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    await page.getByRole("button", { name: "Try Google again", exact: true }).click();
    await expect(googleButton).toBeVisible();
    const freshChallenge = (await page.context().cookies()).find(
      (cookie) => cookie.name === "venueGoogleChallenge",
    );
    expect(Boolean(freshChallenge)).toBe(true);
    expect(freshChallenge.value === originalChallenge.value).toBe(false);
    await googleButton.click();
    await expect(page).toHaveURL(/\/google\/set-password$/);
    await choosePassword(page);
    await page.getByRole("button", { name: "Complete registration" }).click();
    await expect(page).toHaveURL(/\/venues\/new$/);
  });
});

test("unlinked legacy recovery is denied; explicit current-password linking enables Google", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.testGoogleSubject = "legacy-browser-subject";
    window.testGoogleEmail = "browser-owner@example.test";
  });
  await page.goto("/forgot-password");
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("No eligible linked account");
  await verifyGoogle(page, "/login");
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  await page.getByLabel("Existing application password").fill("BrowserTestOnly123!");
  await page.getByRole("button", { name: "Link Google and sign in" }).click();
  await expect(page).toHaveURL(/\/venues$/);
});

test("missing setup authorization requires Google sign-in; removed OTP screens expose no inputs", async ({
  page,
}) => {
  await page.goto("/google/set-password");
  await expect(page.getByRole("alert")).toContainText("expired or already used");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  for (const path of ["/verify-email", "/reset-password"]) {
    await page.goto(path);
    await expect(page.locator('input[autocomplete="one-time-code"]')).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "This space is still waiting to be found." }),
    ).toBeVisible();
  }
});
