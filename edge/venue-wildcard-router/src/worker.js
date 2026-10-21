import { validateSlug } from "../../../shared/slug.js";
import { renderVenueHtml, escapeHtml } from "../../../shared/venueMetadata.js";

export const BASE_DOMAIN = "prakashsaas.world";
export const FRONTEND = "https://venue-booking-saas.netlify.app";
export const BACKEND = "https://venue-booking-saas.onrender.com";
const MAX_JSON_BYTES = 256 * 1024;
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const READ_METHODS = ["GET", "HEAD"];
const STATIC_PATH =
  /^\/assets\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:js|css|woff2?|png|jpe?g|webp|avif|svg)$/;
const STATIC_FILES = new Set(["/favicon.svg", "/theme-init.js"]);

function failure(message, status = 502) {
  return Object.assign(new Error(message), { status });
}
function responseHeaders(contentType) {
  return new Headers({
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
}
function errorResponse(message, status, method = "GET", extra = {}) {
  const headers = responseHeaders("text/html; charset=utf-8");
  headers.set("X-Robots-Tag", "noindex");
  headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(message)} | Prakash SaaS</title></head><body><main><h1>${escapeHtml(message)}</h1></main></body></html>`;
  return new Response(method === "HEAD" ? null : body, { status, headers });
}
function tenantSlug(url) {
  const suffix = `.${BASE_DOMAIN}`;
  if (url.port || !url.hostname.endsWith(suffix)) return null;
  const slug = url.hostname.slice(0, -suffix.length);
  return validateSlug(slug).valid ? slug : null;
}
function apiRoute(pathname, slug) {
  const prefix = `/api/public/venues/${slug}`;
  if (pathname === prefix || pathname === `${prefix}/`) return READ_METHODS;
  if (pathname === `${prefix}/enquiries` || pathname === `${prefix}/enquiries/status`)
    return ["POST"];
  const hall =
    /^\/api\/public\/venues\/([a-z0-9-]+)\/halls\/([a-fA-F0-9]{24})\/(availability|quote)\/?$/.exec(
      pathname,
    );
  if (!hall || hall[1] !== slug) return null;
  return hall[3] === "availability" ? READ_METHODS : ["POST"];
}
async function readBytes(body, limit) {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw failure("Request or upstream document is too large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
function forwardedHeaders(request, { json = false, document = false } = {}) {
  const headers = new Headers();
  for (const name of [
    "accept",
    "accept-language",
    ...(document ? [] : ["if-none-match", "if-modified-since", "range"]),
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (document) headers.set("accept", "text/html");
  if (json) {
    headers.set("content-type", request.headers.get("content-type"));
    // Public endpoints are intentionally anonymous; preserve only a validated
    // same-origin Origin, never cookies, authorization or caller IP headers.
    headers.set("origin", new URL(request.url).origin);
  }
  return headers;
}
function proxyResponse(upstream, incoming, target, method) {
  const headers = new Headers(upstream.headers);
  headers.delete("set-cookie");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  if (headers.has("location")) {
    const location = new URL(headers.get("location"), target);
    if (location.origin !== new URL(target).origin) throw failure("Unexpected upstream redirect");
    location.protocol = "https:";
    location.host = incoming.host;
    headers.set("location", location.toString());
  }
  return new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

// The injection seam is only for local tests; production destinations are fixed
// and never selected by user input, query parameters or request headers.
export function createWorker({ fetch: fetchUpstream = globalThis.fetch, timeoutMs = 10000 } = {}) {
  async function upstream(url, init, consume = (response) => response) {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        Promise.resolve()
          .then(() =>
            fetchUpstream(url, {
              ...init,
              redirect: "manual",
              cache: "no-store",
              signal: controller.signal,
            }),
          )
          .then(consume),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(failure("Upstream request timed out", 504));
          }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async function publicVenue(slug) {
    return upstream(
      `${BACKEND}/api/public/venues/${slug}`,
      {
        method: "GET",
        headers: { accept: "application/json" },
      },
      async (response) => {
        if ([403, 404].includes(response.status)) throw failure("Venue unavailable", 404);
        if (response.status >= 500)
          throw failure("Venue service temporarily unavailable", response.status);
        if (
          response.status !== 200 ||
          !response.headers.get("content-type")?.includes("application/json")
        )
          throw failure("Invalid venue service response");
        let data;
        try {
          const bytes = await readBytes(response.body, MAX_DOCUMENT_BYTES);
          data = JSON.parse(new TextDecoder().decode(bytes));
        } catch {
          throw failure("Invalid venue service response");
        }
        if (
          data.success !== true ||
          !data.venue ||
          data.venue.slug !== slug ||
          typeof data.venue.name !== "string" ||
          !Array.isArray(data.halls)
        )
          throw failure("Invalid venue service response");
        // The existing API excludes visibility fields from its public projection;
        // its 200 is authoritative. Reject explicit flags too if schema expands.
        if (data.venue.published === false || data.venue.suspended === true)
          throw failure("Venue unavailable", 404);
        return data;
      },
    );
  }
  return {
    async fetch(request) {
      const url = new URL(request.url);
      const method = request.method.toUpperCase();
      try {
        const slug = tenantSlug(url);
        if (!slug) return errorResponse("Venue not found", 404, method);
        // Never hand encoded paths to Netlify: its decoding plus /api rewrite
        // would otherwise bypass this Worker's public route restrictions.
        if (/%|\\|[^\x21-\x7e]/.test(url.pathname)) return errorResponse("Not found", 404, method);
        const methods = apiRoute(url.pathname, slug);
        const isApi = /^\/api(?:\/|$)/i.test(url.pathname);
        if (isApi) {
          if (!methods) return errorResponse("Not found", 404, method);
          if (!methods.includes(method))
            return errorResponse("Method not allowed", 405, method, { Allow: methods.join(", ") });
          let body;
          if (method === "POST") {
            if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || ""))
              return errorResponse("JSON content type required", 415, method);
            body = await readBytes(request.body, MAX_JSON_BYTES);
          }
          const target = `${BACKEND}${url.pathname}${url.search}`;
          const response = await upstream(target, {
            method,
            headers: forwardedHeaders(request, { json: method === "POST" }),
            ...(body ? { body } : {}),
          });
          return proxyResponse(response, url, target, method);
        }
        const document = url.pathname === "/";
        const robots = url.pathname === "/robots.txt";
        const sitemap = url.pathname === "/sitemap.xml";
        const asset = STATIC_PATH.test(url.pathname) || STATIC_FILES.has(url.pathname);
        if (!document && !robots && !sitemap && !asset)
          return errorResponse("Not found", 404, method);
        if (!READ_METHODS.includes(method))
          return errorResponse("Method not allowed", 405, method, {
            Allow: READ_METHODS.join(", "),
          });
        if (asset) {
          const response = await upstream(`${FRONTEND}${url.pathname}${url.search}`, {
            method,
            headers: forwardedHeaders(request),
          });
          if (response.ok && response.headers.get("content-type")?.includes("text/html"))
            throw failure("Invalid static asset response");
          return proxyResponse(response, url, `${FRONTEND}${url.pathname}${url.search}`, method);
        }
        const { venue, halls } = await publicVenue(slug);
        const canonical = `https://${slug}.${BASE_DOMAIN}/`;
        if (robots || sitemap) {
          const body = robots
            ? `User-agent: *\nAllow: /$\nDisallow: /api/\nSitemap: ${canonical}sitemap.xml\n`
            : `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeHtml(canonical)}</loc></url></urlset>`;
          return new Response(method === "HEAD" ? null : body, {
            status: 200,
            headers: responseHeaders(
              robots ? "text/plain; charset=utf-8" : "application/xml; charset=utf-8",
            ),
          });
        }
        const index = await upstream(
          `${FRONTEND}/`,
          { method: "GET", headers: forwardedHeaders(request, { document: true }) },
          async (response) => {
            if (response.status >= 500)
              throw failure("Website service temporarily unavailable", response.status);
            if (
              response.status !== 200 ||
              !response.headers.get("content-type")?.includes("text/html")
            )
              throw failure("Invalid website service response");
            let index;
            try {
              const bytes = await readBytes(response.body, MAX_DOCUMENT_BYTES);
              index = new TextDecoder().decode(bytes);
            } catch {
              throw failure("Invalid website service response");
            }
            if (!/<head\b/i.test(index) || !/<div\b[^>]*\bid=["']root["']/i.test(index))
              throw failure("Invalid website service response");
            // Public pages must never advertise the separate owner PWA, even if
            // a future frontend deployment includes these tags in its base shell.
            return index
              .replace(/<link\b(?=[^>]*\brel=["'](?:manifest|apple-touch-icon)["'])[^>]*>/gi, "")
              .replace(/<meta\b(?=[^>]*\bname=["']apple-mobile-web-app-[^"']*["'])[^>]*>/gi, "");
          },
        );
        const nonce = crypto.randomUUID().replaceAll("-", "");
        const html = renderVenueHtml(index, venue, halls, nonce, canonical);
        const headers = responseHeaders("text/html; charset=utf-8");
        headers.set(
          "Content-Security-Policy",
          `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self'; frame-src https://www.google.com https://maps.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
        );
        return new Response(method === "HEAD" ? null : html, { status: 200, headers });
      } catch (error) {
        const status = error.status || (error.name === "AbortError" ? 504 : 502);
        return errorResponse(
          status === 404
            ? "Venue unavailable"
            : status === 413
              ? "Request is too large"
              : status === 504
                ? "Service request timed out"
                : "Service temporarily unavailable",
          status,
          method,
        );
      }
    },
  };
}

export default createWorker();
