import { ArrowUpRight } from "lucide-react";
import { venueGallery } from "./websiteData";

export function VenueHeader({ venue, halls, settings }) {
  return (
    <header className="public-header">
      <a href="#home" className="venue-wordmark">
        {venue.name}
        <span>GATHER BEAUTIFULLY</span>
      </a>
      <nav aria-label="Venue navigation">
        {settings.sections.halls && <a href="#spaces">Our spaces</a>}
        {settings.sections.about && <a href="#story">Our story</a>}
        {settings.sections.gallery && venueGallery(venue, halls).length > 0 && (
          <a href="#gallery">Gallery</a>
        )}
        {settings.sections.contact && <a href="#contact">Find us</a>}
      </nav>
      <a href="#enquire" className="btn btn-venue">
        Plan your occasion <ArrowUpRight size={16} />
      </a>
    </header>
  );
}

export function VenueFooter({ venue }) {
  return (
    <footer className="public-footer">
      <span className="venue-wordmark">{venue.name}</span>
      <span>© {new Date().getFullYear()} · All moments welcome.</span>
      <a href={import.meta.env.VITE_VENUE_PLATFORM_URL || "/"}>
        Powered by Prakash SaaS <ArrowUpRight size={12} />
      </a>
    </footer>
  );
}
