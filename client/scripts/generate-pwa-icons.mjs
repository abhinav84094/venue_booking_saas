import { readFile, mkdir } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Rasterize the existing Prakash venue mark; no new visual identity or fonts.
const publicDir = new URL("../public/", import.meta.url);
const source = await readFile(new URL("favicon.svg", publicDir), "utf8");
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`;
const directory = new URL("pwa-icons/", publicDir);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [filename, size, inset, solid] of [
    ["icon-192.png", 192, 0, false],
    ["icon-512.png", 512, 0, false],
    ["maskable-512.png", 512, 64, true],
    ["apple-touch-icon.png", 180, 0, true],
  ]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:${solid ? "#244638" : "transparent"}"><img alt="Prakash SaaS Venue" src="${dataUrl}" style="display:block;position:absolute;inset:${inset}px;width:${size - inset * 2}px;height:${size - inset * 2}px"></body></html>`,
    );
    await page.locator("img").evaluate((element) => element.decode());
    await page.screenshot({
      path: fileURLToPath(new URL(filename, directory)),
      omitBackground: !solid,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
