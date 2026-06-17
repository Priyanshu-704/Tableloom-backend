const { logger } = require("./utils/logger.js");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { initializeSocket, shutdownSocket } = require("./utils/socketManager");
const cookieParser = require("cookie-parser");
const delayMonitor = require("./utils/delayMonitor");
const subscriptionExpiryJob = require("./jobs/subscriptionExpiryJob");
const setupSwagger = require("./docs/setupSwagger");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const {
  requestProfiler,
  getRequestProfilerSnapshot,
  resetRequestProfilerStats,
} = require("./middleware/requestProfiler");
const {
  getAllowedOrigins,
  isOriginAllowed,
  normalizeOrigin,
  securityHeaders,
} = require("./middleware/security");
const { resolveTenant } = require("./middleware/tenant");
const { assertAuthConfig } = require("./utils/authTokens");
dotenv.config({
  quiet: true,
});
assertAuthConfig();
const connectDB = require("./config/database");
const app = express();
const API_PREFIX = "/api";
const legacyApiPrefix = process.env.CONTEXT_PATH
  ? `/${String(process.env.CONTEXT_PATH).replace(/^\/+|\/+$/g, "")}`
  : "";
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(
  express.json({
    limit: process.env.JSON_BODY_LIMIT || "100kb",
  }),
);
app.use(
  express.urlencoded({
    extended: false,
    limit: process.env.URLENCODED_BODY_LIMIT || "100kb",
  }),
);
app.use(cookieParser());
const allowedOrigins = getAllowedOrigins();
const corsOptions = {
  origin: function (origin, callback) {
    const requestOrigin = normalizeOrigin(origin);
    if (isOriginAllowed(origin, allowedOrigins)) {
      callback(null, true);
    } else {
      logger.warn(`Blocked CORS origin: ${requestOrigin || origin}`);
      callback(new Error("CORS not allowed"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-tenant-id",
    "x-tenant-slug",
    "x-tenant-key",
    "x-branch-id",
    "x-payment-access-token",
    "x-subscription-renewal-token",
  ],
};
app.use(cors(corsOptions));
app.use(requestProfiler);
const swaggerEnabled =
  process.env.SWAGGER_ENABLED === "true" || process.env.NODE_ENV !== "production";
if (swaggerEnabled) {
  setupSwagger(app, API_PREFIX);
  if (legacyApiPrefix && legacyApiPrefix !== API_PREFIX) {
    setupSwagger(app, legacyApiPrefix);
  }
}
const server = require("http").createServer(app);
initializeSocket(server, {
  allowedOrigins,
});
app.use(API_PREFIX, resolveTenant, require("./routes"));
if (legacyApiPrefix && legacyApiPrefix !== API_PREFIX) {
  app.use(legacyApiPrefix, resolveTenant, require("./routes"));
}
app.get(`${API_PREFIX}/healthz`, (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    message: "QR Scan Order System API",
    status: dbConnected ? "healthy" : "degraded",
    dbConnected,
    timestamp: new Date().toISOString(),
    delayMonitor: delayMonitor.getStatus(),
  });
});
const profilingEndpointEnabled =
  process.env.PROFILE_ENDPOINT_ENABLED === "true" ||
  process.env.NODE_ENV !== "production";
if (profilingEndpointEnabled) {
  app.get(`${API_PREFIX}/healthz/profiling`, (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 20;
    res.status(200).json({
      success: true,
      data: getRequestProfilerSnapshot(limit),
    });
  });
  app.post(`${API_PREFIX}/healthz/profiling/reset`, (_req, res) => {
    resetRequestProfilerStats();
    res.status(200).json({
      success: true,
      message: "Request profiler stats reset successfully",
    });
  });
}
if (legacyApiPrefix && legacyApiPrefix !== API_PREFIX) {
  app.get(`${legacyApiPrefix}/healthz`, (req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;
    res.status(dbConnected ? 200 : 503).json({
      message: "QR Scan Order System API",
      status: dbConnected ? "healthy" : "degraded",
      dbConnected,
      timestamp: new Date().toISOString(),
      delayMonitor: delayMonitor.getStatus(),
      legacy: true,
    });
  });
  if (profilingEndpointEnabled) {
    app.get(`${legacyApiPrefix}/healthz/profiling`, (req, res) => {
      const limit = parseInt(req.query.limit, 10) || 20;
      res.status(200).json({
        success: true,
        data: getRequestProfilerSnapshot(limit),
      });
    });
    app.post(`${legacyApiPrefix}/healthz/profiling/reset`, (_req, res) => {
      resetRequestProfilerStats();
      res.status(200).json({
        success: true,
        message: "Request profiler stats reset successfully",
      });
    });
  }
}
app.get("/", (req, res) => {
  res.redirect(swaggerEnabled ? `${API_PREFIX}/docs` : `${API_PREFIX}/healthz`);
});
app.use(notFoundHandler);
app.use(errorHandler);
const PORT = process.env.PORT || 5000;
const DB_RETRY_DELAY_MS = 5000;
let isShuttingDown = false;
const bootstrapServices = async () => {
  while (!isShuttingDown && mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (error) {
      if (isShuttingDown) {
        return;
      }
      logger.warn(
        `Retrying MongoDB connection in ${DB_RETRY_DELAY_MS / 1000}s...`,
      );
      await new Promise((resolve) => {
        const retryTimer = setTimeout(resolve, DB_RETRY_DELAY_MS);
        retryTimer.unref?.();
      });
      continue;
    }
  }
  if (isShuttingDown) {
    return;
  }
  delayMonitor.start().catch((error) => {
    logger.error("Failed to start delay monitor:", error.message);
  });
  subscriptionExpiryJob.start();
};
const startServer = () => {
  server.listen(PORT, () => {
    logger.info(`Swagger UI: http://localhost:${PORT}${API_PREFIX}/docs`);
    logger.info(`WebSocket: ws://localhost:${PORT}`);
    bootstrapServices().catch((error) => {
      logger.error("Failed to bootstrap background services:", error.message);
    });
  });
};
startServer();
const shutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  delayMonitor.stop();
  subscriptionExpiryJob.stop();
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  await shutdownSocket().catch((error) => {
    logger.error("Socket shutdown failed:", error.message);
  });
  await new Promise((resolve) => {
    server.close(() => {
      logger.info("HTTP server closed");
      resolve();
    });
  });
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close().catch((error) => {
      logger.error("MongoDB shutdown failed:", error.message);
    });
  }
};
process.once("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    logger.error("Shutdown failed:", error.message);
  });
});
process.once("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    logger.error("Shutdown failed:", error.message);
  });
});
