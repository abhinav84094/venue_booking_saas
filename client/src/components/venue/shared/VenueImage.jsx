import { safeHttps, venueImageSrcSet, venueImageUrl } from "./websiteData";

export default function VenueImage({ src, width = 960, sizes = "100vw", ...props }) {
  const original = safeHttps(src);
  if (!original) return null;
  const srcSet = venueImageSrcSet(original, width);
  return (
    <img
      loading="lazy"
      {...props}
      src={venueImageUrl(original, width)}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      decoding="async"
      onError={(event) => {
        // Accounts with strict Cloudinary transformations still display originals.
        const image = event.currentTarget;
        if (image.dataset.originalFallback !== original && image.src !== original) {
          image.dataset.originalFallback = original;
          image.removeAttribute("srcset");
          image.removeAttribute("sizes");
          image.src = original;
        }
      }}
    />
  );
}
