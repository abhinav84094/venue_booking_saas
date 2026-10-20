import { useEffect } from "react";

export function useVenueMetadata(venue) {
  useEffect(() => {
    if (!venue) return;
    const oldTitle = document.title;
    document.title = `${venue.name} | Prakash SaaS`;
    let meta = document.querySelector('meta[name="description"]');
    const previous = meta?.content,
      created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = (
      venue.website?.tagline ||
      venue.description ||
      `Explore halls and enquire about your next event at ${venue.name}.`
    ).slice(0, 160);
    let script = document.getElementById("venue-structured-data");
    const createdScript = !script,
      previousStructure = script?.textContent;
    if (!script) {
      script = document.createElement("script");
      script.id = "venue-structured-data";
      document.head.appendChild(script);
    }
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "EventVenue",
      name: venue.name,
      description: venue.description,
      telephone: venue.contact?.phone || undefined,
      image: venue.coverImage || undefined,
      address: {
        "@type": "PostalAddress",
        streetAddress: venue.address?.line1,
        addressLocality: venue.address?.city,
        addressRegion: venue.address?.state,
        postalCode: venue.address?.postalCode,
        addressCountry: "IN",
      },
    });

    return () => {
      document.title = oldTitle;
      if (createdScript) script.remove();
      else script.textContent = previousStructure;
      if (created) meta.remove();
      else meta.content = previous;
    };
  }, [venue]);
}
