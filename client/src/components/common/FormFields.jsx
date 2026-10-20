import { useId } from "react";

export function Field({ label, hint, error, children, ...props }) {
  const id = useId(),
    hintId = `${id}-hint`,
    errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children || (
        <input
          id={id}
          aria-describedby={
            [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined
          }
          aria-invalid={error ? true : undefined}
          {...props}
        />
      )}
      {hint && <small id={hintId}>{hint}</small>}
      {error && (
        <small id={errorId} className="error-text">
          {error}
        </small>
      )}
    </div>
  );
}

export function SelectField({ label, children, ...props }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} {...props}>
        {children}
      </select>
    </div>
  );
}

export function TextArea({ label, ...props }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={4} {...props} />
    </div>
  );
}
