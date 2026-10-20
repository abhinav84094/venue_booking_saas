import { useEffect, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import api from "../services/api";
import { useTheme } from "../theme/useTheme";

export default function GoogleAuthButton({ purpose = "login", onLogin, onPasswordRequired }) {
  const containerRef = useRef(null);
  const challengeRequest = useRef(null);
  const [buttonWidth, setButtonWidth] = useState(240);
  const [nonce, setNonce] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const theme = useTheme();
  const configured = Boolean(import.meta.env.VITE_VENUE_GOOGLE_CLIENT_ID);
  useEffect(() => {
    if (!configured) return;
    let active = true;
    // Share the request across StrictMode effect replays so the cookie and
    // nonce always describe the same server challenge.
    if (!challengeRequest.current)
      challengeRequest.current = api.post("/auth/google/challenge", { purpose });
    challengeRequest.current
      .then(({ data }) => {
        if (active) setNonce(data.nonce);
      })
      .catch((failure) => {
        if (active)
          setError(failure.response?.data?.message || "Unable to prepare Google sign-in.");
      });
    return () => {
      active = false;
    };
  }, [configured, purpose, attempt]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0].contentRect.width);
      if (width > 0) setButtonWidth(Math.min(320, width));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const retry = () => {
    challengeRequest.current = null;
    setNonce(null);
    setError("");
    setAttempt((value) => value + 1);
  };
  const handleGoogleSuccess = async (response) => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      // The credential exists only in this POST body, never in navigation state,
      // browser storage or a URL. Setup authority travels in an HttpOnly cookie.
      const { data } = await api.post("/auth/google", { credential: response?.credential });
      if (data.requiresPassword || data.requiresLink) await onPasswordRequired();
      else if (data.success && data.user?.id) await onLogin(data.user);
      else throw new Error("Invalid authentication response.");
    } catch (failure) {
      setNonce(null);
      setError(
        failure.response?.data?.message || failure.message || "Unable to sign in with Google.",
      );
    } finally {
      setLoading(false);
    }
  };
  if (!configured)
    return <p role="status">Google sign-in is unavailable. Please contact support.</p>;
  return (
    <div className="w-full space-y-3">
      <div ref={containerRef} className="flex min-h-11 w-full min-w-0 items-center justify-center">
        {loading || (!nonce && !error) ? (
          <p role="status">Preparing Google sign-in...</p>
        ) : (
          nonce && (
            <GoogleLogin
              key={nonce}
              nonce={nonce}
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setNonce(null);
                setError("Google sign-in failed. Please try again.");
              }}
              text="continue_with"
              theme={theme === "dark" ? "filled_black" : "outline"}
              size="large"
              shape="rectangular"
              width={String(buttonWidth)}
            />
          )
        )}
      </div>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" className="text-link" onClick={retry}>
            Try Google again
          </button>
        </div>
      )}
    </div>
  );
}
