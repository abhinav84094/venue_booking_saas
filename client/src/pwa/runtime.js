import { resourceCache } from "../services/resourceCache";
import { isOwnerAppLocation } from "./policy";
import { initializeInstallEvents } from "./install";
import { initializeUpdateEvents, registerOwnerServiceWorker } from "./register";
import { publishPwaState } from "./state";
import { initializeActivityTracking } from "./activity";

let initialized = false;

function connectionChanged() {
  const online = navigator.onLine !== false;
  publishPwaState({ online, ...(!online ? { reconnectRequired: true } : {}) });
  if (!online && isOwnerAppLocation(window.location)) resourceCache.clear({ notify: false });
}

export function syncOwnerPwaLocation() {
  const owner = isOwnerAppLocation(window.location);
  document.documentElement.toggleAttribute("data-owner-app", owner);
  document.querySelectorAll("[data-owner-pwa]").forEach((element) => element.remove());
  if (!owner) return;
  const tags = [
    ["link", { rel: "manifest", href: "/manifest.webmanifest" }],
    ["link", { rel: "apple-touch-icon", href: "/pwa-icons/apple-touch-icon.png" }],
    ["meta", { name: "theme-color", content: "#244638" }],
    ["meta", { name: "apple-mobile-web-app-capable", content: "yes" }],
    ["meta", { name: "apple-mobile-web-app-title", content: "Prakash Venue" }],
    ["meta", { name: "apple-mobile-web-app-status-bar-style", content: "default" }],
  ];
  for (const [name, attributes] of tags) {
    const element = document.createElement(name);
    element.setAttribute("data-owner-pwa", "");
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    document.head.append(element);
  }
  registerOwnerServiceWorker();
}

// Called before mounting React, so the install event cannot be missed while
// the authenticated account page and its route chunks are loading.
export function initializeOwnerPwa() {
  if (initialized) return;
  initialized = true;
  initializeActivityTracking();
  initializeInstallEvents();
  initializeUpdateEvents();
  connectionChanged();
  window.addEventListener("offline", connectionChanged);
  window.addEventListener("online", connectionChanged);
  syncOwnerPwaLocation();
}
