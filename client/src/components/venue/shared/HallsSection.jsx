import { Building2, Users, ArrowUpRight } from "lucide-react";
import { money } from "../../../utils/format";
import VenueImage from "./VenueImage";

export function HallsSection({ halls, actions }) {
  return (
    <section className="public-spaces" id="spaces">
      <div className="public-section-heading">
        <div>
          <p className="eyebrow">ROOM FOR EVERY OCCASION</p>
          <h2>
            Find your <i>perfect setting.</i>
          </h2>
        </div>
        <p>
          Each space has its own character.
          <br />
          Every celebration has a place.
        </p>
      </div>
      <div className="public-hall-grid">
        {halls.map((h, i) => (
          <article className="public-hall" key={h._id}>
            <div className="public-hall-image">
              {h.images?.[0] ? (
                <VenueImage
                  src={h.images?.[0].url}
                  alt={h.images?.[0].alt || h.name}
                  loading="lazy"
                  sizes="(max-width: 760px) 88vw, 45vw"
                />
              ) : (
                <div className="public-hall-art">
                  <Building2 size={55} />
                </div>
              )}
              <span>0{i + 1} / THE COLLECTION</span>
            </div>
            <div className="public-hall-content">
              <div>
                <h3>{h.name}</h3>
                <span>
                  <Users size={15} />
                  Up to {h.capacity} guests
                </span>
              </div>
              <p className="preserve-lines">{h.description}</p>
              <div className="facility-tags">
                {(h.facilities || []).map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
              <div className="public-rate-list">
                {h.pricing.map((r) => (
                  <div key={r.key}>
                    <span>{r.label}</span>
                    <strong>
                      {money(r.amount)}
                      <small>{r.key === "HOURLY" ? " / hour" : ""}</small>
                    </strong>
                  </div>
                ))}
              </div>
              {h.pricing.some((r) => r.weekendAmount != null || r.overrides?.length > 0) && (
                <p className="muted small">
                  Weekend and date-specific rates may apply. Request an exact quote below.
                </p>
              )}
              {h.enquiriesEnabled === true ? (
                <button className="public-hall-action" onClick={() => actions.chooseHall(h._id)}>
                  Explore availability & enquire <ArrowUpRight size={19} />
                </button>
              ) : (
                <p className="muted small">
                  Online booking is currently unavailable for this hall. Please contact the venue
                  directly.
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
