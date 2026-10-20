import { Suspense } from "react";
import { Loading } from "../ui";
import { getVenueTemplate } from "./templateRegistry";
import "./templates.css";

export default function TemplateRenderer({ templateId, ...props }) {
  const { config, Component } = getVenueTemplate(templateId);
  return (
    <div className={`venue-template public-${config.id}`} data-template-id={config.id}>
      <Suspense fallback={<Loading text="Preparing your venue website..." />}>
        <Component {...props} />
      </Suspense>
    </div>
  );
}
