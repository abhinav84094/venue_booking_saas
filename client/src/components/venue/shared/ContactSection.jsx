import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { safeHttps } from "./websiteData";

export function ContactSection({ venue }) {
  const maps = safeHttps(venue.mapsUrl);
  return (
    <section className="public-contact" id="contact">
      <div>
        <p className="eyebrow">WE'D LOVE TO WELCOME YOU</p>
        <h2>
          A place worth <i>finding.</i>
        </h2>
        <p>
          <MapPin size={17} />
          {[
            venue.address?.line1,
            venue.address?.city,
            venue.address?.state,
            venue.address?.postalCode,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
        {venue.openingHours && <p>Visiting hours: {venue.openingHours}</p>}
        {maps && (
          <a className="btn btn-secondary" href={maps} target="_blank" rel="noreferrer">
            Open in Google Maps
            <ArrowUpRight size={16} />
          </a>
        )}
      </div>
      <div>
        {venue.contact?.phone && (
          <a href={`tel:${venue.contact.phone}`}>
            <Phone size={20} />
            <span>
              Give us a call<strong>{venue.contact.phone}</strong>
            </span>
          </a>
        )}
        {venue.contact?.email && (
          <a href={`mailto:${venue.contact.email}`}>
            <Mail size={20} />
            <span>
              A note, anytime<strong>{venue.contact.email}</strong>
            </span>
          </a>
        )}
      </div>
    </section>
  );
}
