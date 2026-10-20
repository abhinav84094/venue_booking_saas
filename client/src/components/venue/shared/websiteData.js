export function safeHttps(value) {
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

export function venueGallery(venue, halls = []) {
  return [...(venue.images || []), ...halls.flatMap((hall) => hall.images || [])]
    .filter((image) => safeHttps(image.url))
    .filter(
      (image, index, images) => images.findIndex((entry) => entry.url === image.url) === index,
    );
}

export function venueImageUrl(value, width) {
  const safe = safeHttps(value);
  if (!safe) return null;
  const url = new URL(safe);
  const marker = "/image/upload/";
  if (url.hostname !== "res.cloudinary.com" || !url.pathname.includes(marker)) return safe;
  const [prefix, asset] = url.pathname.split(marker);
  // Signed and pre-transformed URLs must keep their original signature/transform.
  const first = asset.split("/")[0];
  if (
    first.startsWith("s--") ||
    first.includes(",") ||
    first.includes(":") ||
    /^[a-z]{1,3}_/.test(first)
  )
    return safe;
  const size = Math.max(320, Math.min(1920, Math.round(Number(width) || 960)));
  url.pathname = `${prefix}${marker}f_auto,q_auto,w_${size},c_limit/${asset}`;
  return url.toString();
}
