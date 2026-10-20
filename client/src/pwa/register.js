import { isOwnerAppLocation } from "./policy";
import { getPwaState, isWorkflowBusy, publishPwaState } from "./state";

let registration;
let registering;
let updateRequested = false;
let controllerChanged = false;
let initialized = false;

function watchRegistration(next) {
  registration = next;
  if (next.waiting) publishPwaState({ updateAvailable: true });
  next.addEventListener("updatefound", () => {
    const worker = next.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller)
        publishPwaState({ updateAvailable: true });
    });
  });
}

export function initializeUpdateEvents() {
  if (initialized) return;
  initialized = true;
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (!updateRequested) return;
    controllerChanged = true;
    updateRequested = false;
    if (isOwnerAppLocation(window.location) && !isWorkflowBusy()) window.location.reload();
    else
      publishPwaState({
        updateApplying: false,
        updateAvailable: true,
        updateError: "Finish your current action, then refresh to use the update.",
      });
  });
  window.addEventListener("vite:preloadError", (event) => {
    if (!isOwnerAppLocation(window.location)) return;
    event.preventDefault();
    publishPwaState({ assetError: true, updateAvailable: true });
    registration?.update().catch(() => {});
  });
  window.addEventListener("focus", () => {
    if (isOwnerAppLocation(window.location) && navigator.onLine !== false)
      registration?.update().catch(() => {});
  });
}

export function registerOwnerServiceWorker() {
  if (
    !import.meta.env.PROD ||
    !("serviceWorker" in navigator) ||
    !isOwnerAppLocation(window.location)
  )
    return;
  if (registering) return registering;
  registering = navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then(watchRegistration)
    .catch(() => {
      // Browser-mode use remains available if installation is unsupported.
      registering = null;
    });
  return registering;
}

export async function requestAppUpdate() {
  if (!isOwnerAppLocation(window.location) || isWorkflowBusy() || navigator.onLine === false)
    return;
  const state = getPwaState();
  if (state.updateApplying) return;
  if (controllerChanged || (!registration?.waiting && state.assetError)) {
    window.location.reload();
    return;
  }
  if (!registration?.waiting) {
    await registration?.update().catch(() => {});
    if (!registration?.waiting) {
      publishPwaState({ updateError: "The update is downloading. Try again in a moment." });
      return;
    }
  }
  // Recheck after asynchronous work: a checkout may have started meanwhile.
  if (isWorkflowBusy() || !isOwnerAppLocation(window.location)) return;
  updateRequested = true;
  publishPwaState({ updateApplying: true, updateError: "" });
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  window.setTimeout(() => {
    if (!updateRequested) return;
    updateRequested = false;
    publishPwaState({
      updateApplying: false,
      updateError: "The update is taking longer than expected. You can try again.",
    });
  }, 15000);
}
