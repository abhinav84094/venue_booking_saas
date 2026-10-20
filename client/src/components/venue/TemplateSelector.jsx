import { Check, Moon } from "lucide-react";
import { availableTemplates } from "./templateRegistry";

export default function TemplateSelector({ value, onChange }) {
  return (
    <section className="panel" aria-labelledby="template-selection-title">
      <div className="section-title">
        <h2 id="template-selection-title">Choose your website design</h2>
        <span className="eyebrow">YOUR STYLE, YOUR VENUE</span>
      </div>
      <p className="muted">
        Every design uses your venue's details, halls and photographs. Select a design to preview it
        below.
      </p>
      <div
        className="template-picker"
        role="group"
        aria-label="Website templates"
        data-testid="template-selector"
      >
        {availableTemplates.map((template) => (
          <button
            type="button"
            key={template.id}
            className="template-option"
            aria-label={`Select ${template.name} template`}
            aria-pressed={template.id === value}
            onClick={() => onChange(template.id)}
          >
            <span className="template-category">
              {template.category}
              {template.id === value && <Check size={18} aria-label="Selected" />}
            </span>
            <strong>{template.name}</strong>
            <span>{template.description}</span>
            {template.supportsDarkMode && (
              <span>
                <Moon size={13} aria-hidden="true" /> Light and dark appearance
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
