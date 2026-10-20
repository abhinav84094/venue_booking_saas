import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHmac } from "node:crypto";

const headers = { "X-Requested-With": "venue-dashboard" };
const assertFits = async (page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
};
const assertAccessible = async (page) => {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(
    violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => ({ target: node.target, details: node.any[0]?.data })),
    })),
  ).toEqual([]);
};

test("appearance follows system, persists across navigation and synchronizes open tabs", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue("system");
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue("light");
  const second = await context.newPage();
  await second.goto("/register");
  await second.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Appearance", { exact: true }).selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await second.close();
  for (const appearance of ["light", "dark"]) {
    await page.getByLabel("Appearance", { exact: true }).selectOption(appearance);
    for (const width of [1440, 820, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await assertFits(page);
      await assertAccessible(page);
    }
  }
});

async function createPaidFixture(page) {
  const post = async (url, data) => {
    const response = await page.request.post(`/api${url}`, { data, headers });
    expect(response.ok(), `${url}: ${await response.text()}`).toBe(true);
    return response.json();
  };
  await post("/auth/login", {
    email: "appearance-owner@example.test",
    password: "BrowserTestOnly123!",
  });
  const { venue } = await post("/venues", {
    name: "Appearance Test Venue",
    slug: "appearance-test-venue",
    address: { city: "Patna", state: "Bihar" },
    contact: { phone: "9876543210" },
  });
  const venueBase = `/venues/${venue._id}`;
  const { hall } = await post(`${venueBase}/halls`, {
    name: "Appearance Test Hall",
    capacity: 300,
  });
  const hallBase = `${venueBase}/halls/${hall._id}`;
  const subscription = await (await page.request.get(`/api${hallBase}/subscription`)).json();
  const { order } = await post(`${hallBase}/subscription/checkout`, {
    planId: subscription.plans[0]._id,
  });
  const payment = order.orderId.replace(/^order_/, "pay_");
  await post(`${hallBase}/subscription/verify`, {
    razorpay_order_id: order.orderId,
    razorpay_payment_id: payment,
    razorpay_signature: createHmac("sha256", "disposable-browser-gateway-secret")
      .update(`${order.orderId}|${payment}`)
      .digest("hex"),
  });
  const { hall: unpaid } = await post(`${venueBase}/halls`, {
    name: "Unpaid Appearance Hall",
    capacity: 50,
  });
  const configuration = await page.request.patch(`/api${hallBase}`, {
    headers,
    data: {
      published: true,
      pricing: [{ key: "FULL_DAY", label: "Full day", amount: 2500000, durationMinutes: 1440 }],
    },
  });
  expect(configuration.ok()).toBe(true);
  await post(`${hallBase}/publication`, { published: true });
  return { venueBase, hallBase, unpaidBase: `${venueBase}/halls/${unpaid._id}` };
}

test("paid hall pages, forms and calendar support both palettes on desktop, tablet and mobile", async ({
  page,
}, testInfo) => {
  test.setTimeout(240000);
  const { venueBase, hallBase, unpaidBase } = await createPaidFixture(page);
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  const routes = [
    "/venues",
    `${venueBase}/halls`,
    `${venueBase}/setup`,
    `${hallBase}/subscription`,
    `${unpaidBase}/subscription`,
    hallBase,
    `${hallBase}/halls`,
    `${hallBase}/pricing`,
    `${hallBase}/availability`,
    `${hallBase}/bookings`,
    `${hallBase}/customers`,
    `${hallBase}/payments`,
    `${hallBase}/website`,
    `${hallBase}/settings`,
    "/account",
  ];
  for (const appearance of ["light", "dark"]) {
    await page.goto("/venues");
    await page.getByLabel("Appearance", { exact: true }).selectOption(appearance);
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", appearance);
      await expect(page.getByRole("alert")).toHaveCount(0);
      if (route.endsWith("/availability")) {
        await expect(page.locator(".calendar-day").first()).toBeVisible();
        await page.getByRole("button", { name: "Block time", exact: true }).click();
        await expect(page.getByLabel("Reason", { exact: true })).toBeVisible();
      }
      for (const width of [1440, 820, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await assertFits(page);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await assertAccessible(page);
      if (appearance === "dark" && [hallBase, `${hallBase}/availability`].includes(route)) {
        await page.screenshot({
          path: testInfo.outputPath(
            route === hallBase ? "dashboard-dark.png" : "calendar-dark.png",
          ),
          fullPage: true,
        });
      }
    }
  }
  expect((await page.request.get(`/api${unpaidBase}/overview`)).status()).toBe(402);
  for (const template of ["classic", "editorial", "pavilion", "royal-wedding"]) {
    for (const appearance of ["light", "dark", "system"]) {
      const response = await page.request.patch(`/api${hallBase}/venue-profile`, {
        headers,
        data: { website: { appearance, template } },
      });
      expect(response.ok()).toBe(true);
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto("/v/appearance-test-venue");
      await expect(page.locator(`[data-template-id="${template}"]`)).toBeVisible();
      await expect(page.locator(".public-venue")).toHaveAttribute(
        "data-appearance",
        appearance === "light" ? "light" : "dark",
      );
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      expect(await page.evaluate(() => localStorage.getItem("prakash-venue-theme"))).toBe("dark");
      await expect(page.getByLabel("Appearance", { exact: true })).toBeHidden();
      await assertAccessible(page);
      await page.setViewportSize({ width: 320, height: 1000 });
      await assertFits(page);
      await page.screenshot({
        path: testInfo.outputPath(`public-${template}-${appearance}-mobile.png`),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
  }
  expect(failures).toEqual([]);
});
