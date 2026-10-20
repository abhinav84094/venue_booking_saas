import { isOwnerAppLocation } from "./policy";
import { getPwaState, isIosSafari, isStandalone, publishPwaState } from "./state";

let installPrompt;
let initialized = false;

export function initializeInstallEvents() {
  if (initialized) return;
  initialized = true;
  publishPwaState({ standalone: isStandalone(), iosSafari: isIosSafari() });
  window.addEventListener("beforeinstallprompt", (event) => {
    if (!isOwnerAppLocation(window.location) || isStandalone()) return;
    event.preventDefault();
    installPrompt = event;
    publishPwaState({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    publishPwaState({ standalone: true, canInstall: false, installing: false });
  });
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", () => {
    publishPwaState({ standalone: isStandalone() });
  });
}

// Native installation can only be requested by the Install App click handler.
export async function requestInstallation() {
  if (!installPrompt || getPwaState().installing || !isOwnerAppLocation(window.location)) return;
  const prompt = installPrompt;
  installPrompt = null;
  publishPwaState({ canInstall: false, installing: true });
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice?.outcome === "accepted") publishPwaState({ standalone: true });
  } catch {
    // A dismissed/unsupported native prompt stays quiet until a new browser event.
  } finally {
    publishPwaState({ installing: false });
  }
}
