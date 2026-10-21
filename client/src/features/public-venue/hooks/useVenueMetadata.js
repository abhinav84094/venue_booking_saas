import { useEffect } from "react";
import { venueMetadata, venueStructuredData } from "../../../../../shared/venueMetadata.js";
import { DEFAULT_TENANT_BASE_DOMAIN } from "../../../../../shared/tenantHost.js";

const METADATA_SELECTOR =
  'title, meta[name="description"], meta[name="application-name"], meta[name="robots"], meta[name="googlebot"], meta[name="bingbot"], meta[property^="og:"], meta[name^="twitter:"], meta[property^="twitter:"], link[rel~="canonical"], script[type="application/ld+json"], script[id="venue-structured-data"], script[id="platform-structured-data"]';

export function useVenueMetadata(venue, { error } = {}) {
  useEffect(() => {
    if (!venue && !error) return;
    // Only a successfully resolved production tenant root is indexable. Local
    // and Netlify /v previews remain useful without claiming a published URL.
    const indexable =
      !error &&
      venue &&
      window.location.hostname === `${venue.slug}.${DEFAULT_TENANT_BASE_DOMAIN}` &&
      window.location.protocol === "https:" &&
      (!window.location.port || window.location.port === "443") &&
      window.location.pathname === "/";
    const canonicalUrl = indexable ? `https://${venue.slug}.${DEFAULT_TENANT_BASE_DOMAIN}/` : "";
    const metadata = error
      ? {
          title: "Venue unavailable | Prakash SaaS",
          description: "This venue is unavailable or could not be loaded. Please try again later.",
        }
      : venueMetadata(venue, canonicalUrl);
    // Replace the SSR tags as one set, including duplicates from older builds.
    // Restore prior document metadata when leaving the public venue page.
    const previous = [...document.head.querySelectorAll(METADATA_SELECTOR)];
    previous.forEach((node) => node.remove());
    const managed = [];
    const append = (name, attributes, content) => {
      const element = document.createElement(name);
      for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
      if (content !== undefined) element.textContent = content;
      document.head.appendChild(element);
      managed.push(element);
    };
    append("title", {}, metadata.title);
    append("meta", { name: "application-name", content: "Prakash SaaS" });
    append("meta", { name: "description", content: metadata.description });
    append("meta", {
      name: "robots",
      content: indexable ? "index,follow,max-image-preview:large" : "noindex,follow",
    });
    if (metadata.canonicalUrl) {
      append("link", { rel: "canonical", href: metadata.canonicalUrl });
      append("meta", { property: "og:url", content: metadata.canonicalUrl });
    }
    if (!error) {
      append("meta", { property: "og:type", content: "website" });
      append("meta", { property: "og:site_name", content: venue.name });
      append("meta", { property: "og:title", content: metadata.title });
      append("meta", { property: "og:description", content: metadata.description });
      append("meta", {
        name: "twitter:card",
        content: metadata.image ? "summary_large_image" : "summary",
      });
      append("meta", { name: "twitter:title", content: metadata.title });
      append("meta", { name: "twitter:description", content: metadata.description });
      if (metadata.image) {
        append("meta", { property: "og:image", content: metadata.image });
        append("meta", { property: "og:image:alt", content: metadata.imageAlt });
        append("meta", { name: "twitter:image", content: metadata.image });
        append("meta", { name: "twitter:image:alt", content: metadata.imageAlt });
      }
      append(
        "script",
        { id: "venue-structured-data", type: "application/ld+json" },
        JSON.stringify(venueStructuredData(venue, metadata.canonicalUrl)),
      );
    }

    return () => {
      managed.forEach((node) => node.remove());
      previous.forEach((node) => document.head.appendChild(node));
    };
  }, [venue, error]);
}
