import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
const uploadedImageUrl = "https://images.example.test/hall-upload.png";
const uploadedPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQCHAAAAFEALG/sYZuAAAAAElFTkSuQmCC",
  "base64",
);
const serveUploadedImage = (route) =>
  route.fulfill({ contentType: "image/png", body: uploadedPng });
const installTestCheckout = async (page) => {
  await page.exposeFunction("disposableTestCapture", (orderId) => {
    const paymentId = orderId.replace(/^order_/, "pay_");
    return {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: crypto
        .createHmac("sha256", "disposable-browser-gateway-secret")
        .update(`${orderId}|${paymentId}`)
        .digest("hex"),
    };
  });
  await page.addInitScript(() => {
    window.Razorpay = class {
      constructor(options) {
        this.options = options;
      }
      on() {}
      open() {
        window
          .disposableTestCapture(this.options.order_id)
          .then((payment) => this.options.handler(payment));
      }
    };
  });
};
const login = async (page, email = "browser-owner@example.test") => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("BrowserTestOnly123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
};
const noOverflow = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
test("responsive welcome and auth pages render with no overflow or critical accessibility failures", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  expect(
    await page.locator("html").evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await expect(page.getByRole("heading", { name: /We make room/ })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("landing-desktop.png"), fullPage: true });
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, contrast: n.any[0]?.data?.contrastRatio })),
    })),
  ).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("landing-mobile.png"), fullPage: true });
  await page.getByRole("link", { name: "Create your venue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Make room for more." })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await noOverflow(page);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  expect(
    await page
      .locator(".field label")
      .first()
      .evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThanOrEqual(14);
  expect(
    await page
      .locator(".field input")
      .first()
      .evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await noOverflow(page);
});

