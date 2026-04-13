const cacheStore = new Map();
const DEFAULT_CACHE_TTL_MS = 10000;
const CACHE_SWEEP_INTERVAL_MS = Math.max(
  Number(process.env.RESPONSE_CACHE_SWEEP_INTERVAL_MS || 60000),
  5000,
);
const MAX_CACHE_ENTRIES = Math.max(
  Number(process.env.RESPONSE_CACHE_MAX_ENTRIES || 500),
  50,
);
let sweepTimer = null;

const cleanupExpiredEntries = (now = Date.now()) => {
  for (const [key, entry] of cacheStore.entries()) {
    if (!entry || entry.expiresAt <= now) {
      cacheStore.delete(key);
    }
  }
};

const evictOverflowEntries = () => {
  while (cacheStore.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cacheStore.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    cacheStore.delete(oldestKey);
  }
};

const ensureSweepTimer = () => {
  if (sweepTimer) {
    return;
  }
  sweepTimer = setInterval(() => {
    cleanupExpiredEntries();
    evictOverflowEntries();
  }, CACHE_SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
};

const getCacheEntry = (key) => {
  ensureSweepTimer();
  const entry = cacheStore.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    cacheStore.delete(key);
    return null;
  }
  cacheStore.delete(key);
  cacheStore.set(key, entry);
  return entry.value;
};
const setCacheEntry = (key, value, ttlMs = DEFAULT_CACHE_TTL_MS) => {
  ensureSweepTimer();
  cleanupExpiredEntries();
  if (cacheStore.has(key)) {
    cacheStore.delete(key);
  }
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  evictOverflowEntries();
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
