import { useState } from "react";
import { Monitor, Tablet, Smartphone } from "lucide-react";
import TemplateRenderer from "./TemplateRenderer";
import { getVenueTemplate } from "./templateRegistry";
import { useWebsiteAppearance } from "./shared/useWebsiteAppearance";
import { venueColors } from "../../utils/venueColors";
import { Button, ErrorNotice, Notice } from "../ui";
import PhotoDialog from "../../features/public-venue/components/PhotoDialog";

export default function WebsitePreview({ venue, halls, loading, error }) {
  const [device, setDevice] = useState("desktop");
  const [photo, setPhoto] = useState(null);
  const settings = venue.website;
  const { config } = getVenueTemplate(settings.template);
  const appearance = useWebsiteAppearance(settings.appearance, config.supportsDarkMode);
  return (
    <section className="panel" aria-labelledby="website-preview-title" id="website-preview">
      <div className="website-preview-toolbar">
        <div>
          <h2 id="website-preview-title">Preview your changes</h2>
          <p className="website-preview-note">
            Unsaved content · {config.name} · {appearance} appearance
          </p>
        </div>
        <div className="website-preview-devices" role="group" aria-label="Preview screen size">
          {[
            ["desktop", Monitor],
            ["tablet", Tablet],
            ["mobile", Smartphone],
          ].map(([value, Icon]) => (
            <Button
              key={value}
              variant="secondary"
              aria-label={`${value} preview`}
              aria-pressed={device === value}
              onClick={() => setDevice(value)}
            >
              <Icon size={17} />
              <span>{value}</span>
            </Button>
          ))}
        </div>
      </div>
      <ErrorNotice error={error} />
      {loading && <Notice type="info">Loading your hall listings...</Notice>}
      <div className="website-preview-shell" data-device={device} data-testid="website-preview">
        <div
          className="public-venue"
          data-appearance={appearance}
          style={{ ...venueColors(settings.accent, appearance), colorScheme: appearance }}
          onClickCapture={(event) => {
            // Keep preview links inside the editor; use the live-site link for navigation.
            if (event.target.closest("a")) event.preventDefault();
          }}
        >
          <TemplateRenderer
            templateId={settings.template}
            venue={venue}
            halls={halls}
            settings={settings}
            theme={{ appearance, accent: settings.accent }}
            actions={{ showPhoto: setPhoto, chooseHall: () => {} }}
            slots={{
              enquiry: (
                <div className="website-preview-enquiry">
                  <strong>Your shared enquiry form</strong>Visitors can choose a hall, check its
                  real quote and availability, then send an enquiry. The preview does not send
                  bookings.
                </div>
              ),
            }}
          />
          {photo && <PhotoDialog photo={photo} onClose={() => setPhoto(null)} />}
        </div>
      </div>
    </section>
  );
}