test("platform administrator sees only environment-managed subscription prices", async ({
  page,
}) => {
  await login(page, "browser-admin@example.test");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "plans", exact: true }).click();
  await expect(page.getByRole("heading", { name: "3 Months", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 Year", exact: true })).toBeVisible();
  await expect(page.locator(".plan-card")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Create plan", exact: true })).toHaveCount(0);
  await expect(page.locator(".plan-card").first()).toContainText("500.00");
});

test("verified hall payment unlocks management independently; public enquiry becomes a confirmed event with recorded advance", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120000);
  const requestedScripts = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") requestedScripts.push(request.url());
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(uploadedImageUrl, serveUploadedImage);
  await login(page);
  await expect(page).toHaveURL(/\/venues$/);
  await page.getByRole("link", { name: "Add a venue" }).click();
  await page.getByLabel("Venue name").fill("Browser Test Venue");
  await page.getByLabel("City", { exact: true }).fill("Patna");
  await page.getByLabel("State", { exact: true }).fill("Bihar");
  await page.getByLabel("Business phone").fill("9876543210");
  await page.getByRole("button", { name: "Create venue & add halls" }).click();
  await expect(page).toHaveURL(/\/halls$/);
  const venueBase = new URL(page.url()).pathname.replace(/\/halls$/, "");
  await page.getByRole("button", { name: "Add a hall", exact: true }).click();
  await page.getByLabel("Hall name").fill("Grand Celebration Hall");
  await page.getByLabel("Guest capacity").fill("500");
  await page.getByRole("button", { name: "Create hall & choose plan", exact: true }).click();
  await expect(page).toHaveURL(/\/halls\/[^/]+\/subscription$/);
  const hallBase = new URL(page.url()).pathname.replace(/\/subscription$/, "");
  const blocked = await page.request.get(`/api${hallBase}/overview`);
  expect(blocked.status()).toBe(402);
  await page.goto(hallBase);
  await expect(page).toHaveURL(new RegExp(hallBase + "/subscription$"));
  await installTestCheckout(page);
  await page.reload();
  const plan = page
    .locator(".plan-card")
    .filter({ has: page.getByRole("heading", { name: "3 Months", exact: true }) });
  await plan.getByRole("button", { name: /Choose plan|Pay.*activate|Activate hall/i }).click();
  await expect(page.getByRole("link", { name: "Open dashboard", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /verified|activated/i })).toBeVisible();
  expect((await page.request.get(`/api${hallBase}/overview`)).status()).toBe(200);
  await page.goto(`${venueBase}/halls`);
  await page.getByRole("button", { name: "Add a hall", exact: true }).click();
  await page.getByLabel("Hall name").fill("Unpaid Mini Hall");
  await page.getByLabel("Guest capacity").fill("100");
  await page.getByRole("button", { name: "Create hall & choose plan", exact: true }).click();
  await expect(page).toHaveURL(/\/subscription$/);
  const unpaidBase = new URL(page.url()).pathname.replace(/\/subscription$/, "");
  expect((await page.request.get(`/api${unpaidBase}/overview`)).status()).toBe(402);
  await page.goto("/venues");
  await expect(
    page.getByRole("heading", { level: 1, name: "Browser Test Venue", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Browser Test Venue | Dashboard");
  const hallCard = page
    .locator(".hall-subscription-card")
    .filter({ has: page.getByRole("heading", { name: "Grand Celebration Hall", exact: true }) });
  await expect(hallCard.getByRole("link", { name: "Open dashboard", exact: false })).toBeVisible();
  await expect(hallCard).toContainText("3 Months");
  await expect(hallCard).toContainText(/90 days|90 day|Remaining.*90/i);
  expect(
    await hallCard
      .locator("dt")
      .first()
      .evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThanOrEqual(14);
  const unpaidCard = page
    .locator(".hall-subscription-card")
    .filter({ has: page.getByRole("heading", { name: "Unpaid Mini Hall", exact: true }) });
  await expect(unpaidCard.getByRole("link", { name: "Open dashboard" })).toHaveCount(0);
  await expect(unpaidCard.getByRole("link", { name: "Choose plan & pay" })).toBeVisible();
  await expect(unpaidCard).toContainText("Not activated");
  await expect(unpaidCard).toContainText("0 days");
  const selectionAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(
    selectionAxe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("hall-selection-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("hall-selection-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${hallBase}/halls`);
  await page.getByRole("button", { name: "Manage hall", exact: true }).click();
  await page.getByRole("button", { name: "+ Full day", exact: true }).click();
  await expect(page.getByLabel("Price (₹)", { exact: true })).toHaveValue("");
  await page.getByLabel("Price (₹)", { exact: true }).fill("4700");
  await page.getByRole("button", { name: "+ Hourly", exact: true }).click();
  await expect(page.getByLabel("Price per hour (₹)")).toHaveValue("");
  await page.getByLabel("Price per hour (₹)").fill("2500");
  await page.locator('.image-manager input[type="file"]').setInputFiles({
    name: "hall-entrance.png",
    mimeType: "image/png",
    buffer: uploadedPng,
  });
  const thumbnail = page.locator(".image-grid img");
  await expect(thumbnail).toHaveAttribute("src", uploadedImageUrl);
  await expect.poll(() => thumbnail.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByLabel("Description for image 1", { exact: true }).fill("Hall entrance");
  await page.getByLabel("Show on the public website").check();
  await page.getByRole("button", { name: "Save hall & pricing" }).click();
  await expect(
    page.getByRole("heading", { name: "Grand Celebration Hall", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Manage hall", exact: true }).click();
  await expect(page.getByLabel("Price (₹)", { exact: true })).toHaveValue("4700");
  await expect(page.getByLabel("Price per hour (₹)")).toHaveValue("2500");
  await expect(page.getByRole("img", { name: "Hall entrance", exact: true })).toHaveAttribute(
    "src",
    uploadedImageUrl,
  );
  await expect(page.getByLabel("Description for image 1", { exact: true })).toHaveValue(
    "Hall entrance",
  );
  await page.getByLabel("Price (₹)", { exact: true }).fill("4800");
  await page.getByRole("button", { name: "Save hall & pricing" }).click();
  await expect(page.getByText("₹4,800.00", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Your website", exact: true }).click();
  await page.getByLabel("Headline", { exact: true }).fill("Make your next moment memorable.");
  await page.getByRole("button", { name: "Save website", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  // RoyalWedding.jsx was added without editing a registry, route or API schema.
  expect(requestedScripts.some((url) => /RoyalWedding-.*\.js/.test(url))).toBe(false);
  await expect(page.getByTestId("template-selector").getByRole("button")).toHaveCount(4);
  await page.getByRole("button", { name: "Select Royal Wedding template", exact: true }).click();
  await expect(
    page.getByTestId("website-preview").locator('[data-template-id="royal-wedding"]'),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("website-preview")
      .getByRole("heading", { name: "Grand Celebration Hall", exact: true }),
  ).toBeVisible();
  expect(requestedScripts.some((url) => /RoyalWedding-.*\.js/.test(url))).toBe(true);
  await page.getByLabel("Public website appearance", { exact: true }).selectOption("dark");
  await page.getByRole("checkbox", { name: "Facilities and arrangements", exact: true }).uncheck();
  await page.getByRole("button", { name: "Save website", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Select Royal Wedding template", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Public website appearance", { exact: true })).toHaveValue("dark");
  await expect(
    page.getByRole("checkbox", { name: "Facilities and arrangements", exact: true }),
  ).not.toBeChecked();
  // A removed/renamed frontend template never breaks existing saved venues.
  const missingTemplate = await page.request.patch(`/api${hallBase}/venue-profile`, {
    headers: { "X-Requested-With": "venue-dashboard" },
    data: { website: { template: "removed-design" } },
  });
  expect(missingTemplate.status()).toBe(200);
  await page.reload();
  await expect(
    page.getByTestId("website-preview").locator('[data-template-id="classic"]'),
  ).toBeVisible();
  await expect(page.getByText(/Your saved design is no longer available/)).toBeVisible();
  await page.getByRole("button", { name: "Select Royal Wedding template", exact: true }).click();
  await page.getByRole("button", { name: "Save & publish website", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unpublish website" })).toBeVisible();
  const guest = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    publicPage = await guest.newPage();
  await guest.route(uploadedImageUrl, serveUploadedImage);
  await publicPage.goto("/v/browser-test-venue");
  await expect(
    publicPage.getByRole("heading", { name: "Make your next moment memorable." }),
  ).toBeVisible();
  await expect(publicPage.locator('[data-template-id="royal-wedding"]')).toBeVisible();
  await expect(publicPage.locator("[data-venue-website]")).toHaveAttribute(
    "data-appearance",
    "dark",
  );
  await expect(publicPage).toHaveTitle("Browser Test Venue | Prakash SaaS");
  await expect(publicPage.locator("#facilities")).toHaveCount(0);
  await noOverflow(publicPage);
  await publicPage.screenshot({ path: testInfo.outputPath("public-desktop.png"), fullPage: true });
  const publicAxe = await new AxeBuilder({ page: publicPage })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    publicAxe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, contrast: n.any[0]?.data?.contrastRatio })),
    })),
  ).toEqual([]);
  await publicPage.getByRole("button", { name: "View Hall entrance", exact: true }).click();
  await expect(publicPage.getByRole("dialog", { name: "Hall entrance" })).toBeVisible();
  const photoAxe = await new AxeBuilder({ page: publicPage })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(photoAxe.violations.map((violation) => violation.id)).toEqual([]);
  await publicPage.keyboard.press("Escape");
  await expect(publicPage.getByRole("dialog")).toHaveCount(0);
  await publicPage.getByLabel("Booking option", { exact: true }).selectOption("HOURLY");
  await publicPage.getByLabel("From", { exact: true }).fill("2035-02-10T10:00");
  await publicPage.getByLabel("Until", { exact: true }).fill("2035-02-10T14:00");
  await publicPage.getByRole("button", { name: "Check availability & quote" }).click();
  await expect(publicPage.getByText("₹10,000.00", { exact: true })).toBeVisible();
  await publicPage.getByLabel("Your name", { exact: true }).fill("Browser Test Customer");
  await publicPage.getByLabel("Phone number").fill("9876501234");
  await publicPage.getByLabel("Occasion / event type").fill("Wedding celebration");
  await publicPage.getByLabel("Number of guests").fill("250");
  await publicPage.getByRole("button", { name: "Send your enquiry" }).click();
  await expect(publicPage.getByRole("heading", { name: "Your enquiry is with us." })).toBeVisible();
  await publicPage.setViewportSize({ width: 375, height: 812 });
  await noOverflow(publicPage);
  await publicPage.screenshot({ path: testInfo.outputPath("public-mobile.png"), fullPage: true });
  await page.goto(`${hallBase}/enquiries`);
  await expect(
    page.getByRole("heading", { name: "Wedding celebration", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.locator(".booking-card > .section-title > .badge-confirmed")).toBeVisible();
  await publicPage.getByRole("button", { name: "Refresh confirmation status" }).click();
  await expect(publicPage.getByRole("heading", { name: "Your event is confirmed." })).toBeVisible();
  await guest.close();
  await page.goto(`${hallBase}/payments`);
  await page.getByRole("button", { name: "Record payment", exact: true }).click();
  await page.getByLabel("Booking", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Amount (₹)").fill("2000");
  await page.getByLabel("Receipt / transaction reference").fill("TEST-ADVANCE-001");
  await page.getByRole("button", { name: "Save payment record" }).click();
  await expect(page.getByText("TEST-ADVANCE-001", { exact: true })).toBeVisible();
  await page.goto(hallBase);
  await expect(
    page.getByRole("heading", { level: 1, name: "Browser Test Venue", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".dashboard-brand")).toContainText("Browser Test Venue");
  await expect(page).toHaveTitle("Browser Test Venue | Dashboard");
  await expect(page.locator(".stat-card").filter({ hasText: "Recorded revenue" })).toContainText(
    "₹2,000.00",
  );
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("dashboard-desktop.png"), fullPage: true });
  const dashboardAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(
    dashboardAxe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, contrast: n.any[0]?.data?.contrastRatio })),
    })),
  ).toEqual([]);
  const longVenueName = "The Grand Celebration and Convention Venue at Riverside Gardens";
  const renamed = await page.request.patch(`/api${hallBase}/venue-profile`, {
    headers: { "X-Requested-With": "venue-dashboard" },
    data: { name: longVenueName },
  });
  expect(renamed.status()).toBe(200);
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: longVenueName, exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await noOverflow(page);
  await expect(page.locator(".sidebar")).toHaveCSS("visibility", "hidden");
  await page.screenshot({ path: testInfo.outputPath("dashboard-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Open menu" }).click();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("navigation-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Availability", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your availability, at a glance." }),
  ).toBeVisible();
  await expect(page.locator(".sidebar")).toHaveCSS("visibility", "hidden");
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("calendar-mobile.png"), fullPage: true });
  expect(errors).toEqual([]);
});
