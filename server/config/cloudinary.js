import { v2 as cloudinary } from "cloudinary";

export function getCloudinary() {
  const { VENUE_CLOUDINARY_CLOUD_NAME, VENUE_CLOUDINARY_API_KEY, VENUE_CLOUDINARY_API_SECRET } =
    process.env;

  if (!VENUE_CLOUDINARY_CLOUD_NAME || !VENUE_CLOUDINARY_API_KEY || !VENUE_CLOUDINARY_API_SECRET) {
    const error = new Error("Cloudinary environment variables are missing");
    error.statusCode = 503;
    throw error;
  }

  cloudinary.config({
    cloud_name: VENUE_CLOUDINARY_CLOUD_NAME,
    api_key: VENUE_CLOUDINARY_API_KEY,
    api_secret: VENUE_CLOUDINARY_API_SECRET,
    secure: true,
  });

  return cloudinary;
}
