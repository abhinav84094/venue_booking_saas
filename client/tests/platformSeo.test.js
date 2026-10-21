import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PLATFORM_ORIGIN,
  platformCopy,
  platformMetadata,
  platformStructuredData,
  renderPlatformHtml,
} from "../../shared/platformSeo.js";
import { platformSeo } from "../build/platformSeo.js";

const shell = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>Old title</title><meta name="description" content="Old description"><meta name="robots" content="noindex"><link rel="canonical" href="https://old.example/"><meta property="og:title" content="Old social title"><meta name="twitter:card" content="old"><script id="venue-structured-data" type="application/ld+json">{"@type":"EventVenue"}</script><script src="/theme-init.js"></script></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>`;

test("platform metadata describes the existing product and one canonical marketing page", () => {
  const metadata = platformMetadata();
  assert.equal(metadata.canonicalUrl, `${PLATFORM_ORIGIN}/`);
  assert.match(metadata.title, /Venue Booking.*Prakash SaaS/);
  assert.match(metadata.description, /hall availability.*customer enquiries.*recorded payments/);
  assert.ok(metadata.description.length <= 160);
  assert.equal(new URL(metadata.image).origin, PLATFORM_ORIGIN);
  assert.doesNotMatch(JSON.stringify(metadata), /guarantee|best in|rating|₹|free trial/i);
});

test("platform JSON-LD is valid factual Organization and SoftwareApplication data", () => {
  const data = JSON.parse(JSON.stringify(platformStructuredData()));
  assert.equal(data["@context"], "https://schema.org");
  assert.deepEqual(
    data["@graph"].map((item) => item["@type"]),
    ["Organization", "SoftwareApplication"],
  );
  const [organization, application] = data["@graph"];
  assert.equal(application.publisher["@id"], organization["@id"]);
  assert.equal(application.operatingSystem, "Web");
  assert.equal(application.applicationCategory, "BusinessApplication");
  assert.deepEqual(application.featureList, platformCopy.workspace);
  assert.doesNotMatch(
    JSON.stringify(data),
    /aggregateRating|review|offers|price|telephone|streetAddress/,
  );
});

test("canonical platform HTML contains meaningful initial visible content and real internal links", () => {
  const html = renderPlatformHtml(shell, { indexable: true });
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(
    html,
    /<h1 id="platform-heading">Venue booking,<br>beautifully<br>organized\.<\/h1>/,
  );
  assert.match(html, /<main>/);
  assert.match(html, /<h2 id="experience-heading">/);
  assert.match(html, /<h3>Hall pricing and capacity\.<\/h3>/);
  assert.match(html, /href="#experience"/);
  assert.match(html, /href="#workspace"/);
  assert.doesNotMatch(html, /href="\/(?:features|pricing|cities)\b/);
  assert.match(html, /name="robots" content="index,follow,max-image-preview:large"/);
  assert.match(html, /rel="canonical" href="https:\/\/prakashsaas\.world\/"/);
  const json = html.match(
    /<script id="platform-structured-data" type="application\/ld\+json">(.*?)<\/script>/,
  )[1];
  assert.deepEqual(JSON.parse(json), platformStructuredData());
});

test("platform rendering replaces metadata once and preserves app assets, viewport and theme bootstrap", () => {
  const html = renderPlatformHtml(renderPlatformHtml(shell));
  for (const pattern of [
    /<title>/g,
    /name="description"/g,
    /name="robots"/g,
    /rel="canonical"/g,
    /property="og:title"/g,
    /name="twitter:card"/g,
    /id="platform-structured-data"/g,
    /id="platform-seo-content"/g,
  ]) {
    assert.equal([...html.matchAll(pattern)].length, 1, String(pattern));
  }
  assert.doesNotMatch(html, /Old title|Old description|old\.example|"EventVenue"/);
  assert.match(html, /src="\/theme-init\.js"/);
  assert.match(html, /name="viewport" content="width=device-width"/);
  assert.match(html, /type="module" src="\/assets\/app\.js"/);
  assert.match(html, /Venue Booking &amp; Management Software/);
  assert.match(html, /<meta name="twitter:image:alt"/);
});

test("raw preview build fails closed for indexing without a production canonical or entity JSON-LD", () => {
  const html = renderPlatformHtml(renderPlatformHtml(shell), { indexable: false });
  assert.match(html, /name="robots" content="noindex,follow"/);
  assert.doesNotMatch(html, /rel="canonical"|property="og:url"|application\/ld\+json/);
  assert.match(html, /id="platform-heading"/);
  const plugin = platformSeo();
  assert.equal(plugin.apply, "build");
  assert.equal(plugin.transformIndexHtml.order, "pre");
  assert.equal(
    plugin.transformIndexHtml.handler(shell),
    renderPlatformHtml(shell, { indexable: false }),
  );
});

test("canonical platform rendering removes stale crawler restrictions and alternate Twitter metadata", () => {
  const old = shell.replace(
    "</head>",
    '<meta name="googlebot" content="noindex"><meta name="bingbot" content="noindex"><meta property="twitter:title" content="Old alternate tweet"></head>',
  );
  const html = renderPlatformHtml(old, { indexable: true });
  assert.doesNotMatch(
    html,
    /name="googlebot"|name="bingbot"|property="twitter:title"|Old alternate tweet/,
  );
  assert.match(html, /name="robots" content="index,follow,max-image-preview:large"/);
  assert.equal([...html.matchAll(/name="twitter:title"/g)].length, 1);
});

test("React homepage shares truthful fallback copy and loads eagerly to avoid a landing chunk spinner", async () => {
  const [landing, app] = await Promise.all([
    readFile(new URL("../src/pages/LandingPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(landing, /platformCopy\.heroLines/);
  assert.match(landing, /platformCopy\.features\.map/);
  assert.match(landing, /platformCopy\.workspace\.map/);
  assert.match(app, /import Landing from "\.\/pages\/LandingPage"/);
  assert.doesNotMatch(app, /lazy\(\(\) => import\("\.\/pages\/LandingPage"\)/);
});
