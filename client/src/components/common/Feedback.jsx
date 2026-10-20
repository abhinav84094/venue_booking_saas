import { Building2, LoaderCircle } from "lucide-react";

export function Notice({ children, type = "error" }) {
  return children ? (
    <div className={`notice notice-${type}`} role={type === "error" ? "alert" : "status"}>
      {children}
    </div>
  ) : null;
}

export function ErrorNotice({ error }) {
  if (!error) return null;
  const body = error.response?.data;
  return (
    <Notice>
      {body?.message || error.message || String(error)}
      {body?.errors?.length > 0 && (
        <ul>
          {body.errors.map((e, i) => (
            <li key={i}>
              {e.path}: {e.message}
            </li>
          ))}
        </ul>
      )}
    </Notice>
  );
}

export function Loading({ text = "Loading your workspace..." }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={25} />
      <span>{text}</span>
    </div>
  );
}

export function Empty({ icon: Icon = Building2, title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
