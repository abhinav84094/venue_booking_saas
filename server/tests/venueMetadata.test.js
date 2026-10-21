import test from "node:test";
import assert from "node:assert/strict";
import { renderVenueHtml, venueMetadata, venueStructuredData } from "../../shared/venueMetadata.js";

const index = `<!doctype html><html lang="en"><head>
<title>Generic SPA</title><title>Duplicate title</title>
<meta name="description" content="Old description">
<meta name="description" content="Duplicate description">
<meta name="robots" content="noindex"><meta name="venue-appearance" content="light">
<link rel="canonical" href="https://old.invalid/">
<meta property="og:url" content="https://old.invalid/">
<meta property="og:title" content="Old title"><meta property="og:image" content="old.jpg">
<script id="venue-structured-data" type="application/ld+json">{"name":"Old venue"}</script>
<script src="/theme-init.js"></script></head><body><div id="root"></div>
<script type="module" src="/assets/app.js"></script></body></html>`;
const venue = {
  name: "Green Garden",
  slug: "green-garden",
  description: "Celebrate with us",
  coverImage: "https://images.example/green.jpg",
  address: { line1: "1 Main Street", city: "Patna", state: "Bihar", postalCode: "800001" },
  contact: { phone: "9876543210" },
  website: { tagline: "A garden for your next celebration", appearance: "dark" },
};

test("initial HTML contains one current metadata set and canonical EventVenue identity", () => {
  const canonical = "https://green-garden.prakashsaas.world/";
  const html = renderVenueHtml(index, venue, [], "edge-nonce", `${canonical}?campaign=test#old`);
  for (const matcher of [
    /<title>/g,
    /name="description"/g,
    /rel="canonical"/g,
    /property="og:url"/g,
    /property="og:title"/g,
    /property="og:description"/g,
    /property="og:type"/g,
    /property="og:image"/g,
    /id="venue-structured-data"/g,
    /name="venue-appearance"/g,
  ]) {
    assert.equal([...html.matchAll(matcher)].length, 1, String(matcher));
  }
  assert.match(html, /<title>Green Garden \| Prakash SaaS<\/title>/);
  assert.ok(html.includes(`rel="canonical" href="${canonical}"`));
  assert.ok(html.includes(`property="og:url" content="${canonical}"`));
  assert.match(html, /name="robots" content="index,follow"/);
  assert.match(html, /nonce="edge-nonce"/);
  assert.match(html, /<script src="\/theme-init.js"><\/script>/);
  assert.match(html, /<script type="module" src="\/assets\/app.js"><\/script>/);
  assert.doesNotMatch(html, /Old venue|Old title|old\.invalid|Duplicate|campaign=test|#old/);
  assert.ok(html.indexOf('name="venue-appearance"') < html.indexOf('src="/theme-init.js"'));
  const data = JSON.parse(html.match(/id="venue-structured-data"[^>]*>(.*?)<\/script>/s)[1]);
  assert.equal(data["@type"], "EventVenue");
  assert.equal(data.url, canonical);
  assert.equal(data["@id"], `${canonical}#venue`);
  assert.equal(data.address.addressLocality, "Patna");
});

test("rendering a second venue replaces the first venue's initial metadata and body", () => {
  const first = renderVenueHtml(index, venue, [], "", "https://green-garden.prakashsaas.world/");
  const second = renderVenueHtml(
    first,
    { name: "Royal Palace", slug: "royal-palace", website: { appearance: "light" } },
    [],
    "",
    "https://royal-palace.prakashsaas.world/",
  );
  assert.doesNotMatch(
    second,
    /green-garden|Green Garden|green\.jpg|data-website-appearance="dark"/,
  );
  assert.match(second, /https:\/\/royal-palace\.prakashsaas\.world\//);
  assert.equal([...second.matchAll(/<h1>Royal Palace<\/h1>/g)].length, 1);
  assert.equal([...second.matchAll(/<title>/g)].length, 1);
  assert.equal([...second.matchAll(/data-website-appearance=/g)].length, 1);
  assert.doesNotMatch(second, /property="og:image"/);
});

test("HTML attributes, fallback content and inline structured data cannot inject executable HTML", () => {
  const hostile = {
    name: 'Bad </title><script>alert("name")</script>',
    description: '</script><script>alert("description")</script>\u2028',
    coverImage: 'https://images.example/a.jpg?x=" onload="alert(1)',
    website: { appearance: 'dark" onclick="alert(1)' },
    facilities: ['<img src=x onerror="alert(1)">'],
  };
  const html = renderVenueHtml(
    index,
    hostile,
    [{ name: "<svg onload=alert(1)>", capacity: "<script>alert(1)</script>" }],
    'nonce" onload="x',
    "https://safe-venue.prakashsaas.world/",
  );
  assert.doesNotMatch(html, /<script>alert|<img src=x|<svg onload|nonce="nonce" onload/);
  assert.match(html, /\\u003c\/script>/);
  assert.match(html, /data-website-appearance="system"/);
  const data = JSON.parse(html.match(/id="venue-structured-data"[^>]*>(.*?)<\/script>/s)[1]);
  assert.equal(data.name, hostile.name);
  assert.match(data.description, /alert\("description"\)/);
});

test("metadata omits unsafe or absent canonical and image URLs", () => {
  for (const canonical of [
    "",
    "/relative",
    "javascript:alert(1)",
    "https://user:pass@example.com/",
  ]) {
    const unsafe = { ...venue, coverImage: "javascript:alert(1)" };
    const metadata = venueMetadata(unsafe, canonical);
    assert.equal(metadata.canonicalUrl, "");
    assert.equal(metadata.image, "");
    const structuredData = venueStructuredData(unsafe, canonical);
    assert.equal(structuredData.url, undefined);
    assert.equal(structuredData["@id"], undefined);
    const html = renderVenueHtml(index, unsafe, [], "", canonical);
    assert.doesNotMatch(html, /rel="canonical"|property="og:url"|property="og:image"/);
  }
});
