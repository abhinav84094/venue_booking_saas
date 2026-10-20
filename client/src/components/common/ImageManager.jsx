import { useState } from "react";
import { ArrowRight, ImagePlus, X } from "lucide-react";
import api from "../../services/api";
import { Button } from "./Button";
import { Field } from "./FormFields";
import { ErrorNotice } from "./Feedback";

export function ImageManager({ base, images, onChange }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [url, setUrl] = useState("");
  async function upload(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new Error("Choose a JPG, PNG or WebP image.");
      if (file.size > 3 * 1024 * 1024) throw new Error("Image must be 3 MB or smaller.");
      const body = new FormData();
      body.append("photo", file);
      const { data } = await api.post(`${base}/images`, body, {
        headers: { "Content-Type": undefined },
        timeout: 90000,
      });
      onChange([...images, data.image]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      input.value = "";
    }
  }
  function addUrl() {
    try {
      if (new URL(url).protocol !== "https:") throw new Error("Use an HTTPS image URL");
      onChange([...images, { url, alt: "" }]);
      setUrl("");
      setError(null);
    } catch (e) {
      setError(e);
    }
  }
  return (
    <div className="image-manager">
      <div className="section-title">
        <h3>Photo gallery</h3>
        <label className="btn btn-secondary upload-label">
          <ImagePlus size={16} />
          {busy ? "Uploading..." : "Upload image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={upload}
            disabled={busy || images.length >= 30}
          />
        </label>
      </div>
      <p className="muted small">
        JPG, PNG or WebP · up to 3 MB. Save the form after adding photos to keep your gallery
        changes.
      </p>
      <ErrorNotice error={error} />
      <div className="image-grid">
        {images.map((img, i) => (
          <div className="image-edit" key={`${img.url}-${i}`}>
            <img src={img.url} alt={img.alt || "Venue gallery"} loading="lazy" />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, n) => n !== i))}
              aria-label={`Remove image ${i + 1}`}
            >
              <X size={14} />
            </button>
            <input
              aria-label={`Description for image ${i + 1}`}
              placeholder="Image description"
              value={img.alt}
              maxLength={200}
              onChange={(e) =>
                onChange(images.map((v, n) => (n === i ? { ...v, alt: e.target.value } : v)))
              }
            />
          </div>
        ))}
      </div>
      <div className="inline-fields">
        <Field
          label="Or use an HTTPS image URL"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={addUrl}
          disabled={!url || images.length >= 30}
        >
          Add image <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  );
}
