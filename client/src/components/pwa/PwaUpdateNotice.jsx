import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "../ui";
import { hasBusyControl } from "../../pwa/state";
import { requestAppUpdate } from "../../pwa/register";
import { usePwaState } from "../../pwa/usePwaState";

export default function PwaUpdateNotice() {
  const { updateAvailable, updateApplying, updateError, assetError, online, activeMutations } =
    usePwaState();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(hasBusyControl);
  const blocked = busy || activeMutations > 0;
  useEffect(() => {
    const observer = new MutationObserver(() => setBusy(hasBusyControl()));
    observer.observe(document.body, { subtree: true, attributes: true, childList: true });
    return () => observer.disconnect();
  }, []);
  if (!updateAvailable || (dismissed && !assetError)) return null;
  return (
    <aside className="pwa-update-notice" aria-label="Application update">
      <div role="status">
        <strong>
          {assetError ? "A newer app version is available." : "Prakash Venue has an update."}
        </strong>
        <p>
          {blocked
            ? "Finish your current action before updating."
            : "Save your work, then refresh when you are ready."}
        </p>
        {updateError && <p>{updateError}</p>}
      </div>
      <Button
        data-pwa-control="true"
        variant="secondary"
        busy={updateApplying}
        disabled={blocked || !online}
        onClick={requestAppUpdate}
      >
        <RefreshCw size={16} aria-hidden="true" />
        Update and refresh
      </Button>
      {!assetError && (
        <button
          type="button"
          className="icon-btn"
          aria-label="Dismiss update notification"
          onClick={() => setDismissed(true)}
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </aside>
  );
}
