import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { randomBytes } from "node:crypto";
import {
  classifyTenantHost,
  DEFAULT_TENANT_BASE_DOMAIN,
  normalizeHostname,
} from "../../shared/tenantHost.js";
import { PLATFORM_ORIGIN, renderPlatformHtml } from "../../shared/platformSeo.js";
import { validateSlug } from "../../shared/slug.js";
import { getPublicVenue } from "./publicVenueService.js";
import { renderVenueHtml } from "./venueMetadataService.js";
export { renderVenueHtml, venueStructuredData } from "./venueMetadataService.js";
const DEFAULT_DIST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../client/dist",
);
const PLATFORM_HOST = new URL(PLATFORM_ORIGIN).hostname;
const RENDER_HOST = "venue-booking-saas.onrender.com";
const OWNER_ROUTE =
  /^\/(?:login|register|forgot-password|google\/set-password|account|admin|venues(?:\/[^\s]*)?)\/?$/;
const platformFallback =
  /<!--platform-seo-content:start-->[\s\S]*?<!--platform-seo-content:end-->/g;
const csp = (nonce = "") =>
  `default-src 'self'; script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""} https://accounts.google.com https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self' https://accounts.google.com https://api.razorpay.com; frame-src https://accounts.google.com https://api.razorpay.com https://checkout.razorpay.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;

function privateShell(index) {
  return renderPlatformHtml(index, { indexable: false })
    .replace(platformFallback, "")
    .replace(
      /<title\b[^>]*>[\s\S]*?<\/title\s*>/gi,
      "<title>Owner workspace | Prakash SaaS</title>",
    )
    .replace(/<meta\b[^>]*(?:property=["']og:|name=["'](?:description|twitter:))[^>]*>/gi, "");
}

function unavailableHtml(index, status) {
  const title = status === 404 ? "Venue unavailable" : "Service temporarily unavailable";
  const body = `<main><h1>${title}</h1><p>Please contact the venue directly or try again later.</p></main>`;
  return privateShell(index)
    .replace(
      "<title>Owner workspace | Prakash SaaS</title>",
      `<title>${title} | Prakash SaaS</title>`,
    )
    .replace(
      /(<div\b[^>]*\bid=["']root["'][^>]*>)\s*<\/div>/i,
      (_tag, open) => `${open}${body}</div>`,
    );
}

// Netlify and the wildcard Worker are the production HTML ingress. This optional
// renderer also supports local browser tests and a deliberate Express frontend
// deployment. Test dependencies are explicit internal options, never HTTP input.
export async function attachClient(
  app,
  { dist = DEFAULT_DIST, resolveVenue = getPublicVenue } = {},
) {
  if (process.env.VENUE_SERVE_CLIENT !== "true") return;
  const index = await readFile(path.join(dist, "index.html"), "utf8");
  app.use(
    express.static(dist, {
      index: false,
      setHeaders(res) {
        res.setHeader("Content-Security-Policy", csp());
      },
    }),
  );
  app.get("/{*path}", async (req, res, next) => {
    if (/^\/api(?:\/|$)/i.test(req.path)) return next();
    const nonce = randomBytes(18).toString("base64");
    const send = (html, status = 200, indexable = false) =>
      res
        .status(status)
        .set({
          "Cache-Control": "no-store",
          "X-Robots-Tag": indexable ? "index,follow" : "noindex,follow",
          "Content-Security-Policy": csp(nonce),
        })
        .type("html")
        .send(html);
    try {
      const hostname = normalizeHostname(req.hostname);
      const base = normalizeHostname(process.env.PUBLIC_VENUE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN);
      const host = classifyTenantHost(hostname, base);
      const platform = host.type === "platform" || hostname === RENDER_HOST;
      const tenant = host.type === "tenant" ? host.slug : null;
      const standardPort =
        !/:\d+$/.test(req.get("host") || "") || /:443$/.test(req.get("host") || "");
      const primary = hostname === PLATFORM_HOST && req.protocol === "https" && standardPort;
      if ((!platform && !tenant) || /%|\\|[^\x21-\x7e]/.test(req.path))
        return send(unavailableHtml(index, 404), 404);
      const preview = /^\/v\/([^/]+)\/?$/.exec(req.path);
      // A tenant root cannot render another venue's preview or owner workspace.
      if (tenant && req.path !== "/") return send(unavailableHtml(index, 404), 404);
      if (preview && !validateSlug(preview[1]).valid) return send(unavailableHtml(index, 404), 404);
      const slug = tenant || preview?.[1];
      if (slug) {
        const { venue, halls } = await resolveVenue(slug);
        if (venue?.slug !== slug || venue.published === false || venue.suspended === true)
          return send(unavailableHtml(index, 404), 404);
        const canonical = `https://${slug}.${DEFAULT_TENANT_BASE_DOMAIN}/`;
        if (preview && primary)
          return res
            .status(301)
            .set({ Location: canonical, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" })
            .end();
        const indexable = Boolean(
          tenant &&
          hostname === `${slug}.${DEFAULT_TENANT_BASE_DOMAIN}` &&
          req.protocol === "https" &&
          standardPort,
        );
        return send(
          renderVenueHtml(index, venue, halls, nonce, indexable ? canonical : ""),
          200,
          indexable,
        );
      }
      if (req.path === "/") {
        const html = renderPlatformHtml(index, { indexable: primary }).replace(
          /(<script\b[^>]*\bid=["']platform-structured-data["'])/i,
          `$1 nonce="${nonce}"`,
        );
        return send(html, 200, primary);
      }
      if (OWNER_ROUTE.test(req.path)) return send(privateShell(index));
      return send(unavailableHtml(index, 404), 404);
    } catch (error) {
      const status = [403, 404].includes(error.statusCode)
        ? 404
        : error.statusCode >= 500 && error.statusCode <= 599
          ? error.statusCode
          : 500;
      return send(unavailableHtml(index, status), status);
    }
  });
}
