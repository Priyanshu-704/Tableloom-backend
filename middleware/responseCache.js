const {
  ACCESS_TOKEN_COOKIE_NAME,
  CUSTOMER_SESSION_COOKIE_NAME,
} = require("../utils/cookieOptions");
const {
  RESPONSE_CACHE_PREFIX,
  getInvalidationTagsForRequest,
  getRequestPathname,
  getResponseCacheTags,
  getResponseCacheTtlMs,
  normalizeTenantTag,
  shouldBypassResponseCache,
  shouldInvalidateMutation,
} = require("../utils/cacheTags");
const {
  clearCacheByTags,
  getCacheEntry,
  setCacheEntry,
} = require("../utils/responseCache");
const {
  getTokenSessionId,
  getTokenUserId,
  verifyAccessToken,
  verifyCustomerSessionToken,
} = require("../utils/authTokens");

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

const buildScopeKey = (req) => {
  const authorization = String(req.headers?.authorization || "").trim();
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : req.cookies?.[ACCESS_TOKEN_COOKIE_NAME] || "";

  if (accessToken) {
    try {
      const decoded = verifyAccessToken(accessToken);
      return `staff:${getTokenUserId(decoded) || decoded.role || "unknown"}`;
    } catch (_error) {}
  }

  const customerToken = authorization.startsWith("Customer ")
    ? authorization.slice(9).trim()
    : req.cookies?.[CUSTOMER_SESSION_COOKIE_NAME] || "";

  if (customerToken) {
    try {
      const decoded = verifyCustomerSessionToken(customerToken);
      return `session:${getTokenSessionId(decoded) || "unknown"}`;
    } catch (_error) {}
  }

  return "public";
};

const canCacheRequest = (req) => {
  if (String(req.method || "").toUpperCase() !== "GET") {
    return false;
  }

  if (shouldBypassResponseCache(req)) {
    return false;
  }

  const requestCacheControl = String(req.headers?.["cache-control"] || "")
    .trim()
    .toLowerCase();
  if (
    requestCacheControl.includes("no-store") ||
    requestCacheControl.includes("no-cache")
  ) {
    return false;
  }

  return true;
};

const cloneCacheableBody = (body) => {
  const serialized = JSON.stringify(body);
  if (serialized === undefined) {
    return null;
  }
  return JSON.parse(serialized);
};

const buildResponseCacheKey = (req) => {
  const pathname = getRequestPathname(req);
  const queryKey =
    req.query && Object.keys(req.query).length > 0
      ? stableStringify(req.query)
      : "";
  const scopeKey = buildScopeKey(req);
  const tenantTag = normalizeTenantTag(req.tenantId || req.tenant?._id);

  return [
    RESPONSE_CACHE_PREFIX,
    tenantTag,
    scopeKey,
    pathname,
    queryKey,
  ].join(":");
};

const setCacheHitHeaders = (res, value) => {
  res.setHeader("x-response-cache", value);
};

const responseCacheMiddleware = (req, res, next) => {
  if (!canCacheRequest(req)) {
    return next();
  }

  const cacheKey = buildResponseCacheKey(req);
  const cached = getCacheEntry(cacheKey);
  if (cached) {
    setCacheHitHeaders(res, "HIT");
    if (cached.headers?.contentType) {
      res.setHeader("Content-Type", cached.headers.contentType);
    }
    return res.status(cached.statusCode).json(cached.body);
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const statusCode = res.statusCode || 200;
    const hasSetCookie = Boolean(res.getHeader("Set-Cookie"));
    const responseCacheControl = String(res.getHeader("Cache-Control") || "")
      .trim()
      .toLowerCase();

    if (
      statusCode >= 200 &&
      statusCode < 300 &&
      !hasSetCookie &&
      !responseCacheControl.includes("no-store")
    ) {
      const ttlMs = getResponseCacheTtlMs(req);
      const tags = getResponseCacheTags(req);
      setCacheEntry(
        cacheKey,
        {
          statusCode,
          body: cloneCacheableBody(body),
          headers: {
            contentType:
              String(res.getHeader("Content-Type") || "").trim() ||
              "application/json; charset=utf-8",
          },
        },
        ttlMs,
        {
          tags,
        },
      );
      setCacheHitHeaders(res, "MISS");
    }

    return originalJson(body);
  };

  return next();
};

const mutationCacheInvalidationMiddleware = (req, res, next) => {
  const method = String(req.method || "").toUpperCase();
  if (!MUTATING_METHODS.has(method) || !shouldInvalidateMutation(req)) {
    return next();
  }

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 400) {
      return;
    }

    clearCacheByTags(getInvalidationTagsForRequest(req));
  });

  return next();
};

module.exports = {
  mutationCacheInvalidationMiddleware,
  responseCacheMiddleware,
};
