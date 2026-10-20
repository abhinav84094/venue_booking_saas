import { getCloudinary } from "../config/cloudinary.js";
import { fail } from "../utils/errors.js";

const ALLOWED_CATEGORIES = new Set(["halls", "logos", "gallery"]);

export function imageStorageError(error) {
  const detail = error?.error || error || {};
  const providerStatus = Number(detail.http_code || error?.http_code);
  const message = String(detail.message || "");
  let code = "IMAGE_STORAGE_UNAVAILABLE";
  let publicMessage = "Image storage is temporarily unavailable. Please try uploading again.";
  if (providerStatus === 403 || /missing permissions/i.test(message)) {
    code = "IMAGE_STORAGE_PERMISSIONS";
    publicMessage =
      "Image storage denied this upload. Enable image upload/create permission for the Cloudinary API key in this product environment.";
  } else if (
    providerStatus === 401 ||
    /cloud_name mismatch|invalid (?:api.?key|signature)|unknown api.?key/i.test(message)
  ) {
    code = "IMAGE_STORAGE_CONFIGURATION";
    publicMessage =
      "Image storage configuration is invalid. The Cloudinary cloud name, API key and API secret must belong to the same product environment.";
  } else if ([408, 499, 504].includes(providerStatus) || /timeout|timed out/i.test(message)) {
    code = "IMAGE_STORAGE_TIMEOUT";
    publicMessage = "Image upload timed out. Please try again with a smaller image.";
  }
  const normalized = fail(publicMessage, 503);
  normalized.code = code;
  if (Number.isInteger(providerStatus) && providerStatus >= 400 && providerStatus <= 599)
    normalized.providerStatus = providerStatus;
  return normalized;
}

function storageFolder(venueId, category) {
  if (!ALLOWED_CATEGORIES.has(category)) {
    throw new Error("Unsupported image category");
  }

  return `prakash-venue/venues/${venueId}/${category}`;
}

export function uploadImage({ buffer, venueId, category }) {
  const cloudinary = getCloudinary();

  const folder = storageFolder(venueId, category);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        overwrite: false,
        timeout: 30000,
      },
      (error, result) => {
        if (error) return reject(imageStorageError(error));

        if (!result?.secure_url || !result?.public_id) {
          return reject(imageStorageError());
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    stream.on("error", (error) => reject(imageStorageError(error)));
    stream.end(buffer);
  });
}

export async function deleteImage(publicId) {
  if (!publicId) return;

  const cloudinary = getCloudinary();

  return cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });
}
