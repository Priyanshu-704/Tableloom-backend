const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};
const { sanitizeLogMeta } = require("../middleware/security");
const normalizeLevel = (level = "") => {
  const normalized = String(level || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(LOG_LEVELS, normalized)
    ? normalized
    : null;
};
const resolveLevel = () => {
  const explicitLevel = normalizeLevel(process.env.LOG_LEVEL);
  if (explicitLevel) {
    return explicitLevel;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
};
const shouldLog = (level) => LOG_LEVELS[level] >= LOG_LEVELS[resolveLevel()];
const writeLog = (level, message, ...meta) => {
  if (!shouldLog(level)) {
    return;
  }
  const timestamp = new Date().toISOString();
  const method = level === "debug" ? "debug" : level;
  const args = [
    `[${timestamp}] [${level.toUpperCase()}]`,
    message,
    ...meta.map((entry) => sanitizeLogMeta(entry)),
  ];
  if (typeof console[method] === "function") {
    console[method](...args);
    return;
  }
  console.log(...args);
};
const logger = {
  debug: (message, ...meta) => writeLog("debug", message, ...meta),
  info: (message, ...meta) => writeLog("info", message, ...meta),
  warn: (message, ...meta) => writeLog("warn", message, ...meta),
  error: (message, ...meta) => writeLog("error", message, ...meta),
};
module.exports = {
  logger,
};
