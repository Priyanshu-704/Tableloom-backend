const path = require("path");
require("dotenv").config({
  quiet: true,
});
const swaggerJsdoc = require("swagger-jsdoc");
const {
  buildSwaggerPaths,
  buildSwaggerTags,
} = require("../docs/buildSwaggerPaths");

const normalizeContextPath = (contextPath = "") =>
  contextPath && contextPath !== "/"
    ? `/${String(contextPath).replace(/^\/+|\/+$/g, "")}`
    : "";

const normalizeBaseUrl = (value = "") => String(value || "").replace(/\/+$/, "");

const dedupeServers = (servers = []) => {
  const seen = new Set();
  return servers.filter((server) => {
    if (!server?.url || seen.has(server.url)) {
      return false;
    }
    seen.add(server.url);
    return true;
  });
};

const resolveServerUrl = (contextPath = "", req = null) => {
  const normalizedContextPath = normalizeContextPath(contextPath);
  const configuredBaseUrl = normalizeBaseUrl(
    process.env.SWAGGER_SERVER_URL || process.env.BACKEND_URL,
  );

  if (configuredBaseUrl) {
    return configuredBaseUrl.endsWith(normalizedContextPath)
      ? configuredBaseUrl
      : `${configuredBaseUrl}${normalizedContextPath}`;
  }

  if (req?.get) {
    return `${req.protocol || "http"}://${req.get("host")}${normalizedContextPath}`;
  }

  const port = process.env.PORT || 5000;
  return `http://localhost:${port}${normalizedContextPath}`;
};

module.exports = (contextPath = "", { req = null } = {}) => {
  const normalizedContextPath =
    normalizeContextPath(contextPath);
  const serverUrl = resolveServerUrl(contextPath, req);
  const localServerUrl = `http://localhost:5000${normalizedContextPath}`;
  return swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Restaurant Management API",
        version: "1.0.0",
        description:
          "API documentation for Restaurant Management System with tenant-aware restaurant routes and optional deployment context path support."},
      servers: dedupeServers([
        {
          url: serverUrl,
          description: normalizedContextPath
            ? `API server mounted under context path ${normalizedContextPath}`
            : "Default API server",
        },
        {
          url: localServerUrl,
          description: "Local development server (localhost:5000)",
        },
      ]),
      tags: buildSwaggerTags(),
      paths: buildSwaggerPaths(),
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
        parameters: {
          TenantIdHeader: {
            name: "x-tenant-id",
            in: "header",
            required: false,
            description:
              "Preferred tenant header. When present it takes precedence over slug/key.",
            schema: {
              type: "string",
            },
          },
          TenantSlugHeader: {
            name: "x-tenant-slug",
            in: "header",
            required: false,
            description:
              "Tenant slug. Use together with `x-tenant-key` when tenant ID is not available.",
            schema: {
              type: "string",
            },
          },
          TenantKeyHeader: {
            name: "x-tenant-key",
            in: "header",
            required: false,
            description:
              "Tenant key. Use together with `x-tenant-slug` when tenant ID is not available.",
            schema: {
              type: "string",
            },
          },
        },
      },
    },
    apis: [
      path.join(__dirname, "../docs/swagger/**/*.js"),
      path.join(__dirname, "../routes/**/*.js"),
    ],
  });
};
