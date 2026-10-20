import { safeHttps, venueImageUrl } from "./websiteData";

export default function VenueImage({ src, width = 960, ...props }) {
  const original = safeHttps(src);
  if (!original) return null;
  return (
    <img
      {...props}
      src={venueImageUrl(original, width)}
      decoding="async"
      onError={(event) => {
        // Accounts with strict Cloudinary transformations still display originals.
        const image = event.currentTarget;
        if (image.dataset.originalFallback !== original && image.src !== original) {
          image.dataset.originalFallback = original;
          image.src = original;
        }
      }}
    />
  );
}
