import { useState } from "react";
import api from "../../../services/api";
import { websiteSettings } from "../../../components/venue/templateCatalog";

export function useWebsiteEditor({ venue, base, reloadVenue }) {
  const [website, setWebsite] = useState(() => websiteSettings(venue.website));
  const [images, setImages] = useState(venue.images || []);
  const [cover, setCover] = useState(venue.coverImage || "");
  const [description, setDescription] = useState(venue.description || "");
  const [contact, setContact] = useState({ phone: "", email: "", whatsapp: "", ...venue.contact });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const previewVenue = { ...venue, website, images, coverImage: cover, description, contact };

  async function persist() {
    await api.patch(`${base}/venue-profile`, {
      website,
      images: images.map(({ url, alt }) => ({ url, alt: alt || "" })),
      coverImage: cover,
      description,
      contact,
    });
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await persist();
      setMessage("Your website content and appearance are saved.");
      reloadVenue();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      // A draft's previewed content is saved before it becomes public.
      if (!venue.published) await persist();
      await api.post(`${base}/publication`, { published: !venue.published });
      setMessage(venue.published ? "Website moved to draft." : "Your venue is published.");
      reloadVenue();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return {
    website,
    setWebsite,
    images,
    setImages,
    cover,
    setCover,
    description,
    setDescription,
    contact,
    setContact,
    previewVenue,
    busy,
    error,
    message,
    save,
    publish,
  };
}
