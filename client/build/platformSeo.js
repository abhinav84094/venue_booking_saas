import { renderPlatformHtml } from "../../shared/platformSeo.js";

export function platformSeo() {
  return {
    name: "platform-initial-html",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      // A raw Netlify deploy or preview must fail closed for indexing. The
      // platform edge renderer enables indexing only on the canonical apex.
      handler: (html) => renderPlatformHtml(html, { indexable: false }),
    },
  };
}
