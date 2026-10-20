import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getVenueSlugFromHostname } from "../utils/venueDomain";
import { setPublicAppearanceHint } from "./themeStore";

export default function RouteAppearance() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!getVenueSlugFromHostname() && !/^\/v\/[^/]+\/?$/.test(pathname))
      setPublicAppearanceHint(null);
  }, [pathname]);
  return null;
}
