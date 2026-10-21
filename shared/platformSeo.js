import { escapeHtml } from "./venueMetadata.js";

// The platform has one public marketing page. Feature links are real sections,
// not synthetic landing pages, and subscription prices remain in the workspace.
export const PLATFORM_ORIGIN = "https://prakashsaas.world";
export const PLATFORM_NAME = "Prakash SaaS Venue Booking";
export const platformCopy = Object.freeze({
  title: "Venue Booking & Management Software | Prakash SaaS",
  description:
    "Create your venue website and manage hall availability, customer enquiries, bookings and recorded payments with Prakash SaaS venue booking software.",
  heroLines: ["Venue booking,", "beautifully", "organized."],
  introduction:
    "Create your venue website and bring hall availability, customer enquiries, bookings and recorded payments together in one thoughtful workspace.",
  features: [
    {
      n: "01",
      title: "Your venue website.",
      text: "Give your venue its own address, showcase your halls, share your story and let customers find their perfect setting.",
      foot: "Your space, your identity",
    },
    {
      n: "02",
      title: "Hall pricing and capacity.",
      text: "Set capacity, amenities and pricing for each space. Choose hourly, half-day, full-day or your own packages.",
      foot: "Flexible by design",
    },
    {
      n: "03",
      title: "Availability without clashes.",
      text: "Review enquiries, confirm events and block maintenance. Conflicting confirmations are prevented at the source.",
      foot: "Room for confidence",
    },
  ],
  workspace: [
    "Independent websites for every venue",
    "Hall-wise availability and pricing",
    "Customer enquiries without registration",
    "Scoped access for your team",
    "Separate venue and subscription payments",
  ],
});

export function platformMetadata() {
  return {
    title: platformCopy.title,
    description: platformCopy.description,
    canonicalUrl: `${PLATFORM_ORIGIN}/`,
    image: `${PLATFORM_ORIGIN}/pwa-icons/icon-512.png`,
    imageAlt: "Prakash SaaS Venue Booking logo",
  };
}

export function platformStructuredData() {
  const metadata = platformMetadata();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${PLATFORM_ORIGIN}/#organization`,
        name: "Prakash SaaS",
        url: metadata.canonicalUrl,
        logo: metadata.image,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${PLATFORM_ORIGIN}/#software`,
        name: PLATFORM_NAME,
        url: metadata.canonicalUrl,
        description: metadata.description,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        publisher: { "@id": `${PLATFORM_ORIGIN}/#organization` },
        featureList: platformCopy.workspace,
      },
    ],
  };
}

const attribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3]) : "";
};

