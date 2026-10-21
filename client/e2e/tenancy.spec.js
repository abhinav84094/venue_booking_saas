import { test, expect } from "@playwright/test";

const hallId = "507f1f77bcf86cd799439011";
const tenantFixture = (slug) => ({
  success: true,
  venue: {
    _id: slug === "amber-hall" ? "507f1f77bcf86cd799439012" : "507f1f77bcf86cd799439013",
    slug,
    name: slug === "amber-hall" ? "Amber Hall" : "Lotus Garden",
    description: `A private celebration at ${slug}.`,
    timezone: "Asia/Kolkata",
    address: { city: "Patna", state: "Bihar", country: "India" },
    contact: { phone: "9876543210" },
    website: { template: "classic", headline: `Welcome to ${slug}`, appearance: "light" },
  },
  halls: [
    {
      _id: hallId,
      name: `${slug} event space`,
      capacity: 300,
      pricing: [{ key: "FULL_DAY", label: "Full day", amount: 2500000, durationMinutes: 1440 }],
      enquiriesEnabled: true,
    },
  ],
});

// The browser serves the real production-built app under genuine customer
// hostnames. Only upstream API data and transport to the disposable local
// static server are fixtures. Worker HTTP/status tests run separately.
async function serveTenantOrigins(context, baseURL) {
  const requests = [];
  const receipt = {
    reference: "VENUE-BROWSER-PUBLIC-RECEIPT",
    statusToken: "disposable-public-capability-token",
    status: "ENQUIRY",
    startAt: "2027-02-04T00:00:00+05:30",
    endAt: "2027-02-05T00:00:00+05:30",
    enquiryExpiresAt: "2027-02-03T00:00:00+05:30",
    timezone: "Asia/Kolkata",
    pricingSnapshot: { label: "Full day", totalAmount: 2500000, units: 1 },
  };
  await context.route(/^https:\/\/(?:[a-z0-9.-]+\.)?prakashsaas\.world\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      const slug = url.hostname.slice(0, -".prakashsaas.world".length);
      requests.push({ url, method: request.method(), data: request.postDataJSON() });
      const base = `/api/public/venues/${slug}`;
      const json = (status, data) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (!["amber-hall", "lotus-garden"].includes(slug))
        return json(404, { success: false, message: "Venue not found or not published" });
      if (request.method() === "GET" && url.pathname === base)
        return json(200, tenantFixture(slug));
      if (request.method() === "POST" && url.pathname === `${base}/halls/${hallId}/quote`)
        return json(200, { success: true, quote: { pricingSnapshot: receipt.pricingSnapshot } });
      if (request.method() === "GET" && url.pathname === `${base}/halls/${hallId}/availability`)
        return json(200, { success: true, busy: [] });
      if (request.method() === "POST" && url.pathname === `${base}/enquiries`)
        return json(201, { success: true, enquiry: receipt });
      if (request.method() === "POST" && url.pathname === `${base}/enquiries/status`)
        return json(200, { success: true, receipt: { ...receipt, status: "CONFIRMED" } });
      return json(404, { success: false, message: "Unexpected public request" });
    }
    const response = await route.fetch({ url: `${baseURL}${url.pathname}${url.search}` });
    return route.fulfill({ response });
  });
  return requests;
}

test("two customer hostnames select distinct public venues without owner authentication or PWA", async ({
  context,
  page,
  baseURL,
}) => {
  const requests = await serveTenantOrigins(context, baseURL);
  for (const slug of ["amber-hall", "lotus-garden"]) {
    await page.goto(`https://${slug}.prakashsaas.world/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Welcome to ${slug}`);
    await expect(page.locator("[data-venue-website]")).toBeVisible();
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Install App", exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
    ).toBe(0);
  }
  expect(requests.length).toBeGreaterThanOrEqual(2);
  expect(
    requests.every(({ url }) => {
      const slug = url.hostname.slice(0, -".prakashsaas.world".length);
      return url.pathname === `/api/public/venues/${slug}`;
    }),
  ).toBe(true);
});

test("reserved, nested and unknown hosts and customer owner paths fail closed", async ({
  context,
  page,
  baseURL,
}) => {
  const requests = await serveTenantOrigins(context, baseURL);
  for (const url of [
    "https://admin.prakashsaas.world/",
    "https://cdn.prakashsaas.world/",
    "https://nested.amber-hall.prakashsaas.world/",
    "https://amber-hall.prakashsaas.world/login",
    "https://amber-hall.prakashsaas.world/venues",
    "https://amber-hall.prakashsaas.world/v/lotus-garden",
  ]) {
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: "This space is still waiting to be found." }),
    ).toBeVisible();
    await expect(page.getByLabel("Email address")).toHaveCount(0);
  }
  expect(requests).toEqual([]);
  await page.goto("https://unknown-venue.prakashsaas.world/");
  await expect(
    page.getByRole("heading", { name: "This venue is taking a little time." }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Venue not found or not published");
  expect(requests.every(({ url }) => url.pathname === "/api/public/venues/unknown-venue")).toBe(
    true,
  );
});

test("customer booking UI uses the existing public GET and POST contracts on its own hostname", async ({
  context,
  page,
  baseURL,
}) => {
  const requests = await serveTenantOrigins(context, baseURL);
  await page.goto("https://amber-hall.prakashsaas.world/");
  await page.getByLabel("From", { exact: true }).fill("2027-02-04T10:00");
  await page.getByRole("button", { name: "Check availability & quote", exact: true }).click();
  await expect(page.getByText("Your booking quote", { exact: true })).toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Public Browser Customer");
  await page.getByLabel("Phone number", { exact: true }).fill("9876543210");
  await page.getByLabel("Occasion / event type", { exact: true }).fill("Wedding");
  await page.getByLabel("Number of guests", { exact: true }).fill("120");
  await page.getByRole("button", { name: "Send your enquiry", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your enquiry is with us." })).toBeVisible();
  await page.getByRole("button", { name: "Refresh confirmation status", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your event is confirmed." })).toBeVisible();
  const base = "/api/public/venues/amber-hall";
  expect(requests.some(({ method, url }) => method === "GET" && url.pathname === base)).toBe(true);
  // Successful mutations intentionally revalidate public venue flags. Verify
  // booking contracts independently of those safe metadata refreshes.
  expect(
    requests
      .filter(({ method, url }) => !(method === "GET" && url.pathname === base))
      .map(({ method, url }) => `${method} ${url.pathname}`),
  ).toEqual([
    `POST ${base}/halls/${hallId}/quote`,
    `GET ${base}/halls/${hallId}/availability`,
    `POST ${base}/enquiries`,
    `POST ${base}/enquiries/status`,
  ]);
  const availability = requests.find(({ url }) => url.pathname.endsWith("/availability"));
  expect(availability.url.searchParams.get("startAt")).toBe("2027-02-04T00:00");
  expect(availability.url.searchParams.get("endAt")).toBe("2027-02-05T00:00");
  expect(requests.find(({ url }) => url.pathname.endsWith("/enquiries")).data).toMatchObject({
    hallId,
    guests: 120,
    expectedTotalAmount: 2500000,
    customer: { name: "Public Browser Customer", phone: "9876543210" },
  });
  expect(requests.find(({ url }) => url.pathname.endsWith("/enquiries/status")).data).toEqual({
    reference: "VENUE-BROWSER-PUBLIC-RECEIPT",
    token: "disposable-public-capability-token",
  });
  expect(requests.every(({ url }) => url.hostname === "amber-hall.prakashsaas.world")).toBe(true);
});
