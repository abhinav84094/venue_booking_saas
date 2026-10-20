import { Check } from "lucide-react";

export function StorySection({ venue }) {
  return (
    <section className="public-intro" id="story">
      <p className="eyebrow">THE SETTING FOR YOUR STORY</p>
      <h2>
        Some moments
        <br />
        deserve <i>a special place.</i>
      </h2>
      <div>
        <p className="preserve-lines">
          {venue.description ||
            `Welcome to ${venue.name}. Explore our event spaces and find the right setting for your next gathering.`}
        </p>
      </div>
    </section>
  );
}

export function FacilitiesSection({ venue }) {
  const extras = [
    ["Parking", venue.parking],
    ["Catering", venue.catering],
    ["Decoration", venue.decoration],
  ].filter(([, value]) => value);
  if (!(venue.facilities || []).length && !extras.length) return null;
  return (
    <section className="venue-facilities-section" id="facilities" aria-label="Venue facilities">
      {(venue.facilities || []).length > 0 && (
        <div className="public-facilities">
          {venue.facilities.map((facility) => (
            <span key={facility}>
              <Check size={14} />
              {facility}
            </span>
          ))}
        </div>
      )}
      {extras.length > 0 && (
        <div className="public-extras">
          {extras.map(([title, value]) => (
            <article key={title}>
              <span aria-hidden="true">✧</span>
              <h3>{title}</h3>
              <p>{value}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function PoliciesSection({ venue }) {
  return venue.policies ? (
    <section className="public-policies">
      <p className="eyebrow">A FEW THOUGHTFUL DETAILS</p>
      <h2>Venue policies</h2>
      <p className="preserve-lines">{venue.policies}</p>
    </section>
  ) : null;
}