const inlineJson = (value) =>
  JSON.stringify(value).replace(
    /[<&\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );

const arrow = '<span aria-hidden="true">↗</span>';
const brand =
  '<a class="brand" href="/" aria-label="Prakash SaaS home"><span>Prakash SaaS<span class="brand-sub">VENUE BOOKING</span></span></a>';

function platformBody() {
  // The same factual copy is consumed by React. This is visible content before
  // JavaScript, not hidden crawler-only text. Bounded markers make replacement
  // by the tenant renderer safe even though the fallback contains nested divs.
  const features = platformCopy.features
    .map(
      (feature) =>
        `<article class="feature-card"><div><span>${feature.n}</span></div><h3>${escapeHtml(feature.title)}</h3><p>${escapeHtml(feature.text)}</p><span class="feature-foot">${escapeHtml(feature.foot)}${arrow}</span></article>`,
    )
    .join("");
  const workspace = platformCopy.workspace
    .map(
      (text, index) =>
        `<div><span>0${index + 1}</span><h3>${escapeHtml(text)}</h3><span aria-hidden="true">✓</span></div>`,
    )
    .join("");
  return `<!--platform-seo-content:start--><div class="landing" id="platform-seo-content"><header class="landing-header">${brand}<nav aria-label="Main navigation"><a href="#experience">The experience</a><a href="#workspace">Your workspace</a><a href="/login">Sign in ${arrow}</a></nav><a class="btn btn-primary" href="/register">Create your venue ${arrow}</a></header><main><section class="landing-hero" aria-labelledby="platform-heading"><div class="hero-copy"><div class="hero-kicker"><span></span>A BETTER HOME FOR YOUR VENUE</div><h1 id="platform-heading">${platformCopy.heroLines.map(escapeHtml).join("<br>")}</h1><p>${escapeHtml(platformCopy.introduction)}</p><div class="hero-actions"><a class="btn btn-primary btn-large" href="/register">Bring your venue online ${arrow}</a><a class="hero-secondary" href="#experience">Take a closer look ${arrow}</a></div><div class="hero-note"><span class="mini-icon" aria-hidden="true">✓</span>Built for independent venues. No coding needed.</div></div><div class="hero-art" aria-hidden="true"><span class="art-label">A SPACE FOR EVERY OCCASION</span><div class="art-sun"></div><div class="art-building"><div class="building-roof"></div><div class="building-line"></div><div class="building-arches"><div class="building-arch"><div></div></div><div class="building-arch"><div></div></div><div class="building-arch"><div></div></div></div><div class="building-steps"></div></div><div class="art-tree tree-left"></div><div class="art-tree tree-right"></div><div class="art-caption"><span>YOUR VENUE, BEAUTIFULLY PRESENTED</span><span>Est. for unforgettable events ${arrow}</span></div><div class="floating-note"><span class="floating-icon">▣</span><div><strong>Make space for possibility.</strong><span>Every hall. Every event. In harmony.</span></div></div><span class="art-orbit">PRAKASH · VENUE BOOKING</span></div></section><div class="venue-types"><span>BUILT AROUND YOUR SPACE</span><p>Banquet halls <span>✦</span> Wedding venues <span>✦</span> Resorts <span>✦</span> Conference spaces</p></div><section class="experience-section" id="experience" aria-labelledby="experience-heading"><div class="section-heading"><p class="eyebrow">FROM FIRST IMPRESSION TO FINAL CELEBRATION</p><h2 id="experience-heading">One beautiful place.<br><i>For everything behind the event.</i></h2></div><div class="feature-grid">${features}</div></section><section class="workspace-section" id="workspace" aria-labelledby="workspace-heading"><div><p class="eyebrow">THE QUIET SIDE OF GREAT EVENTS</p><h2 id="workspace-heading">More celebration.<br><i>Less administration.</i></h2><p>Bring your venues, customers, enquiries and recorded payments together. A clear view of your business, with the details close at hand.</p><a class="btn btn-primary" href="/register">Step into your workspace ${arrow}</a></div><div class="workspace-list">${workspace}</div></section><section class="landing-cta" aria-labelledby="start-heading"><p class="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p><h2 id="start-heading">Great moments<br>need <i>great spaces.</i></h2><a class="btn btn-cream btn-large" href="/register">Let's make room ${arrow}</a></section></main><footer class="landing-footer">${brand}<span>© ${new Date().getUTCFullYear()} Prakash SaaS. Made for meaningful gatherings.</span><a href="/login">Owner sign in ${arrow}</a></footer></div><!--platform-seo-content:end-->`;
}

export function renderPlatformHtml(index, { indexable = true } = {}) {
  const metadata = platformMetadata();
  let html = String(index)
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, (tag) => {
      const name = attribute(tag, "name").toLowerCase();
      const property = attribute(tag, "property").toLowerCase();
      return [
        "description",
        "application-name",
        "robots",
        "googlebot",
        "bingbot",
        "venue-appearance",
      ].includes(name) ||
        name.startsWith("twitter:") ||
        property.startsWith("twitter:") ||
        property.startsWith("og:")
        ? ""
        : tag;
    })
    .replace(/<link\b[^>]*>/gi, (tag) =>
      attribute(tag, "rel").toLowerCase().split(/\s+/).includes("canonical") ? "" : tag,
    )
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, (tag) =>
      attribute(tag.slice(0, tag.indexOf(">") + 1), "type").toLowerCase() === "application/ld+json"
        ? ""
        : tag,
    )
    .replace(/<!--platform-seo-content:start-->[\s\S]*?<!--platform-seo-content:end-->/g, "");
  const head = `<title>${escapeHtml(metadata.title)}</title><meta name="description" content="${escapeHtml(metadata.description)}"><meta name="application-name" content="${PLATFORM_NAME}"><meta name="robots" content="${indexable ? "index,follow,max-image-preview:large" : "noindex,follow"}"><meta property="og:type" content="website"><meta property="og:site_name" content="Prakash SaaS"><meta property="og:title" content="${escapeHtml(metadata.title)}"><meta property="og:description" content="${escapeHtml(metadata.description)}"><meta property="og:image" content="${metadata.image}"><meta property="og:image:alt" content="${metadata.imageAlt}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(metadata.title)}"><meta name="twitter:description" content="${escapeHtml(metadata.description)}"><meta name="twitter:image" content="${metadata.image}"><meta name="twitter:image:alt" content="${metadata.imageAlt}">${indexable ? `<link rel="canonical" href="${metadata.canonicalUrl}"><meta property="og:url" content="${metadata.canonicalUrl}"><script id="platform-structured-data" type="application/ld+json">${inlineJson(platformStructuredData())}</script>` : ""}`;
  html = html.replace(/<head\b[^>]*>/i, (tag) => `${tag}${head}`);
  return html.replace(
    /(<div\b[^>]*\bid=["']root["'][^>]*>)\s*<\/div>/i,
    (_tag, open) => `${open}${platformBody()}</div>`,
  );
}
