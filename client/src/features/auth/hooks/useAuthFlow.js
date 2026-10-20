import { useState } from "react";
export function useAuthFlow({ location, navigate, login }) {
  const [form, setForm] = useState({ email: location.state?.email || "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const field = (key) => ({
    value: form[key],
    onChange: (event) => setForm({ ...form, [key]: event.target.value }),
  });
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = await login(form);
      navigate(user.role === "platform_admin" ? "/admin" : "/venues", { replace: true });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return { field, busy, error, submit };
}
