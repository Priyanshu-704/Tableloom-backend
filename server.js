const { logger } = require("./utils/logger.js");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { initializeSocket } = require("./utils/socketManager");
const cookieParser = require("cookie-parser");
const delayMonitor = require("./utils/delayMonitor");
const setupSwagger = require("./docs/setupSwagger");
const {
  notFoundHandler,
  errorHandler,
} = require("./middleware/errorHandler");
const {
  requestProfiler,
  getRequestProfilerSnapshot,
  resetRequestProfilerStats,
} = require("./middleware/requestProfiler");
const { resolveTenant } = require("./middleware/tenant");

dotenv.config({ quiet: true });

const connectDB = require("./config/database");

const app = express();
const API_PREFIX = "/api";
const legacyApiPrefix = process.env.CONTEXT_PATH
  ? `/${String(process.env.CONTEXT_PATH).replace(/^\/+|\/+$/g, "")}`
  : "";
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(cookieParser());

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

const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  process.env.CORS_ORIGINS,
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

const corsOptions = {
  origin: function (origin, callback) {
    const requestOrigin = normalizeOrigin(origin);

    if (!origin || allowedOrigins.has(requestOrigin)) {
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
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(requestProfiler);

setupSwagger(app, API_PREFIX);
if (legacyApiPrefix && legacyApiPrefix !== API_PREFIX) {
  setupSwagger(app, legacyApiPrefix);
}

const server = require("http").createServer(app);
initializeSocket(server);

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
  res.redirect(`${API_PREFIX}/docs`);
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const DB_RETRY_DELAY_MS = 5000;

const bootstrapServices = async () => {
  while (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (error) {
      logger.warn(
        `Retrying MongoDB connection in ${DB_RETRY_DELAY_MS / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, DB_RETRY_DELAY_MS));
      continue;
    }
  }

  delayMonitor.start().catch((error) => {
    logger.error("Failed to start delay monitor:", error.message);
  });
};

const startServer = () => {
  server.listen(PORT, () => {
    logger.info(`📚 Swagger UI: http://localhost:${PORT}${API_PREFIX}/docs`);
    logger.info(`⚡ WebSocket: ws://localhost:${PORT}`);
    bootstrapServices().catch((error) => {
      logger.error("Failed to bootstrap background services:", error.message);
    });
  });
};

startServer();

process.on("SIGTERM", () => {
  delayMonitor.stop();
  server.close(() => {
    logger.info("HTTP server closed");
  });
});

process.on("SIGINT", () => {
  delayMonitor.stop();
  server.close(() => {
    logger.info("HTTP server closed");
  });
});
