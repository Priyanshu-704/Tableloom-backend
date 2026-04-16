const { logger } = require("./../utils/logger.js");
const swaggerUi = require("swagger-ui-express");
const createSwaggerSpec = require("../config/swagger");
const {
  buildSwaggerTenantUiScript,
  swaggerTenantUiStyles,
} = require("./swaggerTenantUi");

const buildSwaggerOptions = (contextPath = "") => ({
  explorer: true,
  customCss: `
    .swagger-ui .topbar {
      display: block !important;
      background-color: #1b1b1b;
      padding: 10px 0;
    }
    .swagger-ui .topbar a {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .swagger-ui .topbar img {
      max-height: 40px;
    }
    ${swaggerTenantUiStyles}
  `,
  customJsStr: buildSwaggerTenantUiScript(contextPath),
  customSiteTitle: "Restaurant Management API Documentation",
  swaggerOptions: {
    url: `${contextPath}/docs.json`,
    persistAuthorization: true,
    docExpansion: "list",
    operationsSorter: "alpha",
    defaultModelsExpandDepth: 3,
    defaultModelExpandDepth: 3,
    displayRequestDuration: true,
    requestInterceptor: (request) => {
      const getTenantState = window.__getSwaggerTenantState;
      const applyTenantHeaders = window.__applySwaggerTenantHeaders;
      if (
        typeof getTenantState === "function" &&
        typeof applyTenantHeaders === "function"
      ) {
        request.headers = applyTenantHeaders(request.headers, getTenantState());
      }
      return request;
    },
  },
});

const setupSwagger = (app, contextPath = "") => {
  const swaggerOptions = buildSwaggerOptions(contextPath);
  app.use(
    `${contextPath}/docs`,
    swaggerUi.serve,
    swaggerUi.setup(null, swaggerOptions),
  );
  app.get(`${contextPath}/docs.json`, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(createSwaggerSpec(contextPath, { req }));
  });
  logger.info(`Swagger UI: ${contextPath}/docs`);
  logger.info(`Swagger JSON: ${contextPath}/docs.json`);
};
module.exports = setupSwagger;
