import { validateSlug } from "./slug.js";

export const DEFAULT_TENANT_BASE_DOMAIN = "prakashsaas.world";
export const PLATFORM_HOSTNAMES = Object.freeze([
  "venue-booking-saas.netlify.app",
  "venue.prakashsaas.com",
]);
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Only previews belonging to this Netlify site can render the platform UI.
// This is not authentication authority: API CORS and membership checks remain
// independent, and previews must never become canonical or install the PWA.
export function isPlatformPreviewHost(hostname) {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?--venue-booking-saas\.netlify\.app$/.test(
    normalizeHostname(hostname),
  );
}

// Hostnames are identities, not arbitrary URLs. Reject ports, paths, credentials
// and nested tenant names rather than falling back to the owner application.
export function normalizeHostname(value) {
  if (typeof value !== "string") return "";
  const host = value.trim().toLowerCase().replace(/\.$/, "");
  return LOCAL_HOSTNAMES.has(host) ||
    (host.length <= 253 &&
      host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))
    ? host
    : "";
}

export function classifyTenantHost(
  hostname,
  baseDomain = DEFAULT_TENANT_BASE_DOMAIN,
  { platformHosts = PLATFORM_HOSTNAMES } = {},
) {
  const host = normalizeHostname(hostname);
  const base = normalizeHostname(baseDomain);
  if (!host || !base) return { type: "invalid", slug: null };
  if (host === base || LOCAL_HOSTNAMES.has(host) || platformHosts.includes(host) || isPlatformPreviewHost(host))
    return { type: "platform", slug: null };
  if (!host.endsWith(`.${base}`)) return { type: "invalid", slug: null };
  const slug = host.slice(0, -base.length - 1);
  return validateSlug(slug).valid ? { type: "tenant", slug } : { type: "invalid", slug: null };
}
