import { venueImageUrl, venueImageSrcSet } from "./venueImages.js";

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

const text = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
const visible = (venue, section) => venue.website?.sections?.[section] !== false;
const typeLabels = {
  banquet: "Banquet hall",
  marriage_hall: "Marriage hall",
  party_hall: "Party hall",
  conference: "Conference space",
  hotel: "Hotel",
  resort: "Resort",
};
const httpsImage = (value) => {
  const url = absoluteWebUrl(value);
  return url && url.protocol === "https:" ? url.href : "";
};
const publicImages = (venue) => [
  ...new Set(
    [
      httpsImage(venue.coverImage),
      ...(visible(venue, "gallery")
        ? (venue.images || []).map((image) => httpsImage(image.url))
        : []),
    ].filter(Boolean),
  ),
];

// Free-form owner prose is not a reliable machine-readable schedule. Only
// serialize the documented Schema.org day/time notation, without interpreting
// timezones, guessing missing days, or treating an unknown schedule as 24/7.
const schemaOpeningHours = (value) => {
  const hours = text(value);
  const day = "(?:Mo|Tu|We|Th|Fr|Sa|Su)";
  const time = "(?:[01]\\d|2[0-3]):[0-5]\\d";
  const days = `${day}(?:-${day})?(?:,${day}(?:-${day})?)*`;
  const schedule = new RegExp(`^${days}(?: ${time}-(?:${time}|24:00))?$`);
  return hours && schedule.test(hours) ? hours : undefined;
};

export function venueMetadata(venue, canonicalUrl = "") {
  const canonical = absoluteWebUrl(canonicalUrl);
  if (canonical) {
    canonical.search = "";
    canonical.hash = "";
  }
  const name = text(venue.name);
  const city = text(venue.address?.city);
  const kind = Object.hasOwn(typeLabels, venue.type) ? typeLabels[venue.type] : "";
  const context = city ? `${kind || "Event venue"} in ${city}` : kind;
  const storedDescription = text(
    venue.website?.tagline || (visible(venue, "about") ? venue.description : ""),
  );
  const description = storedDescription
    ? `${name}${city ? ` in ${city}` : ""}. ${storedDescription}`
    : `Explore ${name}${city ? ` in ${city}` : ""} and enquire about your next event.`;
  return {
    title: `${name}${context ? ` | ${context}` : ""} | Prakash SaaS`,
    description:
      description.length > 160
        ? `${description.slice(0, 157).replace(/\s+\S*$/, "")}…`
        : description,
    canonicalUrl: canonical ? canonical.href : "",
    image: publicImages(venue)[0] || "",
    imageAlt: name,
  };
}

export function venueStructuredData(venue, canonicalUrl = "") {
  const metadata = venueMetadata(venue, canonicalUrl);
  const types = {
    hotel: ["EventVenue", "Hotel"],
    resort: ["EventVenue", "Resort"],
    banquet: ["EventVenue", "LocalBusiness"],
    marriage_hall: ["EventVenue", "LocalBusiness"],
    party_hall: ["EventVenue", "LocalBusiness"],
    conference: ["EventVenue", "LocalBusiness"],
  };
  const showContact = visible(venue, "contact");
  const address = showContact
    ? {
        streetAddress: text(venue.address?.line1) || undefined,
        addressLocality: text(venue.address?.city) || undefined,
        addressRegion: text(venue.address?.state) || undefined,
        postalCode: text(venue.address?.postalCode) || undefined,
      }
    : {};
  const hasAddress = Object.values(address).some(Boolean);
  const images = publicImages(venue);
  return {
    "@context": "https://schema.org",
    // EventVenue describes the place; explicit stored business categories can
    // additionally identify its actual business subtype. A template name or
    // a word in the venue name never implies Hotel/Resort or a rating.
    "@type": Object.hasOwn(types, venue.type) ? types[venue.type] : "EventVenue",
    "@id": metadata.canonicalUrl ? `${metadata.canonicalUrl}#venue` : undefined,
    url: metadata.canonicalUrl || undefined,
    name: venue.name,
    description: metadata.description,
    telephone: showContact ? text(venue.contact?.phone) || undefined : undefined,
    email: showContact ? text(venue.contact?.email) || undefined : undefined,
    openingHours: showContact ? schemaOpeningHours(venue.openingHours) : undefined,
    image: images.length ? images : undefined,
    address: hasAddress ? { "@type": "PostalAddress", ...address } : undefined,
  };
}

const attribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3]) : "";
};

