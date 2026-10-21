import { useEffect } from "react";
import { venueMetadata, venueStructuredData } from "../../../../../shared/venueMetadata.js";
import { getVenuePublicUrl } from "../../../utils/venueDomain.js";

const METADATA_SELECTOR =
  'title, meta[name="description"], meta[name="application-name"], meta[property^="og:"], link[rel~="canonical"], script[id="venue-structured-data"]';

export function useVenueMetadata(venue) {
  useEffect(() => {
    if (!venue) return;
    const canonicalUrl = getVenuePublicUrl(venue.slug) || "";
    const metadata = venueMetadata(venue, canonicalUrl);
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
    if (metadata.canonicalUrl) {
      append("link", { rel: "canonical", href: metadata.canonicalUrl });
      append("meta", { property: "og:url", content: metadata.canonicalUrl });
    }
    append("meta", { property: "og:type", content: "website" });
    append("meta", { property: "og:title", content: metadata.title });
    append("meta", { property: "og:description", content: metadata.description });
    if (metadata.image) append("meta", { property: "og:image", content: metadata.image });
    append(
      "script",
      { id: "venue-structured-data", type: "application/ld+json" },
      JSON.stringify(venueStructuredData(venue, metadata.canonicalUrl)),
    );

    return () => {
      managed.forEach((node) => node.remove());
      previous.forEach((node) => document.head.appendChild(node));
    };
  }, [venue]);
}
