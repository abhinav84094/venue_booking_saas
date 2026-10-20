import { VenueHeader, VenueFooter } from "../shared/VenueChrome";
import { VenueHero } from "../shared/VenueHero";
import { StorySection, FacilitiesSection, PoliciesSection } from "../shared/StorySections";
import { HallsSection } from "../shared/HallsSection";
import { GallerySection } from "../shared/GallerySection";
import { EnquirySection } from "../shared/EnquirySection";
import { ContactSection } from "../shared/ContactSection";

export const templateConfig = {
  id: "pavilion",
  name: "Pavilion",
  description:
    "A quiet boutique design with an arched photograph, garden details and a gallery-first story.",
  category: "Boutique",
  supportsDarkMode: true,
};

export default function Pavilion(props) {
  const { venue, settings } = props;
  return (
    <>
      <VenueHeader {...props} />
      <main>
        <VenueHero {...props} />
        {settings.sections.about && <StorySection venue={venue} />}
        {settings.sections.gallery && <GallerySection {...props} />}
        {settings.sections.facilities && <FacilitiesSection venue={venue} />}
        {settings.sections.halls && <HallsSection {...props} />}
        <EnquirySection {...props} />
        {settings.sections.about && <PoliciesSection venue={venue} />}
        {settings.sections.contact && <ContactSection venue={venue} />}
      </main>
      <VenueFooter venue={venue} />
    </>
  );
}
