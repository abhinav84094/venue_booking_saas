import { uploadImage } from "../services/imageStorageService.js";

export async function postImage(req, res) {
  const image = await uploadImage({
    buffer: req.file.buffer,
    venueId: req.venue._id,
    category: "gallery",
  });
  res.status(201).json({ success: true, image: { url: image.url, alt: "" } });
}
