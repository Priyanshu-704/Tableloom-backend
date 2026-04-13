const { logger } = require("../utils/logger");
const requestStats = new Map();
const profilerStartedAt = new Date();
const SLOW_REQUEST_THRESHOLD_MS = Number(
  process.env.SLOW_REQUEST_THRESHOLD_MS || 700,
);
const ENABLE_REQUEST_PROFILING =
  process.env.ENABLE_REQUEST_PROFILING !== "false";
const ENABLE_VERBOSE_REQUEST_LOGS =
  process.env.ENABLE_VERBOSE_REQUEST_LOGS === "true";
const REQUEST_PROFILER_MAX_ROUTES = Math.max(
  Number(process.env.REQUEST_PROFILER_MAX_ROUTES || 300),
  50,
);
const REQUEST_PROFILER_ENTRY_TTL_MS = Math.max(
  Number(process.env.REQUEST_PROFILER_ENTRY_TTL_MS || 6 * 60 * 60 * 1000),
  60 * 1000,
);
const round = (value = 0) => Math.round(Number(value || 0) * 100) / 100;
const normalizeFallbackRoute = (value) => {
  const rawValue = String(value || "/").split("?")[0] || "/";
  return rawValue
    .replace(/\/[0-9a-f]{24}(?=\/|$)/gi, "/:id")
    .replace(/\/\d+(?=\/|$)/g, "/:id");
};
const getRouteLabel = (req) => {
  const baseUrl = req.baseUrl || "";
  const routePath = req.route?.path || "";
  if (baseUrl || routePath) {
    return `${baseUrl}${routePath}` || req.path || req.originalUrl || "/";
  }
  return normalizeFallbackRoute(req.path || req.originalUrl || "/");
};
const cleanupStaleRequestStats = (now = Date.now()) => {
  for (const [key, entry] of requestStats.entries()) {
    if (
      !entry?.lastSeenAt ||
      now - entry.lastSeenAt > REQUEST_PROFILER_ENTRY_TTL_MS
    ) {
      requestStats.delete(key);
    }
  }
};
const evictOverflowRequestStats = () => {
  while (requestStats.size > REQUEST_PROFILER_MAX_ROUTES) {
    const oldestKey = requestStats.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    requestStats.delete(oldestKey);
  }
};
const updateRequestStats = ({
  method,
  route,
  statusCode,
  durationMs,
  tenantId,
}) => {
  const key = `${method} ${route}`;
  const existing = requestStats.get(key) || {
    method,
    route,
    count: 0,
    errorCount: 0,
    totalMs: 0,
    avgMs: 0,
    maxMs: 0,
    minMs: Number.POSITIVE_INFINITY,
    lastMs: 0,
    lastStatusCode: null,
    lastAt: null,
    lastSeenAt: 0,
    tenantId: tenantId || null,
  };
  existing.count += 1;
  existing.totalMs += durationMs;
  existing.avgMs = round(existing.totalMs / existing.count);
  existing.maxMs = round(Math.max(existing.maxMs, durationMs));
  existing.minMs = round(Math.min(existing.minMs, durationMs));
  existing.lastMs = round(durationMs);
  existing.lastStatusCode = statusCode;
  existing.lastAt = new Date().toISOString();
  existing.lastSeenAt = Date.now();
  existing.tenantId = tenantId || existing.tenantId || null;
  if (statusCode >= 400) {
    existing.errorCount += 1;
  }
  if (requestStats.has(key)) {
    requestStats.delete(key);
  }
  requestStats.set(key, existing);
  cleanupStaleRequestStats(existing.lastSeenAt);
  evictOverflowRequestStats();
};
const requestProfiler = (req, res, next) => {
  if (!ENABLE_REQUEST_PROFILING) {
    return next();
  }
  const startedAt = process.hrtime.bigint();
  res.once("finish", () => {
    const finishedAt = process.hrtime.bigint();
    const durationMs = Number(finishedAt - startedAt) / 1e6;
    const route = getRouteLabel(req);
    const method = req.method;
    const tenantId = req.tenantId || req.tenant?._id?.toString?.() || null;
    updateRequestStats({
      method,
      route,
      statusCode: res.statusCode,
      durationMs,
      tenantId,
    });
    if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn("Slow API request detected", {
        method,
        route,
        statusCode: res.statusCode,
        durationMs: round(durationMs),
        tenantId,
      });
      return;
    }
    if (ENABLE_VERBOSE_REQUEST_LOGS) {
      logger.debug("API request completed", {
        method,
        route,
        statusCode: res.statusCode,
        durationMs: round(durationMs),
        tenantId,
      });
    }
  });
  return next();
};
const getRequestProfilerSnapshot = (limit = 20) => {
  cleanupStaleRequestStats();
  const rows = Array.from(requestStats.values());
  const normalizedLimit = Math.max(1, Number(limit) || 20);
  return {
    enabled: ENABLE_REQUEST_PROFILING,
    slowRequestThresholdMs: SLOW_REQUEST_THRESHOLD_MS,
    startedAt: profilerStartedAt.toISOString(),
    totalTrackedRoutes: rows.length,
    maxTrackedRoutes: REQUEST_PROFILER_MAX_ROUTES,
    topByAverage: rows
      .slice()
      .sort((left, right) => right.avgMs - left.avgMs)
      .slice(0, normalizedLimit),
    topByMax: rows
      .slice()
      .sort((left, right) => right.maxMs - left.maxMs)
      .slice(0, normalizedLimit),
    topByVolume: rows
      .slice()
      .sort((left, right) => right.count - left.count)
      .slice(0, normalizedLimit),
  };
};
const resetRequestProfilerStats = () => {
  requestStats.clear();
};
module.exports = {
  requestProfiler,
  getRequestProfilerSnapshot,
  resetRequestProfilerStats,
};
