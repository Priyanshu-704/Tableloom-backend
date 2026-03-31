const { logger } = require("./../utils/logger.js");
// docs/setupSwagger.js
const swaggerUi = require("swagger-ui-express");
const createSwaggerSpec = require("../config/swagger");

const swaggerOptions = {
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
  `,
  customSiteTitle: "Restaurant Management API Documentation",
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: "list",
    tagsSorter: "alpha",
    operationsSorter: "alpha",
    defaultModelsExpandDepth: 3,
    defaultModelExpandDepth: 3,
    displayRequestDuration: true,
  },
};

const setupSwagger = (app, contextPath = "") => {
  const swaggerSpec = createSwaggerSpec(contextPath);

  // Swagger UI
  app.use(
    `${contextPath}/docs`,
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerOptions),
  );

  // Swagger JSON
  app.get(`${contextPath}/docs.json`, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  logger.info(`📚 Swagger UI: ${contextPath}/docs`);
  logger.info(`📄 Swagger JSON: ${contextPath}/docs.json`);
};

module.exports = setupSwagger;