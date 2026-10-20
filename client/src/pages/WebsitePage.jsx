import { useOutletContext } from "react-router-dom";
import { Globe2, Save, ArrowUpRight, Eye } from "lucide-react";
import { getVenuePublicUrl } from "../utils/venueDomain";
import { useResource } from "../hooks/useResource";
import { useWebsiteEditor } from "../features/public-venue/hooks/useWebsiteEditor";
import { PageHeading, Button, ErrorNotice, Notice, Badge } from "../components/ui";
import TemplateSelector from "../components/venue/TemplateSelector";
import WebsitePreview from "../components/venue/WebsitePreview";
import {
  WebsiteDesignFields,
  WebsiteContactFields,
  WebsiteMediaFields,
} from "../components/venue/WebsiteFields";
import { getVenueTemplate } from "../components/venue/templateRegistry";

export default function WebsitePage() {
  const context = useOutletContext();
  const { venue, base, venueBase } = context;
  const editor = useWebsiteEditor(context);
  const resource = useResource(`${venueBase}/halls`);
  const halls = (resource.data?.halls || [])
    .filter((hall) => hall.active !== false && hall.published && Array.isArray(hall.pricing))
    .map((hall) => ({
      ...hall,
      enquiriesEnabled:
        hall.subscription?.dashboardAccess === true &&
        hall.subscription?.planSnapshot?.features?.enquiries === true,
    }));
  const { website, setWebsite, busy, error, message, save, publish, previewVenue } = editor;
  const { config } = getVenueTemplate(website.template);
  return (
    <>
      <PageHeading
        eyebrow="A FIRST IMPRESSION THAT FEELS LIKE YOU"
        title="Your venue. Your story."
        action={
          <a
            className="btn btn-secondary"
            href={getVenuePublicUrl(venue.slug)}
            target="_blank"
            rel="noreferrer"
          >
            Visit website
            <ArrowUpRight size={16} />
          </a>
        }
      >
        Choose a design, make it yours and preview every change with your real venue data.
      </PageHeading>
      <ErrorNotice error={error} />
      <Notice type="success">{message}</Notice>
      {website.template !== config.id && (
        <Notice type="info">
          Your saved design is no longer available. Classic is shown safely; choose and save an
          available design when you are ready.
        </Notice>
      )}
      <div className="publication-panel">
        <span className="publication-icon">
          <Globe2 size={25} />
        </span>
        <div>
          <h3>{venue.slug}</h3>
          <p>
            {venue.published
              ? "Your website is published. Preview edits below; saving updates your live website."
              : "Your website is a private draft. Preview it below, then publish when your venue details and hall are ready."}
          </p>
        </div>
        <Badge>{venue.published ? "published" : "draft"}</Badge>
        <Button variant={venue.published ? "secondary" : "primary"} busy={busy} onClick={publish}>
          {venue.published ? "Unpublish website" : "Save & publish website"}
        </Button>
      </div>
      <form onSubmit={save} className="form-stack">
        <TemplateSelector
          value={config.id}
          onChange={(template) => setWebsite({ ...website, template })}
        />
        <WebsiteDesignFields editor={editor} />
        <WebsiteMediaFields editor={editor} base={base} />
        <WebsiteContactFields editor={editor} base={base} />
        <div className="form-footer">
          <p className="muted">
            Your venue profile and hall listings stay in sync across every design.
          </p>
          <div className="inline-links">
            <a className="btn btn-secondary" href="#website-preview">
              <Eye size={16} />
              Preview changes
            </a>
            <Button type="submit" busy={busy}>
              <Save size={16} />
              Save website
            </Button>
          </div>
        </div>
      </form>
      <WebsitePreview
        venue={previewVenue}
        halls={halls}
        loading={resource.loading}
        error={resource.error}
      />
    </>
  );
}
