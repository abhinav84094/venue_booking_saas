import { ArrowUpRight, Phone } from "lucide-react";

// Templates place the shared booking slot. API calls, quote validation and
// receipt credentials remain owned by the public page, never by a template.
export function EnquirySection({ venue, settings, slots }) {
  const whatsapp = venue.contact?.whatsapp?.replace(/\D/g, "");
  return (
    <section className="public-enquire" id="enquire">
      <div>
        <p className="eyebrow">LET'S MAKE SOMETHING MEMORABLE</p>
        <h2>
          Your occasion.
          <br />
          <i>Our invitation.</i>
        </h2>
        <p>
          Tell us a little about your plans. We'll help you find the space and setting to bring them
          to life.
        </p>
        {settings.sections.contact && (
          <div className="enquiry-contact">
            {venue.contact?.phone && (
              <a href={`tel:${venue.contact.phone}`}>
                <Phone size={17} />
                {venue.contact.phone}
              </a>
            )}
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                Start a conversation on WhatsApp <ArrowUpRight size={16} />
              </a>
            )}
          </div>
        )}
        <p className="muted small">
          All booking times use {venue.timezone}. Sending an enquiry does not reserve a hall.
          Confirmation comes from the venue.
        </p>
      </div>
      {slots.enquiry}
    </section>
  );
}
