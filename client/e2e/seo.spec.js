import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createWorker } from "../../edge/venue-wildcard-router/src/worker.js";
import { createPlatformSeo } from "../netlify/edge-functions/platform-seo.js";

const shell = () => readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const venues = {
  "amber-hall": { slug: "amber-hall", name: 'Amber & "Garden" <Hall>', type: "banquet", address: { city: "Patna", state: "Bihar" }, description: "Celebrations beside the garden.", contact: { phone: "+919876543210" }, website: { tagline: 'Your event <script>alert("unsafe")</script>' } },
  "lotus-resort": { slug: "lotus-resort", name: "Lotus Resort", type: "resort", address: { city: "Pune" }, description: "Private event spaces.", website: {} },
};
const worker = createWorker({ fetch: async (input) => {
  const url = new URL(input);
  if (url.hostname === "venue-booking-saas.netlify.app") return new Response(await shell(), { headers: { "content-type": "text/html" } });
  const venue = venues[url.pathname.split("/").pop()];
  return venue ? Response.json({ success: true, venue, halls: [] }) : Response.json({ success: false }, { status: 404 });
} });
const edge = createPlatformSeo({ fetch: async () => { throw new Error("Unexpected backend request"); } });
const edgeContext = { next: async () => new Response(await shell(), { headers: { "content-type": "text/html" } }) };
const fulfill = async (route, response) => route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });

test("two production tenants expose factual escaped metadata and visible content without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await context.route("https://**.prakashsaas.world/**", async (route) => {
    if (new URL(route.request().url()).pathname !== "/") return route.fulfill({ status: 404, body: "" });
    return fulfill(route, await worker.fetch(new Request(route.request().url())));
  });
  const page = await context.newPage();
  try {
    for (const [slug, venue] of Object.entries(venues)) {
      const response = await page.goto(`https://${slug}.prakashsaas.world/`);
      expect(response.status()).toBe(200);
      await expect(page).toHaveTitle(new RegExp(venue.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://${slug}.prakashsaas.world/`);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `https://${slug}.prakashsaas.world/`);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow,max-image-preview:large");
      await expect(page.locator('meta[name="twitter:title"]')).toHaveCount(1);
      await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
      const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
      expect(schema.name).toBe(venue.name);
      expect(schema.url).toBe(`https://${slug}.prakashsaas.world/`);
      expect(schema.address.addressLocality).toBe(venue.address.city);
      expect(schema.address.addressCountry).toBeUndefined();
      expect(schema.aggregateRating).toBeUndefined();
      expect(schema.offers).toBeUndefined();
      expect(await page.locator("main").textContent()).toContain(venue.name);
      expect(await page.locator("main").textContent()).not.toContain("Venue booking,beautifullyorganized.");
      await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
      await expect(page.locator("script:not([src]):not([type='application/ld+json'])")).toHaveCount(0);
    }
    const response = await page.goto("https://missing-hall.prakashsaas.world/");
    expect(response.status()).toBe(404);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  } finally { await context.close(); }
});

test("platform initial source is indexable only on the apex and owner HTML is noindex", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await context.route("https://**/*", async (route) => {
    if (new URL(route.request().url()).pathname.startsWith("/assets/")) return route.fulfill({ status: 404, body: "" });
    return fulfill(route, await edge(new Request(route.request().url()), edgeContext));
  });
  const page = await context.newPage();
  try {
    const response = await page.goto("https://prakashsaas.world/");
    expect(response.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Venue booking,");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://prakashsaas.world/");
    const graph = JSON.parse(await page.locator("#platform-structured-data").textContent())["@graph"];
    expect(graph.map((item) => item["@type"])).toEqual(["Organization", "SoftwareApplication"]);
    await page.goto("https://deploy-preview-10--venue-booking-saas.netlify.app/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
    await expect(page.locator('link[rel="canonical"], script[type="application/ld+json"]')).toHaveCount(0);
    await page.goto("https://prakashsaas.world/login");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
    await expect(page.locator("#platform-seo-content")).toHaveCount(0);
    expect((await page.goto("https://prakashsaas.world/not-a-page")).status()).toBe(404);
  } finally { await context.close(); }
});

test("sitemaps from the real backend and both edges parse as valid namespaced XML", async ({ page, request }) => {
  const response = await request.get("/api/public/seo/sitemap-index.xml");
  expect(response.status()).toBe(200);
  const platformSitemap = await edge(new Request("https://prakashsaas.world/sitemaps/platform.xml"), edgeContext);
  const venueSitemap = await worker.fetch(new Request("https://amber-hall.prakashsaas.world/sitemap.xml"));
  const documents = [await response.text(), await platformSitemap.text(), await venueSitemap.text()];
  for (const xml of documents) {
    const parsed = await page.evaluate((source) => {
      const document = new DOMParser().parseFromString(source, "application/xml");
      return { error: document.querySelector("parsererror")?.textContent, namespace: document.documentElement.namespaceURI, root: document.documentElement.localName, urls: [...document.querySelectorAll("loc")].map((node) => node.textContent) };
    }, xml);
    expect(parsed.error).toBeUndefined();
    expect(parsed.namespace).toBe("http://www.sitemaps.org/schemas/sitemap/0.9");
    expect(["sitemapindex", "urlset"]).toContain(parsed.root);
    expect(parsed.urls.length).toBeGreaterThan(0);
    for (const url of parsed.urls) expect(url).toMatch(/^https:\/\/(?:[a-z0-9-]+\.)?prakashsaas\.world\//);
  }
});

test("SPA preview navigation clears canonical metadata while loading and restores the apex on return", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let releaseVenue;
  const gate = new Promise((resolve) => { releaseVenue = resolve; });
  await context.route("https://accounts.google.com/**", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
  await context.route("https://prakashsaas.world/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/assets/") || url.pathname === "/theme-init.js") return route.fulfill({ response: await route.fetch({ url: `${baseURL}${url.pathname}${url.search}` }) });
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: { success: true, user: null } });
    if (url.pathname === "/api/public/venues/amber-hall") {
      await gate;
      return route.fulfill({ json: { success: true, venue: venues["amber-hall"], halls: [] } });
    }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, json: { success: false } });
    return fulfill(route, await edge(new Request(route.request().url()), edgeContext));
  });
  try {
    await page.goto("https://prakashsaas.world/");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://prakashsaas.world/");
    await page.evaluate(() => { history.pushState({}, "", "/v/amber-hall"); dispatchEvent(new PopStateEvent("popstate")); });
    await expect(page).toHaveURL("https://prakashsaas.world/v/amber-hall");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
    await expect(page.locator('link[rel="canonical"], #platform-structured-data')).toHaveCount(0);
    releaseVenue();
    await expect(page).toHaveTitle(/Amber & "Garden" <Hall>/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://prakashsaas.world/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow,max-image-preview:large");
    await expect(page.locator("#platform-structured-data")).toHaveCount(1);
  } finally { releaseVenue(); await context.close(); }
});
