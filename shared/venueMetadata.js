// Shared by the edge renderer, optional Express renderer and browser updates.
// Callers must construct canonicalUrl from deployment configuration and a
// validated venue slug, never from an untrusted Host or forwarded header.
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );

const absoluteWebUrl = (value) => {
  if (typeof value !== "string" || !value) return "";
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    return url;
  } catch {
    return "";
  }
};

export function venueMetadata(venue, canonicalUrl = "") {
  const canonical = absoluteWebUrl(canonicalUrl);
  if (canonical) {
    canonical.search = "";
    canonical.hash = "";
  }
  return {
    title: `${venue.name} | Prakash SaaS`,
    description: (
      venue.website?.tagline ||
      venue.description ||
      `Explore halls and enquire about your next event at ${venue.name}.`
    ).slice(0, 160),
    canonicalUrl: canonical ? canonical.href : "",
    image: absoluteWebUrl(venue.coverImage)?.href || "",
  };
}

export function venueStructuredData(venue, canonicalUrl = "") {
  const metadata = venueMetadata(venue, canonicalUrl);
  return {
    "@context": "https://schema.org",
    "@type": "EventVenue",
    "@id": metadata.canonicalUrl ? `${metadata.canonicalUrl}#venue` : undefined,
    url: metadata.canonicalUrl || undefined,
    name: venue.name,
    description: metadata.description,
    telephone: venue.contact?.phone || undefined,
    image: metadata.image || undefined,
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

const attribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3]) : "";
};

const stripVenueMetadata = (index) =>
  index
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, (tag) => {
      const name = attribute(tag, "name").toLowerCase();
      const property = attribute(tag, "property").toLowerCase();
      return ["description", "application-name", "venue-appearance", "robots"].includes(name) ||
        property.startsWith("og:")
        ? ""
        : tag;
    })
    .replace(/<link\b[^>]*>/gi, (tag) =>
      attribute(tag, "rel").toLowerCase().split(/\s+/).includes("canonical") ? "" : tag,
    )
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, (tag) =>
      attribute(tag.slice(0, tag.indexOf(">") + 1), "id") === "venue-structured-data" ? "" : tag,
    );

const inlineJson = (value) =>
  JSON.stringify(value).replace(
    /[<&\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );

export function renderVenueHtml(index, venue, halls = [], nonce = "", canonicalUrl = "") {
  const appearance = ["light", "dark", "system"].includes(venue.website?.appearance)
    ? venue.website.appearance
    : "system";
  const metadata = venueMetadata(venue, canonicalUrl);
  const head = `<meta name="venue-appearance" content="${appearance}"><meta name="application-name" content="Prakash SaaS"><title>${escapeHtml(metadata.title)}</title><meta name="description" content="${escapeHtml(metadata.description)}"><meta name="robots" content="index,follow">${metadata.canonicalUrl ? `<link rel="canonical" href="${escapeHtml(metadata.canonicalUrl)}"><meta property="og:url" content="${escapeHtml(metadata.canonicalUrl)}">` : ""}<meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(metadata.title)}"><meta property="og:description" content="${escapeHtml(metadata.description)}">${metadata.image ? `<meta property="og:image" content="${escapeHtml(metadata.image)}">` : ""}<script id="venue-structured-data" type="application/ld+json"${nonce ? ` nonce="${escapeHtml(nonce)}"` : ""}>${inlineJson(venueStructuredData(venue, metadata.canonicalUrl))}</script>`;
  const sections = venue.website?.sections || {};
  const visible = (section) => sections[section] !== false;
  const heading = venue.website?.headline || venue.name;
  const intro = venue.website?.tagline || "";
  const body = `<main><h1>${escapeHtml(heading)}</h1>${heading !== venue.name ? `<p>${escapeHtml(venue.name)}</p>` : ""}${intro ? `<p>${escapeHtml(intro)}</p>` : ""}${visible("about") && venue.description ? `<section><h2>About the venue</h2><p>${escapeHtml(venue.description)}</p></section>` : ""}${visible("halls") ? `<section><h2>Our event spaces</h2>${halls.map((hall) => `<article><h3>${escapeHtml(hall.name)}</h3><p>${escapeHtml(hall.description)}</p><p>Capacity: ${escapeHtml(hall.capacity)} guests</p></article>`).join("")}</section>` : ""}${visible("facilities") && venue.facilities?.length ? `<section><h2>Facilities</h2><ul>${venue.facilities.map((facility) => `<li>${escapeHtml(facility)}</li>`).join("")}</ul></section>` : ""}${visible("contact") ? `<section><h2>Visit us</h2><p>${escapeHtml(venue.address?.line1)}, ${escapeHtml(venue.address?.city)}</p><p>${escapeHtml(venue.contact?.phone)}</p></section>` : ""}</main><footer>Prakash SaaS</footer>`;
  let html = stripVenueMetadata(index).replace(
    /<html\b([^>]*)>/i,
    (_tag, attributes) =>
      `<html${attributes.replace(/\sdata-website-appearance\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")} data-website-appearance="${appearance}">`,
  );
  // Inject before theme-init so saved appearance is available to the blocking
  // bootstrap. Fragment inputs remain supported by the existing server tests.
  html = /<head\b[^>]*>/i.test(html)
    ? html.replace(/<head\b[^>]*>/i, (tag) => `${tag}${head}`)
    : `${head}${html}`;
  return html.replace(
    /(<div\b[^>]*\bid=["']root["'][^>]*>)\s*(?:<main>[\s\S]*?<\/main><footer>Prakash SaaS<\/footer>)?\s*<\/div>/i,
    (_tag, open) => `${open}${body}</div>`,
  );
}
