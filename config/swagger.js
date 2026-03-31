const path = require("path");
require("dotenv").config({ quiet: true });
const swaggerJsdoc = require("swagger-jsdoc");

module.exports = (contextPath = "") => {
  const normalizedContextPath =
    contextPath && contextPath !== "/"
      ? `/${String(contextPath).replace(/^\/+|\/+$/g, "")}`
      : "";
  const configuredBackendUrl = String(process.env.BACKEND_URL).replace(
    /\/+$/,
    "",
  );
  const serverUrl = configuredBackendUrl.endsWith(normalizedContextPath)
    ? configuredBackendUrl
    : `${configuredBackendUrl}${normalizedContextPath}`;

  return swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Restaurant Management API",
        version: "1.0.0",
        description:
          "API documentation for Restaurant Management System with tenant-aware restaurant routes and optional deployment context path support.\n\n" +
          "Tenant testing flow in Swagger:\n" +
          "1. Login first and authorize with the returned Bearer token.\n" +
          "2. For restaurant-scoped routes, send either `x-tenant-id` or the pair `x-tenant-slug` + `x-tenant-key`.\n" +
          "3. `x-tenant-id` takes precedence when both styles are provided.\n" +
          "4. Super admin can read tenant routes in monitoring mode, but write operations return `403` inside tenant workspaces.\n" +
          "5. Tenant settings, bills, backups, tables, menu, and similar data are isolated per tenant under the current tenant context.",
      },
      servers: [
        {
          url: serverUrl,
          description: normalizedContextPath
            ? `API server mounted under context path ${normalizedContextPath}`
            : "Default API server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    apis: [path.join(__dirname, "../docs/swagger/**/*.js")],
  });
};
