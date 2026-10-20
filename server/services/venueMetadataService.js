// Server-rendered fallback content uses the same shared venue settings as templates.
const escapeHtml = (value) =>
  String(value || "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
export function venueStructuredData(venue) {
  return {
    "@context": "https://schema.org",
    "@type": "EventVenue",
    name: venue.name,
    description: venue.description,
    telephone: venue.contact?.phone || undefined,
    image: venue.coverImage || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: venue.address?.line1,
      addressLocality: venue.address?.city,
      addressRegion: venue.address?.state,
      postalCode: venue.address?.postalCode,
      addressCountry: "IN",
    },
  };
}
export function renderVenueHtml(index, venue, halls, nonce = "") {
  const appearance = ["light", "dark", "system"].includes(venue.website?.appearance)
    ? venue.website.appearance
    : "system";
  const title = `${venue.name} | Prakash SaaS`,
    description = (
      venue.website?.tagline ||
      venue.description ||
      `Explore halls and enquire about your next event at ${venue.name}.`
    ).slice(0, 160);
  const head = `<meta name="application-name" content="Prakash SaaS"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">${venue.coverImage ? `<meta property="og:image" content="${escapeHtml(venue.coverImage)}">` : ""}<script id="venue-structured-data" type="application/ld+json" nonce="${escapeHtml(nonce)}">${JSON.stringify(venueStructuredData(venue)).replace(/</g, "\\u003c")}</script>`;
  const sections = venue.website?.sections || {};
  const visible = (section) => sections[section] !== false;
  const heading = venue.website?.headline || venue.name;
  const intro = venue.website?.tagline || "";
  const body = `<main><h1>${escapeHtml(heading)}</h1>${heading !== venue.name ? `<p>${escapeHtml(venue.name)}</p>` : ""}${intro ? `<p>${escapeHtml(intro)}</p>` : ""}${visible("about") && venue.description ? `<section><h2>About the venue</h2><p>${escapeHtml(venue.description)}</p></section>` : ""}${visible("halls") ? `<section><h2>Our event spaces</h2>${halls.map((h) => `<article><h3>${escapeHtml(h.name)}</h3><p>${escapeHtml(h.description)}</p><p>Capacity: ${h.capacity} guests</p></article>`).join("")}</section>` : ""}${visible("facilities") && venue.facilities?.length ? `<section><h2>Facilities</h2><ul>${venue.facilities.map((facility) => `<li>${escapeHtml(facility)}</li>`).join("")}</ul></section>` : ""}${visible("contact") ? `<section><h2>Visit us</h2><p>${escapeHtml(venue.address?.line1)}, ${escapeHtml(venue.address?.city)}</p><p>${escapeHtml(venue.contact?.phone)}</p></section>` : ""}</main><footer>Prakash SaaS</footer>`;
  return index
    .replace(/<html\b([^>]*)>/i, `<html$1 data-website-appearance="${appearance}">`)
    .replace(/<head\b[^>]*>/i, (tag) => `${tag}<meta name="venue-appearance" content="${appearance}">`)
    .replace(/<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/gi, "")
    .replace(/<title>.*?<\/title>/s, head)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}
