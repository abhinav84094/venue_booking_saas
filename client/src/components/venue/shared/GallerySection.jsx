import { venueGallery } from "./websiteData";
import VenueImage from "./VenueImage";

export function GallerySection({ venue, halls, actions }) {
  const gallery = venueGallery(venue, halls);
  return (
    gallery.length > 0 && (
      <section className="public-gallery-section" id="gallery">
        <div className="public-section-heading">
          <div>
            <p className="eyebrow">A CLOSER LOOK</p>
            <h2>
              Picture <i>the possibilities.</i>
            </h2>
          </div>
          <span>{gallery.length} photographs</span>
        </div>
        <div className="public-gallery">
          {gallery.map((img, i) => (
            <button
              onClick={() => actions.showPhoto(img)}
              key={`${img.url}-${i}`}
              aria-label={`View ${img.alt || `photograph ${i + 1}`}`}
            >
              <VenueImage
                src={img.url}
                alt={img.alt || `${venue.name} gallery ${i + 1}`}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </section>
    )
  );
}
