// Owner-app identity is an exact origin allowlist. Customer subdomains and
// public /v routes must never advertise or register the owner PWA.
export const OWNER_HOSTNAMES = Object.freeze([
  "prakashsaas.world",
  "venue.prakashsaas.com",
  "venue-booking-saas.netlify.app",
]);
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isOwnerOrigin({ hostname, protocol, port } = {}) {
  const host = String(hostname || "").toLowerCase();
  return (
    (protocol === "https:" && (!port || port === "443") && OWNER_HOSTNAMES.includes(host)) ||
    (["http:", "https:"].includes(protocol) && localHosts.has(host))
  );
}

export function isOwnerPagePath(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
  try {
    const path = decodeURIComponent(pathname);
    return !path.startsWith("//") && !/^\/(?:v|api)(?:\/|$)/i.test(path);
  } catch {
    return false;
  }
}

export function isOwnerAppLocation(location = {}) {
  return isOwnerOrigin(location) && isOwnerPagePath(location.pathname);
}

const publicStaticFiles = new Set([
  "/favicon.svg",
  "/theme-init.js",
  "/offline.html",
  "/offline.css",
  "/offline.js",
  "/pwa-icons/icon-192.png",
  "/pwa-icons/icon-512.png",
  "/pwa-icons/maskable-512.png",
  "/pwa-icons/apple-touch-icon.png",
]);

export function isSafePrecachePath(pathname) {
  return (
    publicStaticFiles.has(pathname) ||
    /^\/assets\/[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.(?:js|css|woff2?|png|svg|webp|ico)$/.test(
      pathname,
    )
  );
}
