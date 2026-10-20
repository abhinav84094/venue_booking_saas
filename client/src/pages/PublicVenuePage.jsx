import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { getVenueSlugFromHostname } from "../utils/venueDomain";
import { venueColors } from "../utils/venueColors";
import { Loading, ErrorNotice, Button } from "../components/ui";
import TemplateRenderer from "../components/venue/TemplateRenderer";
import { getVenueTemplate } from "../components/venue/templateRegistry";
import { websiteSettings } from "../components/venue/templateCatalog";
import { useWebsiteAppearance } from "../components/venue/shared/useWebsiteAppearance";
import { useVenueMetadata } from "../features/public-venue/hooks/useVenueMetadata";
import EnquiryForm from "../features/public-venue/components/EnquiryForm";
import PhotoDialog from "../features/public-venue/components/PhotoDialog";
import { setPublicAppearanceHint } from "../theme/themeStore";

export default function PublicVenuePage() {
  const params = useParams();
  const slug = getVenueSlugFromHostname() || params.slug;
  const resource = useResource(`/public/venues/${slug}`);
  const [selectedHall, setSelectedHall] = useState("");
  const [photo, setPhoto] = useState(null);
  const venue = resource.data?.venue;
  const halls = resource.data?.halls || [];
  const settings = websiteSettings(venue?.website);
  const { config } = getVenueTemplate(settings.template);
  const appearance = useWebsiteAppearance(settings.appearance, config.supportsDarkMode);
  useVenueMetadata(venue);
  useEffect(() => {
    if (venue) setPublicAppearanceHint(appearance);
  }, [venue, appearance]);

  if (resource.loading) return <Loading text="A beautiful space is just a moment away..." />;
  if (resource.error)
    return (
      <main className="public-unavailable">
        <Building2 size={40} />
        <h1>This venue is taking a little time.</h1>
        <ErrorNotice error={resource.error} />
        <Button onClick={resource.reload}>Try again</Button>
        <p>The venue may be unpublished or temporarily unavailable.</p>
      </main>
    );
  if (!venue) return null;

  function chooseHall(id) {
    setSelectedHall(id);
    document.getElementById("enquire")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }
  return (
    <div
      className="public-venue"
      data-venue-website
      data-appearance={appearance}
      style={{ ...venueColors(settings.accent, appearance), colorScheme: appearance }}
    >
      <TemplateRenderer
        templateId={settings.template}
        venue={venue}
        halls={halls}
        theme={{ appearance, accent: settings.accent }}
        settings={settings}
        actions={{ chooseHall, showPhoto: setPhoto }}
        slots={{
          enquiry: (
            <EnquiryForm
              key={selectedHall || "first"}
              slug={slug}
              venue={venue}
              halls={halls}
              selectedHall={selectedHall}
            />
          ),
        }}
      />
      {photo && <PhotoDialog photo={photo} onClose={() => setPhoto(null)} />}
    </div>
  );
}
