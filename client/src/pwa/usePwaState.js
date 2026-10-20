import { useSyncExternalStore } from "react";
import { getPwaState, subscribePwaState } from "./state";

export function usePwaState() {
  return useSyncExternalStore(subscribePwaState, getPwaState, getPwaState);
}
