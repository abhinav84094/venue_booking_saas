import { VenueHeader, VenueFooter } from "../shared/VenueChrome";
import { VenueHero } from "../shared/VenueHero";
import { StorySection, FacilitiesSection, PoliciesSection } from "../shared/StorySections";
import { HallsSection } from "../shared/HallsSection";
import { GallerySection } from "../shared/GallerySection";
import { EnquirySection } from "../shared/EnquirySection";
import { ContactSection } from "../shared/ContactSection";

// Adding this file alone makes the design selectable. No registry or API edit.
export const templateConfig = {
  id: "royal-wedding",
  name: "Royal Wedding",
  description: "A framed photographic invitation with a gallery-led wedding story.",
  category: "Wedding",
  supportsDarkMode: true,
};

export default function RoyalWedding(props) {
  const { venue, settings } = props;
  return (
    <>
      <VenueHeader {...props} />
      <main>
        <div style={{ padding: "clamp(12px, 3vw, 44px)", background: "var(--paper)" }}>
          <div style={{ border: "1px solid var(--venue-accent)", padding: "8px" }}>
            <VenueHero {...props} />
          </div>
        </div>
        {settings.sections.about && <StorySection venue={venue} />}
        {settings.sections.gallery && <GallerySection {...props} />}
        {settings.sections.halls && <HallsSection {...props} />}
        {settings.sections.facilities && <FacilitiesSection venue={venue} />}
        <EnquirySection {...props} />
        {settings.sections.about && <PoliciesSection venue={venue} />}
        {settings.sections.contact && <ContactSection venue={venue} />}
      </main>
      <VenueFooter venue={venue} />
    </>
  );
}
