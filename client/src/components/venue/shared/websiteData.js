import { safeHttps } from "../../../../../shared/venueImages.js";
export { safeHttps, venueImageUrl, venueImageSrcSet } from "../../../../../shared/venueImages.js";

export function venueGallery(venue, halls = []) {
  return [...(venue.images || []), ...halls.flatMap((hall) => hall.images || [])]
    .filter((image) => safeHttps(image.url))
    .filter(
      (image, index, images) => images.findIndex((entry) => entry.url === image.url) === index,
    );
}
