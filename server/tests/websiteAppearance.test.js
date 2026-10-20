import test from "node:test";
import assert from "node:assert/strict";
import { renderVenueHtml } from "../services/venueMetadataService.js";

const index =
  '<html lang="en"><head><meta name="description" content="Default"><script src="/theme-init.js"></script><title>Prakash SaaS</title></head><body><div id="root"></div></body></html>';
test("public HTML supplies saved appearance before the blocking bootstrap without duplicating metadata", () => {
  const html = renderVenueHtml(
    index,
    { name: "A & B", website: { appearance: "dark", tagline: "Custom story" } },
    [],
  );
  assert.match(html, /<html lang="en" data-website-appearance="dark">/);
  assert.ok(
    html.indexOf('name="venue-appearance" content="dark"') < html.indexOf('src="/theme-init.js"'),
  );
  assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert.match(html, /A &amp; B \| Prakash SaaS/);
  assert.match(html, /name="description" content="Custom story"/);
});

test("invalid or old website appearance safely follows the device", () => {
  for (const appearance of [undefined, '"><script>alert(1)</script>']) {
    const html = renderVenueHtml(index, { name: "Demo", website: { appearance } }, []);
    assert.match(html, /data-website-appearance="system"/);
    assert.doesNotMatch(html, /alert\(1\)/);
  }
});
