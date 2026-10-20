import { useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import api from "../services/api";
import { suggestSlug, validateSlug } from "../../../shared/slug.js";
import {
  Brand,
  PageHeading,
  Field,
  SelectField,
  TextArea,
  Button,
  Notice,
  ErrorNotice,
} from "../components/ui";
const defaults = {
  name: "",
  slug: "",
  description: "",
  type: "banquet",
  timezone: "Asia/Kolkata",
  address: { line1: "", city: "", state: "", postalCode: "" },
  contact: { phone: "", whatsapp: "", email: "" },
  mapsUrl: "",
  openingHours: "",
  facilities: [],
  parking: "",
  catering: "",
  decoration: "",
  policies: "",
};
export default function VenueProfilePage({ create = false }) {
  const context = useOutletContext();
  if (!create && context?.owner === false)
    return <Notice>Only the venue owner can update the venue details.</Notice>;
  return <ProfileForm key={context?.venue?._id || "new"} create={create} context={context} />;
}
function ProfileForm({ create, context }) {
  const navigate = useNavigate(),
    [form, setForm] = useState(() => ({
      ...defaults,
      ...Object.fromEntries(
        Object.keys(defaults).map((k) => [k, context?.venue?.[k] ?? defaults[k]]),
      ),
    })),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [message, setMessage] = useState(""),
    [slugEdited, setSlugEdited] = useState(false),
    [slugState, setSlugState] = useState("");
  const field = (key, group) => ({
    value: group ? form[group][key] || "" : form[key] || "",
    onChange: (e) =>
      setForm((prev) =>
        group
          ? { ...prev, [group]: { ...prev[group], [key]: e.target.value } }
          : {
              ...prev,
              [key]: e.target.value,
              ...(key === "name" && !slugEdited && create
                ? { slug: suggestSlug(e.target.value) }
                : {}),
            },
      ),
  });
  async function checkSlug() {
    if (!validateSlug(form.slug).valid) {
      setSlugState("Enter a valid non-reserved URL");
      return;
    }
    try {
      const { data } = await api.get("/venues/slug-availability", { params: { slug: form.slug } });
      setSlugState(data.available ? "This address is available" : "This address is unavailable");
    } catch {
      setSlugState("Could not verify availability. Please try again.");
    }
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const update = { ...form, facilities: form.facilities.filter(Boolean) };
      delete update.slug;
      if (create) {
        const { data } = await api.post("/venues", {
          ...form,
          facilities: form.facilities.filter(Boolean),
        });
        navigate(`/venues/${data.venue._id}/halls`);
      } else {
        await api.patch(
          context.hall ? `${context.base}/venue-profile` : context.venueBase || context.base,
          update,
        );
        setMessage("Venue profile saved.");
        context.reloadVenue();
        if (context.onboarding) navigate(`${context.venueBase}/halls`);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const content = (
    <>
      <PageHeading
        eyebrow={create ? "YOUR NEXT CHAPTER" : "THE DETAILS MAKE THE DIFFERENCE"}
        title={create ? "Introduce your space." : "Venue profile."}
      >
        Tell the story behind your venue. You can refine the details as you go.
      </PageHeading>
      <ErrorNotice error={error} />
      <Notice type="success">{message}</Notice>
      <form onSubmit={submit} className="form-stack">
        <section className="panel">
          <div className="section-title">
            <h2>The introduction</h2>
            <span className="step-number">01</span>
          </div>
          <div className="form-grid">
            <Field label="Venue name" required minLength={2} maxLength={150} {...field("name")} />
            <SelectField label="Venue type" {...field("type")}>
              {[
                ["banquet", "Banquet hall"],
                ["marriage_hall", "Marriage hall"],
                ["party_hall", "Party hall"],
                ["resort", "Resort"],
                ["hotel", "Hotel"],
                ["conference", "Conference space"],
                ["other", "Other event venue"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>
          {create && (
            <div className="inline-fields">
              <Field
                label="Your unique website address"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                minLength={3}
                maxLength={63}
                value={form.slug}
                hint={
                  slugState ||
                  "Lowercase letters, numbers and hyphens. The address stays fixed after creation."
                }
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlugState("");
                  setForm({ ...form, slug: e.target.value.toLowerCase() });
                }}
              />
              <Button type="button" variant="secondary" onClick={checkSlug}>
                Check availability
              </Button>
            </div>
          )}
          <TextArea
            label="About your venue"
            maxLength={5000}
            placeholder="What makes your space special?"
            {...field("description")}
          />
          <Field
            label="Time zone"
            required
            hint="Use an IANA zone, for example Asia/Kolkata. Fixed after the first enquiry."
            {...field("timezone")}
          />
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>A place on the map</h2>
            <span className="step-number">02</span>
          </div>
          <Field label="Street address" maxLength={200} {...field("line1", "address")} />
          <div className="form-grid">
            <Field label="City" required maxLength={100} {...field("city", "address")} />
            <Field label="State" required maxLength={100} {...field("state", "address")} />
            <Field label="PIN / postal code" maxLength={20} {...field("postalCode", "address")} />
            <Field
              label="Google Maps link"
              type="url"
              placeholder="https://maps.google.com/…"
              {...field("mapsUrl")}
            />
          </div>
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>Keep the conversation going</h2>
            <span className="step-number">03</span>
          </div>
          <div className="form-grid">
            <Field label="Business phone" type="tel" required {...field("phone", "contact")} />
            <Field label="WhatsApp number" type="tel" {...field("whatsapp", "contact")} />
            <Field label="Business email" type="email" {...field("email", "contact")} />
            <Field
              label="Opening hours"
              placeholder="By appointment, 9 am – 8 pm"
              {...field("openingHours")}
            />
          </div>
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>The thoughtful extras</h2>
            <span className="step-number">04</span>
          </div>
          <Field
            label="Facilities (separate with commas)"
            value={form.facilities.join(", ")}
            onChange={(e) =>
              setForm({ ...form, facilities: e.target.value.split(",").map((v) => v.trim()) })
            }
          />
          <div className="form-grid">
            <Field label="Parking" {...field("parking")} />
            <Field label="Catering arrangements" {...field("catering")} />
            <Field label="Decoration options" {...field("decoration")} />
          </div>
          <TextArea
            label="Terms, cancellation and venue policies"
            maxLength={5000}
            {...field("policies")}
          />
        </section>
        <div className="form-footer">
          <p className="muted">
            {create
              ? "Your venue starts as a private draft."
              : "Changes will appear on your published website."}
          </p>
          <Button type="submit" busy={busy}>
            {create
              ? "Create venue & add halls"
              : context?.onboarding
                ? "Save & choose hall"
                : "Save profile"}
            {create ? <ArrowRight size={17} /> : <Save size={17} />}
          </Button>
        </div>
      </form>
    </>
  );
  return create ? (
    <div className="create-page">
      <header className="workspace-header">
        <Brand />
        <Link className="text-link" to="/venues">
          <ArrowLeft size={16} />
          Your venues
        </Link>
      </header>
      <main className="create-main">{content}</main>
    </div>
  ) : (
    content
  );
}
