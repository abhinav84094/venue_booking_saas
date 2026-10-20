export const DEFAULT_TEMPLATE_ID = "classic";
const safeId = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;

export function buildTemplateCatalog(metadata, loaders) {
  const seen = new Set();
  const entries = Object.entries(metadata).map(([path, config]) => {
    if (
      !config ||
      typeof config.id !== "string" ||
      !safeId.test(config.id) ||
      [config.name, config.description, config.category].some(
        (value) => typeof value !== "string" || !value.trim(),
      )
    )
      throw new Error(`${path}: templateConfig needs a safe id, name, description and category.`);
    if (seen.has(config.id)) throw new Error(`Duplicate venue template id: ${config.id}`);
    if (typeof loaders[path] !== "function")
      throw new Error(`Missing component loader for ${path}`);
    seen.add(config.id);
    return { ...config, supportsDarkMode: config.supportsDarkMode === true, path };
  });
  if (!seen.has(DEFAULT_TEMPLATE_ID))
    throw new Error("Keep a classic template as the safe fallback.");
  return entries.sort((a, b) =>
    a.id === DEFAULT_TEMPLATE_ID
      ? -1
      : b.id === DEFAULT_TEMPLATE_ID
        ? 1
        : a.name.localeCompare(b.name),
  );
}

export function resolveTemplate(catalog, id) {
  return (
    catalog.find((entry) => entry.id === id) ||
    catalog.find((entry) => entry.id === DEFAULT_TEMPLATE_ID)
  );
}

export const SECTION_LABELS = {
  about: "Venue story",
  halls: "Hall listings",
  gallery: "Photo gallery",
  facilities: "Facilities and arrangements",
  contact: "Contact and location",
};

export function websiteSettings(website = {}) {
  return {
    headline: website.headline || "",
    tagline: website.tagline || "",
    accent: /^#[a-f\d]{6}$/i.test(website.accent) ? website.accent : "#876d46",
    template: website.template || DEFAULT_TEMPLATE_ID,
    appearance: ["light", "dark", "system"].includes(website.appearance)
      ? website.appearance
      : "system",
    sections: Object.fromEntries(
      Object.keys(SECTION_LABELS).map((section) => [
        section,
        website.sections?.[section] !== false,
      ]),
    ),
  };
}
