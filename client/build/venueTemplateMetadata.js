import { parseAst, transformWithOxc } from "vite";

// Metadata has its own module identity, so reading the catalog never imports
// template components. Template JSX stays behind an independent dynamic import.
function literal(node) {
  if (node.type === "Literal") return node.value;
  if (node.type === "ArrayExpression") return node.elements.map(literal);
  if (node.type === "ObjectExpression")
    return Object.fromEntries(
      node.properties.map((property) => {
        if (property.type !== "Property" || property.computed || property.kind !== "init")
          throw new Error("Template metadata must contain plain static values.");
        return [property.key.name ?? property.key.value, literal(property.value)];
      }),
    );
  throw new Error("templateConfig must be a static object literal without imports or functions.");
}

export async function extractTemplateMetadata(source, filename) {
  const { code } = await transformWithOxc(source, filename);
  const ast = parseAst(code);
  if (!ast.body.some((node) => node.type === "ExportDefaultDeclaration"))
    throw new Error(`${filename}: export a default template component.`);
  for (const node of ast.body) {
    if (node.type !== "ExportNamedDeclaration" || node.declaration?.type !== "VariableDeclaration")
      continue;
    const declaration = node.declaration.declarations.find(
      (value) => value.id.name === "templateConfig",
    );
    if (declaration) return literal(declaration.init);
  }
  throw new Error(`${filename}: export const templateConfig = { ... } is required.`);
}

export function venueTemplateMetadata() {
  return {
    name: "venue-template-metadata",
    enforce: "pre",
    async transform(source, id) {
      if (!id.includes("?venue-template-meta")) return null;
      const metadata = await extractTemplateMetadata(source, id.split("?")[0]);
      return { code: `export const templateConfig = ${JSON.stringify(metadata)};`, map: null };
    },
  };
}
