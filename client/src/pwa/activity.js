import api from "../services/api";
import { isOwnerAppLocation } from "./policy";
import { getPwaState, publishPwaState } from "./state";

let initialized = false;
const pending = new WeakSet();

function finished(config) {
  if (!config || !pending.has(config)) return;
  pending.delete(config);
  publishPwaState({ activeMutations: Math.max(0, getPwaState().activeMutations - 1) });
}

// Covers login/logout and other mutations with no persistent busy control.
// This observes request lifetime; it does not change payloads or responses.
export function initializeActivityTracking() {
  if (initialized) return;
  initialized = true;
  api.interceptors.request.use((config) => {
    if (
      !/^(get|head|options)$/i.test(config.method || "get") &&
      isOwnerAppLocation(window.location)
    ) {
      pending.add(config);
      publishPwaState({ activeMutations: getPwaState().activeMutations + 1 });
    }
    return config;
  });
  api.interceptors.response.use(
    (response) => {
      finished(response.config);
      return response;
    },
    (error) => {
      finished(error.config);
      return Promise.reject(error);
    },
  );
}
