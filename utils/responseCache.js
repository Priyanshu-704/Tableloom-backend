const cacheStore = new Map();

const getCacheEntry = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cacheStore.delete(key);
    return null;
  }

  return entry.value;
};

const setCacheEntry = (key, value, ttlMs = 10000) => {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
};

const getOrSetCache = async (key, ttlMs, factory) => {
  const cached = getCacheEntry(key);
  if (cached !== null) {
    return cached;
  }

  const value = await factory();
  return setCacheEntry(key, value, ttlMs);
};

const clearCache = (matcher = null) => {
  if (!matcher) {
    cacheStore.clear();
    return;
  }

  for (const key of cacheStore.keys()) {
    const matches =
      typeof matcher === "function"
        ? matcher(key)
        : String(key).includes(String(matcher));

    if (matches) {
      cacheStore.delete(key);
    }
  }
};

module.exports = {
  getCacheEntry,
  setCacheEntry,
  getOrSetCache,
  clearCache,
};
