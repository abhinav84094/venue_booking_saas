import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { canCacheResource, resourceCache } from "../services/resourceCache";
export function useResource(url) {
  const [state, setState] = useState({ data: null, loading: true, error: null, url: null }),
    [version, setVersion] = useState(0);
  const reload = useCallback(() => {
    resourceCache.clear();
    setVersion((v) => v + 1);
  }, []);
  useEffect(() => {
    if (!url || !canCacheResource(url)) return;
    return resourceCache.subscribe(() => setVersion((v) => v + 1));
  }, [url]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (!url) return () => controller.abort();
    const cached = canCacheResource(url);
    const request = () => api.get(url, cached ? {} : { signal: controller.signal });
    (cached ? resourceCache.load(url, request) : request())
      .then(({ data }) => {
        if (active) setState({ data, loading: false, error: null, url });
      })
      .catch((error) => {
        if (active && error.code !== "ERR_CANCELED")
          setState({ data: null, loading: false, error, url });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [url, version]);
  return {
    ...(state.url === url ? state : { data: null, loading: Boolean(url), error: null }),
    reload,
  };
}
