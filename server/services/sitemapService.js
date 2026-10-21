import { Venue } from "../models/venueModels.js";
import { normalizeHostname, DEFAULT_TENANT_BASE_DOMAIN } from "../../shared/tenantHost.js";
import { RESERVED_VENUE_SLUGS } from "../../shared/slug.js";
import { PLATFORM_ORIGIN } from "../../shared/platformSeo.js";
import { must } from "../utils/errors.js";

export const SITEMAP_PAGE_SIZE = 1000;
// A sitemap index may contain at most 50,000 entries. One entry is reserved for
// the platform sitemap; refuse overflow rather than silently omitting venues.
export const MAX_VENUE_SITEMAP_PAGES = 49_999;
const QUERY_TIMEOUT_MS = 5000;
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const XML_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";
const escapeXml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character],
  );

// Match the public resolver's publication policy. Paid, formerly published
// venues remain informative after subscription expiry; no billing data enters
// these discovery queries. Filter invalid legacy slugs before counting/paging.
const discoverable = () => ({
  published: true,
  suspended: false,
  slug: {
    $regex: /^(?=.{3,63}$)[a-z0-9]+(?:-[a-z0-9]+)*$/,
    $nin: RESERVED_VENUE_SLUGS,
  },
});

function tenantBaseDomain() {
  const base = normalizeHostname(process.env.PUBLIC_VENUE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN);
  must(base && base.includes(".") && !base.includes(":"), "Public venue domain unavailable", 503);
  return base;
}

async function pageCount() {
  const count = await Venue.countDocuments(discoverable()).maxTimeMS(QUERY_TIMEOUT_MS);
  const pages = Math.ceil(count / SITEMAP_PAGE_SIZE);
  must(pages <= MAX_VENUE_SITEMAP_PAGES, "Sitemap capacity exceeded", 503);
  return pages;
}

export async function publicSitemapIndex() {
  // Validate configuration even if there are currently no published venues.
  tenantBaseDomain();
  const pages = await pageCount();
  const locations = [
    `${PLATFORM_ORIGIN}/sitemaps/platform.xml`,
    ...Array.from(
      { length: pages },
      (_, index) => `${PLATFORM_ORIGIN}/sitemaps/venues-${index + 1}.xml`,
    ),
  ];
  return `${XML_HEADER}<sitemapindex xmlns="${XML_NAMESPACE}">${locations.map((location) => `<sitemap><loc>${escapeXml(location)}</loc></sitemap>`).join("")}</sitemapindex>`;
}

export async function publicVenueSitemap(page) {
  const value = String(page);
  must(/^[1-9][0-9]{0,4}$/.test(value), "Sitemap not found", 404);
  const pageNumber = Number(value);
  must(pageNumber <= MAX_VENUE_SITEMAP_PAGES, "Sitemap not found", 404);
  const base = tenantBaseDomain();
  const pages = await pageCount();
  must(pageNumber <= pages, "Sitemap not found", 404);
  const venues = await Venue.find(discoverable())
    .select({ slug: 1, _id: 0 })
    .sort({ slug: 1 })
    .skip((pageNumber - 1) * SITEMAP_PAGE_SIZE)
    .limit(SITEMAP_PAGE_SIZE)
    .maxTimeMS(QUERY_TIMEOUT_MS)
    .lean();
  // Publishing may change between count and read. Do not expose an empty shard
  // as a successful document after its last venue has been unpublished.
  must(venues.length, "Sitemap not found", 404);
  return `${XML_HEADER}<urlset xmlns="${XML_NAMESPACE}">${venues.map(({ slug }) => `<url><loc>${escapeXml(`https://${slug}.${base}/`)}</loc></url>`).join("")}</urlset>`;
}
