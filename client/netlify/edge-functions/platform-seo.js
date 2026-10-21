import { PLATFORM_ORIGIN, renderPlatformHtml } from "../../../shared/platformSeo.js";
import { escapeHtml } from "../../../shared/venueMetadata.js";
import { validateSlug } from "../../../shared/slug.js";
import { classifyTenantHost } from "../../../shared/tenantHost.js";

const BACKEND = "https://venue-booking-saas.onrender.com";
const XML_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";
const STATIC =
  /^(?:\/assets\/|\/pwa-icons\/|\/(?:favicon\.svg|theme-init\.js|sw\.js|manifest\.webmanifest|offline\.(?:html|css|js))$)/;
const OWNER_ROUTE =
  /^\/(?:login|register|forgot-password|google\/set-password|account|admin|venues(?:\/[^\s]*)?)\/?$/;
const fail = (status) => Object.assign(new Error("SEO upstream unavailable"), { status });

function cancelBody(response) {
  // Cancellation must never keep an error response waiting on an upstream.
  response.body?.cancel().catch(() => {});
}

async function boundedText(response, limit, signal) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const cancel = () => {
    reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", cancel, { once: true });
  const chunks = [];
  let length = 0;
  try {
    if (signal?.aborted) {
      cancel();
      throw fail(504);
    }
    for (;;) {
      const { done, value } = await reader.read();
      if (signal?.aborted) throw fail(504);
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        cancel();
        throw fail(502);
      }
      chunks.push(value);
    }
  } finally {
    signal?.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function headers(type, indexable = false) {
  return new Headers({
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": indexable ? "index,follow" : "noindex,follow",
  });
}
function errorResponse(status, method) {
  const label =
    status === 404
      ? "Page not found"
      : status === 405
        ? "Method not allowed"
        : "Service temporarily unavailable";
  const responseHeaders = headers("text/html; charset=utf-8");
  if (status === 405) responseHeaders.set("Allow", "GET, HEAD");
  return new Response(
    method === "HEAD"
      ? null
      : `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${label} | Prakash SaaS</title></head><body><main><h1>${label}</h1></main></body></html>`,
    { status, headers: responseHeaders },
  );
}
function privateHtml(html) {
  // Remove the platform marketing fallback without parsing arbitrary nested
  // divs, then clear all canonical/social/schema tags on workspace documents.
  return renderPlatformHtml(html, { indexable: false })
    .replace(/<!--platform-seo-content:start-->[\s\S]*?<!--platform-seo-content:end-->/g, "")
    .replace(
      /<title\b[^>]*>[\s\S]*?<\/title\s*>/gi,
      "<title>Owner workspace | Prakash SaaS</title>",
    )
    .replace(/<meta\b[^>]*(?:property=["']og:|name=["'](?:description|twitter:))[^>]*>/gi, "");
}

// Pure Web APIs also run under Node tests. The production targets are fixed;
// inbound cookies, auth headers and user-supplied destinations are never used.
export function createPlatformSeo({
  fetch: fetchUpstream = globalThis.fetch,
  timeoutMs = 10000,
} = {}) {
  async function deadline(run) {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => run(controller.signal)),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(fail(504));
          }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async function backend(path, consume) {
    return deadline(async (signal) => {
      const response = await fetchUpstream(`${BACKEND}${path}`, {
        method: "GET",
        headers: { accept: path.endsWith(".xml") ? "application/xml" : "application/json" },
        redirect: "manual",
        cache: "no-store",
        signal,
      });
      if (signal.aborted) {
        cancelBody(response);
        throw fail(504);
      }
      return consume(response, signal);
    });
  }
  async function venuePublished(slug) {
    return backend(`/api/public/venues/${slug}`, async (response, signal) => {
      if ([403, 404].includes(response.status)) throw fail(404);
      if (response.status >= 500) throw fail(response.status);
      if (
        response.status !== 200 ||
        !response.headers.get("content-type")?.includes("application/json")
      )
        throw fail(502);
      const text = await boundedText(response, 2 * 1024 * 1024, signal);
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw fail(502);
      }
      if (data.success !== true || data.venue?.slug !== slug || !Array.isArray(data.halls))
        throw fail(502);
      if (data.venue.published === false || data.venue.suspended === true) throw fail(404);
    });
  }
  return async (request, context) => {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    // Defense in depth if a deployment omits the TOML exclusions. All real
    // owner API/asset semantics, bodies and cookies remain with Netlify.
    if (/^\/api(?:\/|$)/i.test(url.pathname) || STATIC.test(url.pathname)) return context.next();
    try {
      if (!["GET", "HEAD"].includes(method)) return errorResponse(405, method);
      if (classifyTenantHost(url.hostname).type !== "platform") return errorResponse(404, method);
      if (/%|\\|[^\x21-\x7e]/.test(url.pathname)) return errorResponse(404, method);
      const primary = url.origin === PLATFORM_ORIGIN;
      if (
        url.hostname === new URL(PLATFORM_ORIGIN).hostname &&
        url.protocol === "http:" &&
        !url.port
      ) {
        url.protocol = "https:";
        return new Response(null, {
          status: 308,
          headers: { location: url.toString(), "Cache-Control": "no-store" },
        });
      }
      if (url.pathname === "/robots.txt") {
        const body = `User-agent: *\nAllow: /\nDisallow: /api/\n${primary ? `Sitemap: ${PLATFORM_ORIGIN}/sitemap.xml\n` : ""}`;
        return new Response(method === "HEAD" ? null : body, {
          status: 200,
          headers: headers("text/plain; charset=utf-8"),
        });
      }
      const shard = /^\/sitemaps\/venues-([1-9][0-9]{0,4})\.xml$/.exec(url.pathname);
      if (url.pathname === "/sitemap.xml" || url.pathname === "/sitemaps/platform.xml" || shard) {
        if (!primary) return errorResponse(404, method);
        if (url.pathname === "/sitemaps/platform.xml") {
          return new Response(
            method === "HEAD"
              ? null
              : `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="${XML_NAMESPACE}"><url><loc>${escapeHtml(`${PLATFORM_ORIGIN}/`)}</loc></url></urlset>`,
            { status: 200, headers: headers("application/xml; charset=utf-8") },
          );
        }
        return await backend(
          url.pathname === "/sitemap.xml"
            ? "/api/public/seo/sitemap-index.xml"
            : `/api/public/seo/venues-${shard[1]}.xml`,
          async (response, signal) => {
            if (response.status !== 200) {
              if (response.status === 404 || response.status >= 500) throw fail(response.status);
              throw fail(502);
            }
            if (!/^(?:application|text)\/xml\b/i.test(response.headers.get("content-type") || ""))
              throw fail(502);
            const body = await boundedText(response, 10 * 1024 * 1024, signal);
            if (!/^\s*<\?xml\b/.test(body)) throw fail(502);
            return new Response(method === "HEAD" ? null : body, {
              status: response.status,
              headers: headers(response.headers.get("content-type")),
            });
          },
        );
      }
      const preview = /^\/v\/([^/]+)\/?$/.exec(url.pathname);
      if (preview) {
        if (!validateSlug(preview[1]).valid) return errorResponse(404, method);
        if (primary) {
          await venuePublished(preview[1]);
          return new Response(null, {
            status: 301,
            headers: {
              location: `https://${preview[1]}.prakashsaas.world/`,
              "Cache-Control": "no-store",
              "X-Robots-Tag": "noindex",
            },
          });
        }
      } else if (url.pathname !== "/" && !OWNER_ROUTE.test(url.pathname))
        return errorResponse(404, method);
      return await deadline(async (signal) => {
        const response = await context.next();
        // The continuation itself may resolve after its deadline. Release a late
        // stream instead of consuming it after a 504 has already been returned.
        if (signal.aborted) {
          cancelBody(response);
          throw fail(504);
        }
        if (
          response.status !== 200 ||
          !response.headers.get("content-type")?.includes("text/html")
        ) {
          const responseHeaders = new Headers(response.headers);
          responseHeaders.set("X-Robots-Tag", "noindex");
          if (method === "HEAD") cancelBody(response);
          return new Response(method === "HEAD" ? null : response.body, {
            status: response.status,
            headers: responseHeaders,
          });
        }
        const home = url.pathname === "/";
        const responseHeaders = new Headers(response.headers);
        for (const name of ["Content-Length", "Content-Encoding", "ETag", "Last-Modified"])
          responseHeaders.delete(name);
        for (const [name, value] of headers("text/html; charset=utf-8", home && primary))
          responseHeaders.set(name, value);
        if (method === "HEAD") {
          cancelBody(response);
          return new Response(null, { status: response.status, headers: responseHeaders });
        }
        const shell = await boundedText(response, 2 * 1024 * 1024, signal);
        if (!/<head\b/i.test(shell) || !/<div\b[^>]*\bid=["']root["']/i.test(shell))
          throw fail(502);
        const html = home ? renderPlatformHtml(shell, { indexable: primary }) : privateHtml(shell);
        return new Response(html, { status: response.status, headers: responseHeaders });
      });
    } catch (error) {
      return errorResponse(error.status || (error.name === "AbortError" ? 504 : 502), method);
    }
  };
}

export default createPlatformSeo();
