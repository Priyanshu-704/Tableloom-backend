const SENSITIVE_KEY_PATTERN =
  /(pass(word)?|token|secret|authorization|cookie|api[-_]?key|private[-_]?key|refresh[-_]?token)/i;

const normalizeOrigin = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  try {
    return new URL(normalized).origin;
  } catch {
    return normalized.replace(/\/+$/, "");
  }
};

const getAllowedOrigins = () => {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
    process.env.CORS_ORIGINS,
    "http://192.168.1.156:5173"
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map(normalizeOrigin)
    .filter(Boolean);

  const allowedOrigins = new Set(configuredOrigins);

  if (process.env.NODE_ENV !== "production") {
    [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "http://127.0.0.1:5000",
    ].forEach((origin) => allowedOrigins.add(origin));
  }

  return allowedOrigins;
};

const getClientIp = (req = {}) => {
  const forwardedFor = req.headers?.["x-forwarded-for"];
  if (forwardedFor) {
    return String(forwardedFor).split(",")[0].trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown"
  );
};

const securityHeaders = (req, res, next) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  if (!String(req.path || "").startsWith("/api/")) {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
    );
  }

  next();
};

const createRateLimit = ({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = "Too many requests. Please try again later.",
  keyGenerator = (req) => getClientIp(req),
} = {}) => {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = String(keyGenerator(req) || "").trim();

    if (!key) {
      return next();
    }

    const existingTimestamps = hits.get(key) || [];
    const activeTimestamps = existingTimestamps.filter(
      (timestamp) => now - timestamp < windowMs,
    );

    if (activeTimestamps.length >= max) {
      const retryAfterSeconds = Math.ceil(
        (windowMs - (now - activeTimestamps[0])) / 1000,
      );
      res.setHeader("Retry-After", String(Math.max(retryAfterSeconds, 1)));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    activeTimestamps.push(now);
    hits.set(key, activeTimestamps);

    next();
  };
};

const redactSensitiveValue = (value) => {
  if (value === undefined || value === null) {
    return value;
  }
  return "[REDACTED]";
};

const sanitizeLogMeta = (value, key = "") => {
  if (SENSITIVE_KEY_PATTERN.test(String(key || ""))) {
    return redactSensitiveValue(value);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeLogMeta(entry));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((accumulator, [entryKey, entryValue]) => {
      accumulator[entryKey] = sanitizeLogMeta(entryValue, entryKey);
      return accumulator;
    }, {});
  }

  return value;
};

module.exports = {
  createRateLimit,
  getAllowedOrigins,
  getClientIp,
  normalizeOrigin,
  sanitizeLogMeta,
  securityHeaders,
};
