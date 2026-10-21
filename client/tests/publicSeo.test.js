import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("platform crawler files are real text/XML with canonical public URLs and private paths excluded", async () => {
  const [robots, sitemap, headers] = await Promise.all([
    readFile(new URL("../public/robots.txt", import.meta.url), "utf8"),
    readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8"),
    readFile(new URL("../public/_headers", import.meta.url), "utf8"),
  ]);
  assert.match(robots, /^User-agent: \*/);
  assert.match(robots, /Disallow: \/api\//);
  // Private HTML is noindex; allow crawlers to read that directive. Access
  // controls remain enforced by the API, never by robots.txt.
  assert.doesNotMatch(robots, /Disallow: \/(?:login|venues|v\/)/);
  assert.match(robots, /Sitemap: https:\/\/prakashsaas\.world\/sitemap\.xml/);
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.deepEqual(
    [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]),
    ["https://prakashsaas.world/"],
  );
  assert.doesNotMatch(robots + sitemap, /<html|id="root"|\/api\/admin|onrender\.com|netlify\.app/);
  assert.match(headers, /\/robots\.txt\s+Content-Type: text\/plain/);
  assert.match(headers, /\/sitemap\.xml\s+Content-Type: application\/xml/);
});
