import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./venue.css";
import "./theme/theme.css";
import "./styles/pwa.css";
import App from "./App.jsx";
import "./theme/themeStore.js";
import ThemeToggle from "./components/ThemeToggle.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { initializeOwnerPwa } from "./pwa/runtime";

initializeOwnerPwa();

const Application = (
  <AuthProvider>
    <App />
    <ThemeToggle />
  </AuthProvider>
);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {import.meta.env.VITE_VENUE_GOOGLE_CLIENT_ID ? (
      <GoogleOAuthProvider clientId={import.meta.env.VITE_VENUE_GOOGLE_CLIENT_ID}>
        {Application}
      </GoogleOAuthProvider>
    ) : (
      Application
    )}
  </StrictMode>,
);
