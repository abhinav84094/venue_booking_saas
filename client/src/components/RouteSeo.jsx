import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getVenueHost } from "../utils/venueDomain";
import { PLATFORM_ORIGIN, platformMetadata, platformStructuredData } from "../../../shared/platformSeo.js";

const SELECTOR = 'title, meta[name="description"], meta[name="robots"], meta[name="googlebot"], meta[name="bingbot"], meta[property^="og:"], meta[name^="twitter:"], meta[property^="twitter:"], link[rel~="canonical"], link[data-venue-hero-preload], script[type="application/ld+json"]';

export default function RouteSeo() {
  const { pathname } = useLocation();
  useEffect(() => {
    const host = getVenueHost();
    // Keep authoritative tenant SSR tags while its public page loads.
    if (host.type === "tenant" && pathname === "/") return;
    if (host.type === "platform" && /^\/v\//.test(pathname)) {
      // Client navigation must immediately stop advertising the homepage as
      // this preview's canonical, even while its venue request is pending.
      document.head.querySelectorAll('link[rel~="canonical"], meta[property="og:url"], #platform-structured-data').forEach((node) => node.remove());
      document.head.querySelectorAll('meta[name="robots"]').forEach((node) => node.remove());
      const robots = document.createElement("meta");
      robots.name = "robots";
      robots.content = "noindex,follow";
      document.head.appendChild(robots);
      return;
    }
    const home = host.type === "platform" && pathname === "/";
    const indexable = home && window.location.origin === PLATFORM_ORIGIN;
    document.head.querySelectorAll(SELECTOR).forEach((node) => node.remove());
    const append = (tag, attributes, content) => {
      const element = document.createElement(tag);
      Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
      if (content !== undefined) element.textContent = content;
      document.head.appendChild(element);
    };
    const metadata = platformMetadata();
    append("title", {}, home ? metadata.title : "Owner workspace | Prakash SaaS");
    append("meta", { name: "robots", content: indexable ? "index,follow,max-image-preview:large" : "noindex,follow" });
    if (!home) return;
    append("meta", { name: "description", content: metadata.description });
    for (const [property, content] of Object.entries({ "og:type": "website", "og:site_name": "Prakash SaaS", "og:title": metadata.title, "og:description": metadata.description, "og:image": metadata.image, "og:image:alt": metadata.imageAlt })) append("meta", { property, content });
    for (const [name, content] of Object.entries({ "twitter:card": "summary", "twitter:title": metadata.title, "twitter:description": metadata.description, "twitter:image": metadata.image, "twitter:image:alt": metadata.imageAlt })) append("meta", { name, content });
    if (indexable) {
      append("link", { rel: "canonical", href: metadata.canonicalUrl });
      append("meta", { property: "og:url", content: metadata.canonicalUrl });
      append("script", { id: "platform-structured-data", type: "application/ld+json" }, JSON.stringify(platformStructuredData()));
    }
  }, [pathname]);
  return null;
}
