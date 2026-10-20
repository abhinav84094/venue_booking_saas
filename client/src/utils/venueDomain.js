import { validateSlug } from "../../../shared/slug.js";
const domain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
export function getVenueSlugFromHostname(
  hostname = window.location.hostname,
  baseDomain = import.meta.env.VITE_PUBLIC_VENUE_DOMAIN,
) {
  const base = domain(baseDomain),
    host = domain(hostname);
  if (!base || !host.endsWith(`.${base}`)) return null;
  const slug = host.slice(0, -base.length - 1);
  return validateSlug(slug).valid ? slug : null;
}
export function getVenuePublicUrl(slug) {
  if (!validateSlug(slug).valid) return null;
  const base = domain(import.meta.env.VITE_PUBLIC_VENUE_DOMAIN);
  const localPreview = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  return base && !localPreview
    ? `https://${slug}.${base}`
    : `${window.location.origin}/v/${slug}`;
}
