import { LoaderCircle } from "lucide-react";

export function Button({
  children,
  variant = "primary",
  className = "",
  busy = false,
  disabled = false,
  type = "button",
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      className={`btn btn-${variant} ${className}`}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
    >
      {busy ? <LoaderCircle size={17} className="spin" /> : null}
      {children}
    </button>
  );
}
