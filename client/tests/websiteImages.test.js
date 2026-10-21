import test from "node:test";
import assert from "node:assert/strict";
import {
  safeHttps,
  venueGallery,
  venueImageUrl,
  venueImageSrcSet,
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

test("responsive image candidates bound mobile downloads without changing signed or external URLs", () => {
  const original = "https://res.cloudinary.com/venue/image/upload/v123/cover.jpg";
  const candidates = venueImageSrcSet(original, 1440).split(", ");
  assert.deepEqual(
    candidates.map((candidate) => Number(candidate.match(/ (\d+)w$/)[1])),
    [320, 480, 640, 960, 1280, 1440],
  );
  assert.ok(candidates.every((candidate) => /f_auto,q_auto,w_\d+,c_limit/.test(candidate)));
  assert.equal(venueImageSrcSet(original, 2500).split(", ").at(-1).split(" ")[1], "1920w");
  assert.equal(venueImageSrcSet(original, 100).split(", ").length, 1);
  for (const value of [
    "javascript:alert(1)",
    "https://images.example.test/cover.jpg",
    "https://res.cloudinary.com/venue/image/upload/s--signature--/v123/cover.jpg",
    "https://res.cloudinary.com/venue/image/upload/c_fill,w_900/v123/cover.jpg",
  ])
    assert.equal(venueImageSrcSet(value, 1920), undefined);
});

test("shared gallery removes duplicate and unsafe venue/hall images without losing descriptions", () => {
  const image = { url: "https://images.example.test/one.jpg", alt: "Our venue" };
  assert.deepEqual(
    venueGallery({ images: [image] }, [{ images: [image, { url: "javascript:bad" }] }]),
    [image],
  );
});
