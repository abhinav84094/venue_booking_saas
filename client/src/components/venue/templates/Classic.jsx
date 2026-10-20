import { VenueHeader, VenueFooter } from "../shared/VenueChrome";
import { VenueHero } from "../shared/VenueHero";
import { StorySection, FacilitiesSection, PoliciesSection } from "../shared/StorySections";
import { HallsSection } from "../shared/HallsSection";
import { GallerySection } from "../shared/GallerySection";
import { EnquirySection } from "../shared/EnquirySection";
import { ContactSection } from "../shared/ContactSection";

export const templateConfig = {
  id: "classic",
  name: "Classic",
  description: "An inviting photographic welcome with a timeless, generous layout.",
  category: "Celebrations",
  supportsDarkMode: true,
};

export default function Classic(props) {
  const { venue, settings } = props;
  return (
    <>
      <VenueHeader {...props} />
      <main>
        <VenueHero {...props} />
        {settings.sections.about && <StorySection venue={venue} />}
        {settings.sections.halls && <HallsSection {...props} />}
        {settings.sections.gallery && <GallerySection {...props} />}
        {settings.sections.facilities && <FacilitiesSection venue={venue} />}
        <EnquirySection {...props} />
        {settings.sections.about && <PoliciesSection venue={venue} />}
        {settings.sections.contact && <ContactSection venue={venue} />}
      </main>
      <VenueFooter venue={venue} />
    </>
  );
}
