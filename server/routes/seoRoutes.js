import express from "express";
import { apiLimiters } from "../middleware/rateLimitMiddleware.js";
import { publicSitemapIndex, publicVenueSitemap } from "../services/sitemapService.js";

const router = express.Router();
router.use(apiLimiters.publicVenue);
const xml = (res, body) =>
  res
    .set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" })
    .type("application/xml")
    .send(body);
router.get("/sitemap-index.xml", async (_req, res) => xml(res, await publicSitemapIndex()));
router.get("/venues-:page.xml", async (req, res) =>
  xml(res, await publicVenueSitemap(req.params.page)),
);
router.all(["/sitemap-index.xml", "/venues-:page.xml"], (_req, res) =>
  res.status(405).set("Allow", "GET, HEAD").json({ success: false, message: "Method not allowed" }),
);
export default router;
