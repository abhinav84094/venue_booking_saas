import test from "node:test";
import assert from "node:assert/strict";
import { venueColors } from "../src/utils/venueColors.js";

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
test("custom brand buttons retain readable text, including middle-tone gray colors", () => {
  const colors = [
    "#254b3b",
    "#777777",
    "#888888",
    "#ffffff",
    "#000000",
    "#ff8800",
    "#ff0088",
    "#00ff00",
    "#0077ff",
  ];
  for (let channel = 0; channel <= 255; channel++) {
    const hex = channel.toString(16).padStart(2, "0");
    colors.push(`#${hex}${hex}${hex}`);
  }
  for (const color of colors)
    assert.ok(contrast(color, venueColors(color)["--venue-foreground"]) >= 4.5, color);
});
test("custom accent text stays readable against the light page background", () => {
  for (const color of ["#ffffff", "#ffff00", "#777777", "#c9ddab", "#254b3b", "#ff0088"])
    assert.ok(contrast("#faf9f6", venueColors(color)["--venue-text-accent"]) >= 4.5, color);
});

test("public dark appearance derives readable accent text independently of app appearance", () => {
  for (const color of ["#000000", "#ffffff", "#876d46", "#777777", "#00ff00", "#ff0088"])
    for (const surface of ["#121b17", "#19241d", "#202e23"])
      assert.ok(
        contrast(surface, venueColors(color, "dark")["--venue-text-accent"]) >= 4.5,
        `${color} on ${surface}`,
      );
  assert.equal(venueColors("invalid")["--venue-accent"], "#876d46");
});
