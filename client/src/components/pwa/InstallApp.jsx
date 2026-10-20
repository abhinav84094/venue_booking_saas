import { useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Button } from "../ui";
import { isOwnerAppLocation } from "../../pwa/policy";
import { requestInstallation } from "../../pwa/install";
import { usePwaState } from "../../pwa/usePwaState";

export default function InstallApp() {
  const { standalone, canInstall, iosSafari, installing } = usePwaState();
  const [showHelp, setShowHelp] = useState(false);
  if (!isOwnerAppLocation(window.location) || standalone || (!canInstall && !iosSafari))
    return null;
  return (
    <section className="panel pwa-install" aria-label="Install Prakash Venue">
      <div>
        <h2>Prakash Venue, close at hand.</h2>
        <p className="muted">Open your venue workspace from your home screen or desktop.</p>
      </div>
      {canInstall ? (
        <Button variant="secondary" busy={installing} onClick={requestInstallation}>
          <Download size={17} aria-hidden="true" />
          Install App
        </Button>
      ) : (
        <Button
          variant="secondary"
          aria-expanded={showHelp}
          aria-controls="pwa-ios-instructions"
          onClick={() => setShowHelp((value) => !value)}
        >
          <Share2 size={17} aria-hidden="true" />
          How to install
        </Button>
      )}
      {showHelp && iosSafari && (
        <p id="pwa-ios-instructions" className="pwa-install-help">
          Tap Share in Safari, then Add to Home Screen. If offered, keep Open as Web App enabled,
          then tap Add. This menu is managed by Safari.
        </p>
      )}
    </section>
  );
}
