import { ArrowRight } from "lucide-react";
import { safeHttps } from "./websiteData";
import VenueImage from "./VenueImage";

export function VenueHero({ venue, settings }) {
  const cover = safeHttps(venue.coverImage);
  return (
    <section className={`public-hero ${cover ? "with-cover" : ""}`} id="home">
      {cover && (
        <VenueImage
          className="public-cover"
          src={cover}
          alt={`${venue.name}, event venue`}
          fetchPriority="high"
          width={1920}
        />
      )}
      <div className="public-hero-overlay" />
      <div className="public-hero-content">
        <p className="eyebrow">
          {venue.address?.city
            ? `IN THE HEART OF ${venue.address.city.toUpperCase()}`
            : "A PLACE FOR LIFE’S CELEBRATIONS"}
        </p>
        <h1>{settings.headline || "A beautiful setting. An unforgettable beginning."}</h1>
        <p>
          {settings.tagline ||
            venue.description?.slice(0, 190) ||
            "Make room for your most meaningful moments."}
        </p>
        <a
          href={settings.sections.halls ? "#spaces" : "#enquire"}
          className="btn btn-cream btn-large"
        >
          {settings.sections.halls ? "Discover our spaces" : "Plan your occasion"}
          <ArrowRight size={17} />
        </a>
      </div>
      <div className="public-hero-footer">
        <span>
          {venue.address?.city}
          {venue.address?.state ? `, ${venue.address.state}` : ""}
        </span>
        <span>SCROLL TO DISCOVER ↓</span>
      </div>
      {!cover && <div className="public-hero-arch" aria-hidden="true" />}
    </section>
  );
}
