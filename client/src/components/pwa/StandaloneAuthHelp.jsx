import { usePwaState } from "../../pwa/usePwaState";

export default function StandaloneAuthHelp({ mode }) {
  const { standalone } = usePwaState();
  if (!standalone) return null;
  return (
    <details className="pwa-auth-help">
      <summary>Having trouble with Google sign-in in the app?</summary>
      <p>
        If Google cannot open its secure sign-in window here, open {window.location.origin}/login in
        Safari, Chrome or your default browser and complete sign-in there. Your browser and
        installed app may use separate sessions.
      </p>
      <p>
        {mode === "login"
          ? "You can also sign in here with your existing application email and password."
          : "Complete Google verification and password setup in the browser, then sign in to the app with your application email and password."}
      </p>
    </details>
  );
}
