import test from "node:test";
import assert from "node:assert/strict";
import { renderVenueHtml, venueMetadata, venueStructuredData } from "../../shared/venueMetadata.js";
import { renderPlatformHtml } from "../../shared/platformSeo.js";

const index = `<!doctype html><html lang="en"><head>
<title>Generic SPA</title><title>Duplicate title</title>
<meta name="description" content="Old description">
<meta name="description" content="Duplicate description">
<meta name="robots" content="noindex"><meta name="venue-appearance" content="light">
<link rel="canonical" href="https://old.invalid/">
<meta property="og:url" content="https://old.invalid/">
<meta property="og:title" content="Old title"><meta property="og:image" content="old.jpg">
<meta name="twitter:title" content="Old tweet"><meta name="twitter:card" content="summary">
<script id="platform-structured-data" type="application/ld+json">{"@type":"Organization","name":"Platform only"}</script>
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
    /name="twitter:card"/g,
    /name="twitter:title"/g,
    /name="twitter:description"/g,
    /name="twitter:image"/g,
    /id="venue-structured-data"/g,
    /name="venue-appearance"/g,
  ]) {
    assert.equal([...html.matchAll(matcher)].length, 1, String(matcher));
  }
  assert.match(html, /<title>Green Garden \| Event venue in Patna \| Prakash SaaS<\/title>/);
  assert.ok(html.includes(`rel="canonical" href="${canonical}"`));
  assert.ok(html.includes(`property="og:url" content="${canonical}"`));
  assert.match(html, /name="robots" content="index,follow,max-image-preview:large"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.doesNotMatch(html, /Platform only|Old tweet|platform-structured-data/);
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
  assert.equal(data.address.addressCountry, undefined);
  assert.deepEqual(data.image, [venue.coverImage]);
});

test("stored business categories choose accurate Schema.org types without inferring from a name", () => {
  for (const [type, expected] of [
    ["hotel", ["EventVenue", "Hotel"]],
    ["resort", ["EventVenue", "Resort"]],
    ["banquet", ["EventVenue", "LocalBusiness"]],
    ["marriage_hall", ["EventVenue", "LocalBusiness"]],
    ["party_hall", ["EventVenue", "LocalBusiness"]],
    ["conference", ["EventVenue", "LocalBusiness"]],
    ["other", "EventVenue"],
    ["toString", "EventVenue"],
    ["__proto__", "EventVenue"],
    [undefined, "EventVenue"],
  ]) {
    const current = { ...venue, type, name: "Five Star Hotel Palace" };
    assert.deepEqual(venueStructuredData(current)["@type"], expected);
    assert.doesNotMatch(
      JSON.stringify(venueStructuredData(current)),
      /starRating|aggregateRating|review|priceRange|offers|geo|addressCountry/,
    );
    assert.doesNotMatch(venueMetadata(current).title, /function|\[object Object\]/);
  }
});

test("metadata uses real venue identity and location even when venues share a tagline", () => {
  const first = venueMetadata({ ...venue, type: "banquet" });
  const second = venueMetadata({ ...venue, name: "River Palace", address: { city: "Ranchi" } });
  assert.equal(first.title, "Green Garden | Banquet hall in Patna | Prakash SaaS");
  assert.match(first.description, /^Green Garden in Patna\. /);
  assert.match(second.description, /^River Palace in Ranchi\. /);
  assert.notEqual(first.description, second.description);
  assert.ok(
    venueMetadata({ ...venue, description: "Long ".repeat(90), website: {} }).description.length <=
      160,
  );
});

test("structured data serializes only available, visible public business fields", () => {
  const complete = {
    ...venue,
    openingHours: "Mo-Fr 09:00-18:00",
    contact: { phone: "+91 9876543210", email: "events@example.com" },
    images: [
      { url: "https://images.example/gallery.jpg", alt: "A real gallery" },
      { url: venue.coverImage },
    ],
    geo: { latitude: 25.6, longitude: 85.1 },
    rating: 5,
  };
  const data = JSON.parse(JSON.stringify(venueStructuredData(complete)));
  assert.equal(data.telephone, complete.contact.phone);
  assert.equal(data.email, complete.contact.email);
  assert.equal(data.openingHours, "Mo-Fr 09:00-18:00");
  assert.equal(data.address.streetAddress, venue.address.line1);
  assert.deepEqual(data.image, [venue.coverImage, "https://images.example/gallery.jpg"]);
  for (const unsupported of ["geo", "aggregateRating", "review", "priceRange", "offers"])
    assert.equal(data[unsupported], undefined);
  assert.equal(data.address.addressCountry, undefined);
  const hidden = {
    ...complete,
    website: { sections: { contact: false, gallery: false, facilities: false } },
  };
  const hiddenData = JSON.parse(JSON.stringify(venueStructuredData(hidden)));
  for (const field of ["address", "telephone", "email", "openingHours"])
    assert.equal(hiddenData[field], undefined);
  assert.deepEqual(hiddenData.image, [venue.coverImage]);
  const html = renderVenueHtml(index, hidden);
  assert.doesNotMatch(
    html,
    /9876543210|events@example\.com|1 Main Street|gallery\.jpg|09:00-18:00/,
  );
});

test("empty or unverified fields are omitted and free-form opening prose is never guessed", () => {
  const empty = JSON.parse(JSON.stringify(venueStructuredData({ name: "Simple Venue" })));
  for (const field of ["address", "telephone", "email", "openingHours", "image", "geo"])
    assert.equal(empty[field], undefined);
  for (const hours of [
    "Every day 9am to 9pm",
    "Open 24/7",
    "Mo-Fr 27:00-30:00",
    "Mo-Fr 09:60-18:00",
    "Mo-Tu-We 09:00-18:00",
    "",
    "Mo-Fr 9:00-18:00",
  ])
    assert.equal(
      venueStructuredData({ ...venue, openingHours: hours }).openingHours,
      undefined,
      hours,
    );
  for (const hours of ["Mo-Su", "Mo,Tu,We 09:00-18:00", "Sa 10:00-24:00", "Fr-Sa 18:00-02:00"])
    assert.equal(venueStructuredData({ ...venue, openingHours: hours }).openingHours, hours);
});

test("hidden about prose is omitted from metadata and JSON-LD when no public tagline replaces it", () => {
  const hidden = {
    ...venue,
    description: "Hidden owner about prose",
    website: { sections: { about: false } },
  };
  const metadata = venueMetadata(hidden);
  assert.doesNotMatch(metadata.description, /Hidden owner about prose/);
  assert.match(metadata.description, /Green Garden in Patna/);
  assert.doesNotMatch(renderVenueHtml(index, hidden), /Hidden owner about prose/);
  const publicTagline = {
    ...hidden,
    website: { ...hidden.website, tagline: "Public welcome to our garden" },
  };
  assert.match(venueStructuredData(publicTagline).description, /Public welcome to our garden/);
});

test("social images use safe visible gallery fallback and skip unsupported schemes", () => {
  const current = {
    ...venue,
    coverImage: "",
    images: [
      { url: "javascript:alert(1)" },
      { url: "http://images.example/insecure.jpg" },
      { url: "https://images.example/real.jpg" },
    ],
  };
  assert.equal(venueMetadata(current).image, "https://images.example/real.jpg");
  const html = renderVenueHtml(index, current);
  assert.match(html, /property="og:image" content="https:\/\/images\.example\/real\.jpg"/);
  assert.match(html, /name="twitter:image:alt" content="Green Garden"/);
  assert.doesNotMatch(html, /javascript:|insecure\.jpg/);
  const hidden = { ...current, website: { sections: { gallery: false } } };
  assert.equal(venueMetadata(hidden).image, "");
  assert.match(renderVenueHtml(index, hidden), /name="twitter:card" content="summary"/);
});

test("platform SSR markup and all old structured data are replaced without removing application scripts", () => {
  const platform = index.replace(
    '<div id="root"></div>',
    '<div id="root"><!--platform-seo-content:start--><div id="platform-seo-content"><header>Platform header</header><main><div><div>Platform features</div></div></main><footer>Platform footer</footer></div><!--platform-seo-content:end--></div>',
  );
  const html = renderVenueHtml(platform, venue);
  assert.match(html, /<h1>Green Garden<\/h1>/);
  assert.doesNotMatch(
    html,
    /Platform header|Platform features|Platform footer|platform-seo-content/,
  );
  assert.equal([...html.matchAll(/type="application\/ld\+json"/g)].length, 1);
  assert.match(html, /src="\/assets\/app\.js"/);
});

test("tenant rendering replaces the actual indexable platform renderer output", () => {
  const platform = renderPlatformHtml(index, { indexable: true });
  assert.match(platform, /platform-seo-content:start/);
  assert.match(platform, /platform-structured-data/);
  const html = renderVenueHtml(platform, venue, [], "", "https://green-garden.prakashsaas.world/");
  assert.doesNotMatch(
    html,
    /platform-seo-content|platform-structured-data|Create your venue website and manage|Venue booking,/,
  );
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  assert.equal([...html.matchAll(/type="application\/ld\+json"/g)].length, 1);
  assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1);
  const data = JSON.parse(html.match(/id="venue-structured-data"[^>]*>(.*?)<\/script>/s)[1]);
  assert.equal(data.name, venue.name);
  assert.equal(data.url, "https://green-garden.prakashsaas.world/");
});

test("initial HTML preloads the same responsive hero as the public React component and remains idempotent", () => {
  const current = {
    ...venue,
    coverImage: "https://res.cloudinary.com/demo/image/upload/v123/wedding.jpg",
  };
  const first = renderVenueHtml(index, current);
  assert.match(first, /rel="preload" as="image" data-venue-hero-preload/);
  assert.match(
    first,
    /href="https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/f_auto,q_auto,w_1920,c_limit\/v123\/wedding\.jpg"/,
  );
  assert.match(first, /imagesrcset="[^\"]+320w/);
  assert.match(first, /imagesizes="100vw" fetchpriority="high"/);
  assert.equal([...renderVenueHtml(first, current).matchAll(/data-venue-hero-preload/g)].length, 1);
  assert.doesNotMatch(
    renderVenueHtml(first, { ...venue, coverImage: "" }),
    /data-venue-hero-preload/,
  );
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
    assert.match(html, /name="robots" content="noindex,follow"/);
  }
});
