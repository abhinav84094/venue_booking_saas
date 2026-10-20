import AuthStory from "../features/auth/components/AuthStory";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, KeyRound } from "lucide-react";
import { useAuth } from "../context/authContext";
import { useAuthFlow } from "../features/auth/hooks/useAuthFlow";
import GoogleAuthButton from "../components/GoogleAuthButton";
import GooglePasswordSetup from "../components/GooglePasswordSetup";
import { Brand, Button, Field, ErrorNotice, Notice } from "../components/ui";

const copy = {
  login: ["Welcome back.", "Your next great event starts here."],
  register: ["Make room for more.", "Create your venue owner account."],
  verify: ["One final introduction.", "Enter the six-digit code sent to your email."],
  forgot: ["A fresh start.", "We’ll email you a password reset code."],
  reset: ["Your space, secured.", "Enter your code and choose a new password."],
  google: ["Almost at home.", "Choose a password to complete your Google registration."],
};
export default function AuthPage({ mode = "login" }) {
  const location = useLocation(),
    navigate = useNavigate(),
    { login, setAuthenticatedUser } = useAuth();
  const { form, field, busy, error, message, submit, resend, goHome } = useAuthFlow({
    mode,
    location,
    navigate,
    login,
  });
  return (
    <div className="auth-page">
      <AuthStory />
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <Link className="back-link" to="/">
          ← Back to Prakash SaaS
        </Link>
        <div className="auth-form-wrap">
          <span className="auth-symbol">
            <KeyRound size={22} />
          </span>
          <h1>{copy[mode][0]}</h1>
          <p className="muted">{copy[mode][1]}</p>
          {location.state?.verified && (
            <Notice type="success">Email verified. Your account is ready.</Notice>
          )}
          <ErrorNotice error={error} />
          <Notice type="success">{message}</Notice>
          {mode === "google" ? (
            <GooglePasswordSetup
              credential={location.state?.credential}
              email={location.state?.email}
              onComplete={(u) => {
                setAuthenticatedUser(u);
                goHome();
              }}
            />
          ) : (
            <form onSubmit={submit} className="form-stack">
              {mode === "register" && (
                <Field
                  label="Your name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  {...field("name")}
                />
              )}
              <Field
                label="Email address"
                type="email"
                autoComplete="email"
                required
                {...field("email")}
              />
              {["login", "register"].includes(mode) && (
                <Field
                  label="Password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  maxLength={72}
                  {...field("password")}
                />
              )}
              {["verify", "reset"].includes(mode) && (
                <Field
                  label="Six-digit email code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  {...field("otp")}
                />
              )}
              {mode === "reset" && (
                <Field
                  label="New password"
                  type="password"
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  required
                  {...field("newPassword")}
                />
              )}
              {mode === "login" && (
                <Link className="text-link auth-forgot" to="/forgot-password">
                  Forgot password?
                </Link>
              )}
              <Button busy={busy} className="full" type="submit">
                {
                  {
                    login: "Sign in",
                    register: "Create account",
                    verify: "Verify email",
                    forgot: "Send reset code",
                    reset: "Change password",
                  }[mode]
                }
                <ArrowRight size={17} />
              </Button>
              {mode === "verify" && (
                <Button type="button" variant="secondary" busy={busy} onClick={resend}>
                  Send a new code
                </Button>
              )}
            </form>
          )}
          {["login", "register"].includes(mode) && import.meta.env.VITE_VENUE_GOOGLE_CLIENT_ID && (
            <>
              <div className="divider">
                <span>or continue with</span>
              </div>
              <GoogleAuthButton
                onLogin={(u) => {
                  setAuthenticatedUser(u);
                  navigate(u.role === "platform_admin" ? "/admin" : "/venues", { replace: true });
                }}
                onPasswordRequired={(state) => navigate("/google/set-password", { state })}
              />
            </>
          )}
          <p className="auth-switch">
            {mode === "login" ? (
              <>
                New to Prakash SaaS? <Link to="/register">Create an account</Link>
                <br />
                <Link to="/verify-email">Verify your email</Link>
              </>
            ) : mode === "register" ? (
              <>
                Already have an account? <Link to="/login">Sign in</Link>
              </>
            ) : (
              <Link to="/login">Back to sign in</Link>
            )}
          </p>
          {mode === "forgot" && (
            <Link className="text-link" to="/reset-password" state={{ email: form.email }}>
              I have a reset code <ArrowRight size={15} />
            </Link>
          )}
        </div>
        <p className="auth-bottom">Your next chapter deserves a beautiful space.</p>
      </main>
    </div>
  );
}
