import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTemplateCatalog,
  resolveTemplate,
  websiteSettings,
} from "../src/components/venue/templateCatalog.js";
import { extractTemplateMetadata } from "../build/venueTemplateMetadata.js";

const classic = {
  id: "classic",
  name: "Classic",
  description: "Original design",
  category: "Celebrations",
  supportsDarkMode: true,
};
const fixture = {
  id: "royal-wedding",
  name: "Royal Wedding",
  description: "An added design",
  category: "Wedding",
  supportsDarkMode: true,
};

test("one template file supplies metadata without executing component imports", async () => {
  const source = `import MissingComponent from "package-that-is-not-installed";
    export const templateConfig = ${JSON.stringify(fixture)};
    export default function RoyalWedding({ venue }) { return <main>{venue.name}<MissingComponent /></main>; }`;
  assert.deepEqual(await extractTemplateMetadata(source, "RoyalWedding.jsx"), fixture);
});

test("metadata extraction rejects computed metadata and missing default components", async () => {
  await assert.rejects(
    () =>
      extractTemplateMetadata(
        "export const templateConfig = getConfig(); export default function X(){ return null; }",
        "Invalid.jsx",
      ),
    /static object/,
  );
  await assert.rejects(
    () =>
      extractTemplateMetadata(
        `export const templateConfig = ${JSON.stringify(fixture)};`,
        "NoComponent.jsx",
      ),
    /default template/,
  );
});

test("catalog automatically includes added files without loading components, keeps ids after renames, and falls back after removal", () => {
  let loaded = 0;
  const loader = () => {
    loaded++;
  };
  const catalog = buildTemplateCatalog(
    { "./Classic.jsx": classic, "./RenamedFile.jsx": fixture },
    { "./Classic.jsx": loader, "./RenamedFile.jsx": loader },
  );
  assert.equal(loaded, 0);
  assert.equal(catalog.length, 2);
  assert.equal(resolveTemplate(catalog, "royal-wedding").name, "Royal Wedding");
  assert.equal(resolveTemplate(catalog, "deleted-template").id, "classic");
  assert.equal(
    resolveTemplate(
      catalog.filter((entry) => entry.id !== fixture.id),
      fixture.id,
    ).id,
    "classic",
  );
});

test("catalog rejects duplicate ids, unsafe ids, invalid metadata, and a missing fallback", () => {
  const loaders = { a() {}, b() {} };
  assert.throws(() => buildTemplateCatalog({ a: classic, b: classic }, loaders), /Duplicate/);
  assert.throws(
    () => buildTemplateCatalog({ a: { ...classic, id: "../../x" } }, loaders),
    /safe id/,
  );
  assert.throws(() => buildTemplateCatalog({ a: { ...classic, name: "" } }, loaders), /name/);
  assert.throws(() => buildTemplateCatalog({ a: fixture }, loaders), /fallback/);
});

test("legacy settings preserve template ids and default optional sections and appearance safely", () => {
  assert.equal(websiteSettings({ template: "editorial" }).template, "editorial");
  assert.equal(websiteSettings({ template: "removed" }).template, "removed");
  assert.equal(websiteSettings({ appearance: "invalid", accent: "invalid" }).appearance, "system");
  assert.equal(websiteSettings({ sections: { gallery: false } }).sections.gallery, false);
  assert.equal(websiteSettings({ sections: { gallery: false } }).sections.contact, true);
});
