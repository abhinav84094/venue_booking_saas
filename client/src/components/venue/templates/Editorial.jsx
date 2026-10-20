import { VenueHeader, VenueFooter } from "../shared/VenueChrome";
import { VenueHero } from "../shared/VenueHero";
import { StorySection, FacilitiesSection, PoliciesSection } from "../shared/StorySections";
import { HallsSection } from "../shared/HallsSection";
import { GallerySection } from "../shared/GallerySection";
import { EnquirySection } from "../shared/EnquirySection";
import { ContactSection } from "../shared/ContactSection";

export const templateConfig = {
  id: "editorial",
  name: "Editorial",
  description: "A contemporary magazine layout with bold typography and spacious hall stories.",
  category: "Contemporary",
  supportsDarkMode: true,
};

export default function Editorial(props) {
  const { venue, halls, settings } = props;
  return (
    <>
      <VenueHeader {...props} />
      <main>
        <div className="editorial-introduction">
          <span className="eyebrow">{venue.address?.city || "YOUR NEXT GATHERING"}</span>
          <span>
            {halls.length} {halls.length === 1 ? "distinctive space" : "distinctive spaces"}
          </span>
        </div>
        <VenueHero {...props} />
        {settings.sections.halls && <HallsSection {...props} />}
        {settings.sections.about && <StorySection venue={venue} />}
        {settings.sections.facilities && <FacilitiesSection venue={venue} />}
        {settings.sections.gallery && <GallerySection {...props} />}
        <EnquirySection {...props} />
        {settings.sections.about && <PoliciesSection venue={venue} />}
        {settings.sections.contact && <ContactSection venue={venue} />}
      </main>
      <VenueFooter venue={venue} />
    </>
  );
}
