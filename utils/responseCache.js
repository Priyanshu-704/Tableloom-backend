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

const normalizeTags = (tags = []) =>
  [...new Set((Array.isArray(tags) ? tags : [tags]).filter(Boolean))];

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
const setCacheEntry = (
  key,
  value,
  ttlMs = DEFAULT_CACHE_TTL_MS,
  options = {},
) => {
  ensureSweepTimer();
  cleanupExpiredEntries();
  const tags = normalizeTags(options.tags);
  if (cacheStore.has(key)) {
    cacheStore.delete(key);
  }
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    tags,
  });
  evictOverflowEntries();
  return value;
};
const getOrSetCache = async (key, ttlMs, factory, options = {}) => {
  const cached = getCacheEntry(key);
  if (cached !== null) {
    return cached;
  }
  const value = await factory();
  return setCacheEntry(key, value, ttlMs, options);
};
const clearCache = (matcher = null) => {
  if (!matcher) {
    cacheStore.clear();
    return;
  }

  const normalizedTags =
    matcher &&
    typeof matcher === "object" &&
    !Array.isArray(matcher) &&
    !(matcher instanceof RegExp)
      ? normalizeTags(matcher.tags)
      : [];

  const normalizedMatcher =
    matcher &&
    typeof matcher === "object" &&
    !Array.isArray(matcher) &&
    !(matcher instanceof RegExp)
      ? matcher.matcher || null
      : matcher;

  for (const key of cacheStore.keys()) {
    const entry = cacheStore.get(key);
    const matchesTags =
      normalizedTags.length > 0 &&
      normalizedTags.some((tag) => entry?.tags?.includes(tag));
    const matches =
      matchesTags ||
      (typeof normalizedMatcher === "function"
        ? normalizedMatcher(key, entry)
        : normalizedMatcher instanceof RegExp
          ? normalizedMatcher.test(String(key))
          : String(key).includes(String(normalizedMatcher)));
    if (matches) {
      cacheStore.delete(key);
    }
  }
};
const clearCacheByTags = (tags = []) => {
  const normalizedTags = normalizeTags(tags);
  if (normalizedTags.length === 0) {
    return;
  }
  clearCache({
    tags: normalizedTags,
  });
};
module.exports = {
  getCacheEntry,
  setCacheEntry,
  getOrSetCache,
  clearCache,
  clearCacheByTags,
};
