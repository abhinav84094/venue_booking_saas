// Deduplicate informational reads in flight. The shared instance has no TTL:
// hall/public responses contain validity flags, so later reads must revalidate.
// Access, availability and payment requests always remain independent.
export function canCacheResource(url) {
  return (
    /^\/public\/venues\/[a-z0-9-]+$/.test(url) ||
    /^\/venues\/[a-f\d]{24}\/halls(?:\/[a-f\d]{24}\/halls)?$/i.test(url)
  );
}

export function createResourceCache({ now = Date.now, ttl = 10000, limit = 100 } = {}) {
  const values = new Map();
  const pending = new Map();
  const listeners = new Set();
  let generation = 0;
  return {
    async load(key, loader) {
      const cached = values.get(key);
      if (cached?.expires > now()) return cached.value;
      if (pending.has(key)) return pending.get(key);
      const requestedGeneration = generation;
      const request = Promise.resolve()
        .then(loader)
        .then((value) => {
          if (generation === requestedGeneration && ttl > 0) {
            if (values.size >= limit) values.delete(values.keys().next().value);
            values.set(key, { value, expires: now() + ttl });
          }
          return value;
        })
        .finally(() => {
          if (pending.get(key) === request) pending.delete(key);
        });
      pending.set(key, request);
      return request;
    },
    clear({ notify = true } = {}) {
      generation++;
      values.clear();
      pending.clear();
      if (notify) listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const resourceCache = createResourceCache({ ttl: 0 });
