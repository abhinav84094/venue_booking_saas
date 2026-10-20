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
  register: [
    "Make room for more.",
    "Verify your Google account, then create an application password.",
  ],
  forgot: [
    "A fresh start.",
    "Use the Google account linked to your account to reset your password.",
  ],
  google: ["Your space, secured.", "Complete your verified Google account setup."],
};
export default function AuthPage({ mode = "login" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, setAuthenticatedUser, refreshUser } = useAuth();
  const { field, busy, error, submit } = useAuthFlow({ location, navigate, login });
  const signedIn = (user, destination) => {
    setAuthenticatedUser(user);
    navigate(user.role === "platform_admin" ? "/admin" : destination || "/venues", {
      replace: true,
    });
  };
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
          <ErrorNotice error={error} />
          <Notice type="success">{location.state?.message}</Notice>
          {mode === "google" ? (
            <GooglePasswordSetup
              onComplete={async (data, purpose) => {
                if (purpose === "recover") {
                  await refreshUser();
                  navigate("/login", { replace: true, state: { message: data.message } });
                } else {
                  signedIn(data.user, purpose === "register" ? "/venues/new" : "/venues");
                }
              }}
            />
          ) : (
            <>
              {mode === "login" && (
                <form onSubmit={submit} className="form-stack">
                  <Field
                    label="Email address"
                    type="email"
                    autoComplete="email"
                    required
                    {...field("email")}
                  />
                  <Field
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={72}
                    {...field("password")}
                  />
                  <Link className="text-link auth-forgot" to="/forgot-password">
                    Forgot password?
                  </Link>
                  <Button busy={busy} className="full" type="submit">
                    Sign in <ArrowRight size={17} />
                  </Button>
                </form>
              )}
              {mode === "login" && (
                <div className="divider">
                  <span>or continue with</span>
                </div>
              )}
              <GoogleAuthButton
                purpose={mode === "forgot" ? "recover" : mode}
                onLogin={(user) => signedIn(user)}
                onPasswordRequired={() => navigate("/google/set-password")}
              />
              {mode === "forgot" && (
                <p className="muted">
                  If your legacy account is not linked, sign in with your existing password and
                  Google to link it. If you no longer know the password, contact support for manual
                  ownership review.
                </p>
              )}
            </>
          )}
          <p className="auth-switch">
            {mode === "login" ? (
              <>
                New to Prakash SaaS? <Link to="/register">Create an account</Link>
              </>
            ) : mode === "register" ? (
              <>
                Already have an account? <Link to="/login">Sign in</Link>
              </>
            ) : (
              <Link to="/login">Back to sign in</Link>
            )}
          </p>
        </div>
        <p className="auth-bottom">Your next chapter deserves a beautiful space.</p>
      </main>
    </div>
  );
}
