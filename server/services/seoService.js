import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { randomBytes } from "node:crypto";
import { getPublicVenue, slugFromHost } from "./publicVenueService.js";
import { renderVenueHtml } from "./venueMetadataService.js";
export { renderVenueHtml, venueStructuredData } from "./venueMetadataService.js";
export async function attachClient(app) {
  if (process.env.VENUE_SERVE_CLIENT !== "true") return;
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
  const actualDist = dist;
  const index = await readFile(path.join(actualDist, "index.html"), "utf8");
  app.use(
    express.static(actualDist, {
      index: false,
      setHeaders(res) {
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self' https://accounts.google.com https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' https: data:; connect-src 'self' https://accounts.google.com https://api.razorpay.com; frame-src https://accounts.google.com https://api.razorpay.com https://checkout.razorpay.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        );
      },
    }),
  );
  app.get("/{*path}", async (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    try {
      let html = index;
      const nonce = randomBytes(18).toString("base64");
      const pathSlug = /^\/v\/([a-z0-9-]+)\/?$/.exec(req.path)?.[1],
        slug = slugFromHost(req.hostname) || pathSlug;
      if (slug) {
        const { venue, halls } = await getPublicVenue(slug);
        html = renderVenueHtml(index, venue, halls, nonce);
      }
      res.set(
        "Content-Security-Policy",
        `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://accounts.google.com https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' https: data:; connect-src 'self' https://accounts.google.com https://api.razorpay.com; frame-src https://accounts.google.com https://api.razorpay.com https://checkout.razorpay.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`,
      );
      res.type("html").send(html);
    } catch (error) {
      if ([403, 404].includes(error.statusCode)) {
        const unavailable = index
          .replace(
            /<title>.*?<\/title>/s,
            '<title>Venue unavailable | Prakash SaaS</title><meta name="robots" content="noindex">',
          )
          .replace(
            '<div id="root"></div>',
            '<div id="root"><main><h1>This venue is currently unavailable.</h1><p>Please contact the venue directly or try again later.</p></main></div>',
          );
        res.set(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        );
        return res.status(error.statusCode).type("html").send(unavailable);
      }
      next(error);
    }
  });
}
