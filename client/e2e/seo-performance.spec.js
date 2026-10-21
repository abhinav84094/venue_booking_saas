import { test, expect } from "@playwright/test";

const source = (name) => `https://res.cloudinary.com/venue/image/upload/v123/${name}.jpg`;
const fixture = {
  success: true,
  venue: {
    _id: "507f1f77bcf86cd799439012",
    slug: "amber-hall",
    name: "Amber Hall",
    description: "A private celebration space in Patna.",
    coverImage: source("cover"),
    images: [{ url: source("garden"), alt: "The garden" }],
    timezone: "Asia/Kolkata",
    address: { city: "Patna", state: "Bihar", country: "India" },
    contact: { phone: "9876543210" },
    website: { template: "classic", headline: "Celebrate at Amber Hall", appearance: "light" },
  },
  halls: [
    {
      _id: "507f1f77bcf86cd799439011",
      name: "Amber event space",
      capacity: 300,
      images: [{ url: source("hall"), alt: "The hall" }],
      pricing: [{ key: "FULL_DAY", label: "Full day", amount: 2500000, durationMinutes: 1440 }],
      enquiriesEnabled: true,
    },
  ],
};

test("mobile public tenant selects a responsive LCP image, reserves its layout and remains interactive", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  let releaseCover;
  const coverGate = new Promise((resolve) => {
    releaseCover = resolve;
  });
  const requests = [];
  const coverRequests = [];
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#5d6249"/></svg>';
  await context.route("https://res.cloudinary.com/**", async (route) => {
    if (route.request().url().includes("/cover.jpg")) {
      coverRequests.push(route.request().url());
      await coverGate;
    }
    await route.fulfill({ contentType: "image/svg+xml", body: svg });
  });
  await context.route("https://amber-hall.prakashsaas.world/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname);
    if (url.pathname === "/api/public/venues/amber-hall") return route.fulfill({ json: fixture });
    if (url.pathname.startsWith("/api/"))
      return route.fulfill({ status: 404, json: { success: false } });
    const response = await route.fetch({ url: `${baseURL}${url.pathname}${url.search}` });
    return route.fulfill({ response });
  });
  try {
    await page.goto("https://amber-hall.prakashsaas.world/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Celebrate at Amber Hall");
    const hero = page.locator(".public-hero");
    const cover = page.locator("img.public-cover");
    await expect(cover).toHaveAttribute("loading", "eager");
    await expect(cover).toHaveAttribute("fetchpriority", "high");
    await expect(cover).toHaveAttribute("decoding", "async");
    await expect(cover).toHaveAttribute("sizes", "100vw");
    await expect.poll(() => coverRequests.length).toBe(1);
    // 390 CSS px at DPR 2 needs 780 image px: a 960 candidate replaces
    // the former unconditional 1920 download. No field CWV claim is made.
    expect(coverRequests[0]).toContain("w_960,c_limit");
    const before = await hero.boundingBox();
    expect(before.height).toBeGreaterThan(300);
    await page.evaluate(() => {
      window.__imageLayoutShifts = [];
      window.__imageShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.__imageLayoutShifts.push(entry.value);
      });
      window.__imageShiftObserver.observe({ type: "layout-shift" });
    });
    releaseCover();
    await expect
      .poll(() => cover.evaluate((image) => image.complete && image.naturalWidth > 0))
      .toBe(true);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    const after = await hero.boundingBox();
    expect(after).toEqual(before);
    const imageShift = await page.evaluate(() =>
      window.__imageLayoutShifts.reduce((sum, value) => sum + value, 0),
    );
    expect(imageShift).toBeLessThan(0.01);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const belowFold = page.locator(".public-hall-image img, .public-gallery img");
    expect(await belowFold.count()).toBeGreaterThan(0);
    for (const image of await belowFold.all()) {
      await expect(image).toHaveAttribute("loading", "lazy");
      await expect(image).toHaveAttribute("decoding", "async");
      await expect(image).toHaveAttribute("srcset", /w_320.*w_960/);
    }
    await page.getByRole("link", { name: "Discover our spaces" }).click();
    await expect(page).toHaveURL(/#spaces$/);
    await page.getByRole("button", { name: "Explore availability & enquire" }).click();
    await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
    expect(
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
    ).toBe(0);
    expect(requests.filter((path) => path.startsWith("/api/"))).toEqual([
      "/api/public/venues/amber-hall",
    ]);
    expect(requests.some((path) => /\/sw\.js|pwa-icons|manifest\.webmanifest/.test(path))).toBe(
      false,
    );
    expect(await page.locator('script[src*="accounts.google.com"]').count()).toBe(0);
  } finally {
    releaseCover();
    await context.close();
  }
});

test("failed unsigned image transforms fall back once to the original URL without a broken srcset", async ({
  context,
  page,
  baseURL,
}) => {
  const imageRequests = [];
  await context.route("https://res.cloudinary.com/**", async (route) => {
    const url = route.request().url();
    imageRequests.push(url);
    if (url.includes("/f_auto,")) return route.fulfill({ status: 400 });
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"/>',
    });
  });
  await context.route("https://amber-hall.prakashsaas.world/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: fixture });
    return route.fulfill({
      response: await route.fetch({ url: `${baseURL}${url.pathname}${url.search}` }),
    });
  });
  await page.goto("https://amber-hall.prakashsaas.world/");
  const cover = page.locator("img.public-cover");
  await expect
    .poll(() => cover.evaluate((image) => image.complete && image.naturalWidth > 0))
    .toBe(true);
  expect(await cover.evaluate((image) => image.currentSrc)).toBe(source("cover"));
  await expect(cover).not.toHaveAttribute("srcset");
  await expect(cover).not.toHaveAttribute("sizes");
  expect(imageRequests.filter((url) => url === source("cover"))).toHaveLength(1);
});
