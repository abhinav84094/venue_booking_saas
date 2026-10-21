import { validateSlug } from "../../../shared/slug.js";
import {
  classifyTenantHost,
  DEFAULT_TENANT_BASE_DOMAIN,
  normalizeHostname,
} from "../../../shared/tenantHost.js";

const configuredDomain = () =>
  import.meta.env.VITE_PUBLIC_VENUE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN;

export function getVenueHost(hostname = window.location.hostname, baseDomain = configuredDomain()) {
  return classifyTenantHost(hostname, baseDomain);
}

export function getVenueSlugFromHostname(
  hostname = window.location.hostname,
  baseDomain = configuredDomain(),
) {
  return getVenueHost(hostname, baseDomain).slug;
}
export function getVenuePublicUrl(slug) {
  if (!validateSlug(slug).valid) return null;
  const base = normalizeHostname(configuredDomain());
  const localPreview = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  return base && !localPreview ? `https://${slug}.${base}` : `${window.location.origin}/v/${slug}`;
}
