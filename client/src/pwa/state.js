const listeners = new Set();
let state = {
  standalone: false,
  canInstall: false,
  iosSafari: false,
  installing: false,
  online: true,
  reconnectRequired: false,
  updateAvailable: false,
  updateApplying: false,
  assetError: false,
  updateError: "",
  activeMutations: 0,
};

export function publishPwaState(change) {
  state = { ...state, ...change };
  listeners.forEach((listener) => listener());
}

export const getPwaState = () => state;
export function subscribePwaState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isStandalone() {
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    window.navigator.standalone,
  );
}

export function isIosSafari() {
  const { userAgent, platform, maxTouchPoints } = window.navigator;
  const ios = /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  return ios && /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
}

// Payment checkout retains its busy Button while the provider modal is open.
// Check immediately before activation as well as before the eventual reload.
export function hasBusyControl() {
  return Boolean(document.querySelector('[aria-busy="true"]:not([data-pwa-control])'));
}

export function isWorkflowBusy() {
  return state.activeMutations > 0 || hasBusyControl();
}
