import axios from "axios";
import { resourceCache } from "./resourceCache";

const api = axios.create({
  baseURL: import.meta.env.VITE_VENUE_API_URL || "/api",
  withCredentials: true,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "venue-dashboard",
  },
});

api.interceptors.response.use(
  (response) => {
    if (response.config.method !== "get") resourceCache.clear();
    return response;
  },
  (error) => {
    if ([401, 402, 403].includes(error.response?.status)) resourceCache.clear({ notify: false });
    if (error.response?.status === 402 && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("venue:subscription-required", {
          detail: { url: error.config?.url || "" },
        }),
      );
    }
    return Promise.reject(error);
  },
);

export default api;
