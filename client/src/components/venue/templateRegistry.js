import { lazy } from "react";
import { buildTemplateCatalog, resolveTemplate } from "./templateCatalog";

const metadata = import.meta.glob("./templates/*.jsx", {
  eager: true,
  import: "templateConfig",
  query: "?venue-template-meta",
});
const loaders = import.meta.glob("./templates/*.jsx");
export const availableTemplates = buildTemplateCatalog(metadata, loaders);
const components = new Map(
  availableTemplates.map((entry) => [entry.id, lazy(loaders[entry.path])]),
);

export function getVenueTemplate(id) {
  const config = resolveTemplate(availableTemplates, id);
  return { config, Component: components.get(config.id) };
}
