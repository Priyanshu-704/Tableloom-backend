const { logger } = require("./utils/logger.js");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { initializeSocket } = require("./utils/socketManager");
const cookieParser = require("cookie-parser");
const delayMonitor = require("./utils/delayMonitor");
const setupSwagger = require("./docs/setupSwagger");
const {
  notFoundHandler,
  errorHandler,
} = require("./middleware/errorHandler");
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

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://192.168.1.156:5000",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://192.168.1.72:5000",
      "http://localhost:5000",
      process.env.FRONTEND_URL,
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
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
// const corsOptions = {
// origin: [
//   "http://192.168.1.156:5000",
//   "http://localhost:5174",
//   "http://localhost:5173",
//   "http://192.168.1.72:5000",
//   "http://localhost:5000",
//   process.env.FRONTEND_URL,
// ],

//   credentials: true,
//   methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// };

// app.use(cors(corsOptions));

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
  res.status(200).json({
    message: "QR Scan Order System API",
    status: "healthy",
    timestamp: new Date().toISOString(),
    delayMonitor: delayMonitor.getStatus(),
  });
});

if (legacyApiPrefix && legacyApiPrefix !== API_PREFIX) {
  app.get(`${legacyApiPrefix}/healthz`, (req, res) => {
    res.status(200).json({
      message: "QR Scan Order System API",
      status: "healthy",
      timestamp: new Date().toISOString(),
      delayMonitor: delayMonitor.getStatus(),
      legacy: true,
    });
  });
}

app.get("/", (req, res) => {
  res.redirect(`${API_PREFIX}/docs`);
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      logger.info(`📚 Swagger UI: http://localhost:${PORT}${API_PREFIX}/docs`);
      logger.info(`⚡ WebSocket: ws://localhost:${PORT}`);
      delayMonitor.start().catch((error) => {
        logger.error("Failed to start delay monitor:", error.message);
      });
    });
  } catch (error) {
    logger.error("Failed to bootstrap server:", error.message);
    process.exit(1);
  }
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
