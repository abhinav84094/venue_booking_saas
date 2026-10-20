import test from "node:test";
import assert from "node:assert/strict";
import {
  safeHttps,
  venueGallery,
  venueImageUrl,
} from "../src/components/venue/shared/websiteData.js";

test("public image delivery optimizes unsigned Cloudinary images and preserves signed or external URLs", () => {
  const source = "https://res.cloudinary.com/venue/image/upload/v123/halls/cover.jpg";
  assert.equal(
    venueImageUrl(source, 1440),
    "https://res.cloudinary.com/venue/image/upload/f_auto,q_auto,w_1440,c_limit/v123/halls/cover.jpg",
  );
  for (const url of [
    "https://images.example.test/hall.png",
    "https://res.cloudinary.com/venue/image/upload/s--signature--/v123/hall.jpg",
    "https://res.cloudinary.com/venue/image/upload/c_fill,w_900/v123/hall.jpg",
    "https://res.cloudinary.com/venue/image/upload/q_auto/v123/hall.jpg",
  ])
    assert.equal(venueImageUrl(url, 1440), url);
  assert.equal(venueImageUrl("javascript:alert(1)", 1000), null);
  assert.equal(safeHttps("http://insecure.example.test/photo.jpg"), null);
});

test("shared gallery removes duplicate and unsafe venue/hall images without losing descriptions", () => {
  const image = { url: "https://images.example.test/one.jpg", alt: "Our venue" };
  assert.deepEqual(
    venueGallery({ images: [image] }, [{ images: [image, { url: "javascript:bad" }] }]),
    [image],
  );
});
