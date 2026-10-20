import { Link } from "react-router-dom";
import { Field, TextArea, SelectField, ImageManager } from "../ui";
import { SECTION_LABELS } from "./templateCatalog";

export function WebsiteDesignFields({ editor }) {
  const { website, setWebsite, description, setDescription } = editor;
  const set = (key, value) => setWebsite({ ...website, [key]: value });
  return (
    <section className="panel">
      <div className="section-title">
        <h2>A memorable welcome</h2>
        <span className="eyebrow">CONTENT & APPEARANCE</span>
      </div>
      <Field
        label="Headline"
        maxLength={200}
        placeholder="A beautiful beginning for your next chapter."
        value={website.headline}
        onChange={(event) => set("headline", event.target.value)}
      />
      <TextArea
        label="Supporting line"
        maxLength={500}
        placeholder="Introduce the atmosphere and experience of your venue."
        value={website.tagline}
        onChange={(event) => set("tagline", event.target.value)}
      />
      <TextArea
        label="Venue description"
        maxLength={5000}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <div className="form-grid">
        <Field
          label="Signature accent color"
          type="color"
          value={website.accent}
          onChange={(event) => set("accent", event.target.value)}
        />
        <SelectField
          label="Public website appearance"
          value={website.appearance}
          onChange={(event) => set("appearance", event.target.value)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </SelectField>
      </div>
      <p className="muted small">
        This appearance belongs to your public website. Your dashboard appearance is separate.
        System follows each visitor's device.
      </p>
      <fieldset>
        <legend>Visible website sections</legend>
        <div className="template-section-toggles">
          {Object.entries(SECTION_LABELS).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={website.sections[key]}
                onChange={(event) =>
                  set("sections", { ...website.sections, [key]: event.target.checked })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

export function WebsiteContactFields({ editor, base }) {
  const { contact, setContact } = editor;
  return (
    <section className="panel">
      <div className="section-title">
        <h2>Contact your venue</h2>
      </div>
      <p className="muted small">These are the same business details used in your venue profile.</p>
      <div className="form-grid">
        {[
          ["phone", "Business phone", "tel"],
          ["whatsapp", "WhatsApp number", "tel"],
          ["email", "Business email", "email"],
        ].map(([key, label, type]) => (
          <Field
            key={key}
            label={label}
            type={type}
            value={contact[key]}
            onChange={(event) => setContact({ ...contact, [key]: event.target.value })}
          />
        ))}
      </div>
      <div className="inline-links">
        <Link className="text-link" to={`${base}/profile`}>
          Edit location, facilities & policies
        </Link>
        <Link className="text-link" to={`${base}/halls`}>
          Manage hall listings
        </Link>
      </div>
    </section>
  );
}

export function WebsiteMediaFields({ editor, base }) {
  const { images, setImages, cover, setCover } = editor;
  return (
    <section className="panel">
      <div className="section-title">
        <h2>Your venue in photographs</h2>
      </div>
      <Field
        label="Cover photograph (HTTPS URL)"
        type="url"
        value={cover}
        onChange={(event) => setCover(event.target.value)}
      />
      <p className="muted small">
        Upload a photo to your gallery, then choose it as the cover. Your preview updates before
        saving.
      </p>
      {cover && <img className="cover-preview" src={cover} alt="Website cover preview" />}
      <ImageManager base={base} images={images} onChange={setImages} />
      {images.length > 0 && (
        <div className="cover-chooser">
          <p className="muted small">Choose a gallery photo as your cover:</p>
          {images.map((image, index) => (
            <button
              type="button"
              key={`${image.url}-${index}`}
              className={image.url === cover ? "selected" : ""}
              onClick={() => setCover(image.url)}
              aria-label={`Use image ${index + 1} as cover`}
              aria-pressed={image.url === cover}
            >
              <img src={image.url} alt={image.alt || `Gallery image ${index + 1}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
