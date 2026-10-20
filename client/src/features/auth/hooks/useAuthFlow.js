import { useState } from "react";
import api from "../../../services/api";
export function useAuthFlow({ mode, location, navigate, login }) {
  const [form, setForm] = useState({
      name: "",
      email: location.state?.email || "",
      password: "",
      otp: "",
      newPassword: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [message, setMessage] = useState("");
  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });
  const goHome = () =>
    navigate(
      location.state?.from?.startsWith("/") && !location.state.from.startsWith("//")
        ? location.state.from
        : "/venues",
      { replace: true },
    );
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      if (mode === "login") {
        const user = await login(form);
        navigate(user.role === "platform_admin" ? "/admin" : "/venues", { replace: true });
      }
      if (mode === "register") {
        await api.post("/auth/register", {
          name: form.name,
          email: form.email,
          password: form.password,
        });
        navigate("/verify-email", { state: { email: form.email } });
      }
      if (mode === "verify") {
        await api.post("/auth/verify-email", { email: form.email, otp: form.otp });
        navigate("/login", { state: { email: form.email, verified: true } });
      }
      if (mode === "forgot") {
        const { data } = await api.post("/auth/forgot-password", { email: form.email });
        setMessage(data.message);
      }
      if (mode === "reset") {
        const { data } = await api.post("/auth/reset-password", {
          email: form.email,
          otp: form.otp,
          newPassword: form.newPassword,
        });
        setMessage(data.message);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post("/auth/resend-verification-otp", { email: form.email });
      setMessage(data.message);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return { form, field, busy, error, message, submit, resend, goHome };
}
