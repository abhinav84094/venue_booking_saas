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
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain("credential");
  expect(errors).toEqual([]);
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
