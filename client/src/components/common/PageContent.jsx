import { ArrowUpRight } from "lucide-react";

export function PageHeading({ eyebrow, title, children, action }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children && <p className="muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children }) {
  return (
    <span className={`badge badge-${String(children).toLowerCase()}`}>
      {String(children).replaceAll("_", " ")}
    </span>
  );
}

export function ExternalLink({ href, children }) {
  return (
    <a className="text-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={15} />
    </a>
  );
}
