import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { Button, Field, ErrorNotice, Loading } from "./ui";

export default function GooglePasswordSetup({ onComplete }) {
  const [setup, setSetup] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    let active = true;
    api
      .get("/auth/google/password-setup")
      .then(({ data }) => {
        if (active) setSetup(data);
      })
      .catch((failure) => {
        if (active) setError(failure);
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    if (new Date(setup.expiresAt).getTime() <= Date.now()) {
      setSetup(null);
      setError(new Error("Google authorization expired. Please sign in with Google again."));
      return;
    }
    if (setup.purpose !== "link" && new TextEncoder().encode(password).length > 72) {
      setError(new Error("Password must fit within 72 UTF-8 bytes."));
      return;
    }
    if (setup.purpose !== "link" && password !== confirmPassword) {
      setError(new Error("Passwords do not match."));
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post(
        setup.purpose === "link" ? "/auth/google/link" : "/auth/google/password-setup",
        setup.purpose === "link" ? { password } : { password, confirmPassword },
      );
      await onComplete(data, setup.purpose);
    } catch (failure) {
      setError(failure);
      if ([401, 409].includes(failure.response?.status)) setSetup(null);
    } finally {
      setPassword("");
      setConfirmPassword("");
      setLoading(false);
    }
  }
  if (!setup)
    return (
      <>
        <ErrorNotice error={error} />
        {error ? (
          <Link className="text-link" to="/login">
            Sign in with Google again
          </Link>
        ) : (
          <Loading text="Checking Google authorization..." />
        )}
      </>
    );
  const linking = setup.purpose === "link";
  return (
    <form onSubmit={submit} className="form-stack">
      <p>
        Google verified: <strong>{setup.email}</strong>
      </p>
      <p>
        {linking
          ? "An account already exists. Confirm your existing application password to securely link Google. If you no longer know it, contact support for manual ownership review."
          : setup.purpose === "recover"
            ? "Choose a new password. You will be signed out on all devices."
            : "Create a password to finish registration. You can then sign in with Google or your password."}
      </p>
      <Field
        label={linking ? "Existing application password" : "New password"}
        type={showPassword ? "text" : "password"}
        required
        minLength={linking ? 1 : 8}
        maxLength={72}
        autoComplete={linking ? "current-password" : "new-password"}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {!linking && (
        <Field
          label="Confirm password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      )}
      <label>
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(event) => setShowPassword(event.target.checked)}
        />{" "}
        Show password
      </label>
      <ErrorNotice error={error} />
      <Button type="submit" busy={loading}>
        {linking
          ? "Link Google and sign in"
          : setup.purpose === "recover"
            ? "Reset password"
            : "Complete registration"}
      </Button>
    </form>
  );
}