const stripVenueMetadata = (index) =>
  index
    .replace(/<!--platform-seo-content:start-->[\s\S]*?<!--platform-seo-content:end-->/gi, "")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, (tag) => {
      const name = attribute(tag, "name").toLowerCase();
      const property = attribute(tag, "property").toLowerCase();
      return [
        "description",
        "application-name",
        "venue-appearance",
        "robots",
        "googlebot",
        "bingbot",
      ].includes(name) ||
        name.startsWith("twitter:") ||
        property.startsWith("twitter:") ||
        property.startsWith("og:")
        ? ""
        : tag;
    })
    .replace(/<link\b[^>]*>/gi, (tag) =>
      attribute(tag, "rel").toLowerCase().split(/\s+/).includes("canonical") ||
      /\bdata-venue-hero-preload(?:\s|=|>)/i.test(tag)
        ? ""
        : tag,
    )
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, (tag) => {
      const openingTag = tag.slice(0, tag.indexOf(">") + 1);
      return attribute(openingTag, "type").toLowerCase() === "application/ld+json" ||
        ["venue-structured-data", "platform-structured-data"].includes(attribute(openingTag, "id"))
        ? ""
        : tag;
    });

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
  const robots = metadata.canonicalUrl ? "index,follow,max-image-preview:large" : "noindex,follow";
  const head = `<meta name="venue-appearance" content="${appearance}"><meta name="application-name" content="Prakash SaaS"><title>${escapeHtml(metadata.title)}</title><meta name="description" content="${escapeHtml(metadata.description)}"><meta name="robots" content="${robots}">${metadata.canonicalUrl ? `<link rel="canonical" href="${escapeHtml(metadata.canonicalUrl)}"><meta property="og:url" content="${escapeHtml(metadata.canonicalUrl)}">` : ""}<meta property="og:type" content="website"><meta property="og:site_name" content="${escapeHtml(venue.name)}"><meta property="og:title" content="${escapeHtml(metadata.title)}"><meta property="og:description" content="${escapeHtml(metadata.description)}"><meta name="twitter:card" content="${metadata.image ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${escapeHtml(metadata.title)}"><meta name="twitter:description" content="${escapeHtml(metadata.description)}">${metadata.image ? `<meta property="og:image" content="${escapeHtml(metadata.image)}"><meta property="og:image:alt" content="${escapeHtml(metadata.imageAlt)}"><meta name="twitter:image" content="${escapeHtml(metadata.image)}"><meta name="twitter:image:alt" content="${escapeHtml(metadata.imageAlt)}">` : ""}<script id="venue-structured-data" type="application/ld+json"${nonce ? ` nonce="${escapeHtml(nonce)}"` : ""}>${inlineJson(venueStructuredData(venue, metadata.canonicalUrl))}</script>`;
  const sections = venue.website?.sections || {};
  const visible = (section) => sections[section] !== false;
  const heading = venue.website?.headline || venue.name;
  const intro = venue.website?.tagline || "";
  const body = `<main><h1>${escapeHtml(heading)}</h1>${heading !== venue.name ? `<p>${escapeHtml(venue.name)}</p>` : ""}${intro ? `<p>${escapeHtml(intro)}</p>` : ""}${visible("about") && venue.description ? `<section><h2>About the venue</h2><p>${escapeHtml(venue.description)}</p></section>` : ""}${visible("halls") ? `<section><h2>Our event spaces</h2>${halls.map((hall) => `<article><h3>${escapeHtml(hall.name)}</h3><p>${escapeHtml(hall.description)}</p><p>Capacity: ${escapeHtml(hall.capacity)} guests</p></article>`).join("")}</section>` : ""}${visible("facilities") && venue.facilities?.length ? `<section><h2>Facilities</h2><ul>${venue.facilities.map((facility) => `<li>${escapeHtml(facility)}</li>`).join("")}</ul></section>` : ""}${visible("contact") ? `<section><h2>Visit us</h2><p>${escapeHtml([venue.address?.line1, venue.address?.city, venue.address?.state, venue.address?.postalCode].filter(Boolean).join(", "))}</p>${venue.contact?.phone ? `<p>${escapeHtml(venue.contact.phone)}</p>` : ""}${venue.contact?.email ? `<p>${escapeHtml(venue.contact.email)}</p>` : ""}${venue.openingHours ? `<p>Visiting hours: ${escapeHtml(venue.openingHours)}</p>` : ""}</section>` : ""}</main><footer>Prakash SaaS</footer>`;
  const heroUrl = httpsImage(venue.coverImage);
  const heroSrcSet = heroUrl ? venueImageSrcSet(heroUrl, 1920) : "";
  const preload = heroUrl
    ? `<link rel="preload" as="image" data-venue-hero-preload href="${escapeHtml(venueImageUrl(heroUrl, 1920))}"${heroSrcSet ? ` imagesrcset="${escapeHtml(heroSrcSet)}" imagesizes="100vw"` : ""} fetchpriority="high">`
    : "";
  let html = stripVenueMetadata(index).replace(
    /<html\b([^>]*)>/i,
    (_tag, attributes) =>
      `<html${attributes.replace(/\sdata-website-appearance\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")} data-website-appearance="${appearance}">`,
  );
  // Inject before theme-init so saved appearance is available to the blocking
  // bootstrap. Fragment inputs remain supported by the existing server tests.
  html = /<head\b[^>]*>/i.test(html)
    ? html.replace(/<head\b[^>]*>/i, (tag) => `${tag}${head}${preload}`)
    : `${head}${preload}${html}`;
  return html.replace(
    /(<div\b[^>]*\bid=["']root["'][^>]*>)\s*(?:<main>[\s\S]*?<\/main><footer>Prakash SaaS<\/footer>)?\s*<\/div>/i,
    (_tag, open) => `${open}${body}</div>`,
  );
}
