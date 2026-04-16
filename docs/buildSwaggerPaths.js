const ROUTE_GROUPS = [
  {
    mountPath: "/tenants",
    tag: "Tenants",
    loadRouter: () => require("../routes/tenantRoutes"),
  },
  {
    mountPath: "/users",
    tag: "Auth",
    loadRouter: () => require("../routes/userRoutes"),
  },
  {
    mountPath: "/permissions",
    tag: "Permissions",
    loadRouter: () => require("../routes/permissionRoutes"),
  },
  {
    mountPath: "/support",
    tag: "Support",
    loadRouter: () => require("../routes/supportRoutes"),
  },
  {
    mountPath: "/admin-requests",
    tag: "Admin Requests",
    loadRouter: () => require("../routes/supportRoutes"),
  },
  {
    mountPath: "/menu",
    tag: "Menu",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/menuRoutes"),
  },
  {
    mountPath: "/inventory",
    tag: "Inventory",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/inventoryRoutes"),
  },
  {
    mountPath: "/tables",
    tag: "Tables",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/tableRoutes"),
  },
  {
    mountPath: "/customers",
    tag: "Customers",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/customerRoutes"),
  },
  {
    mountPath: "/cart",
    tag: "Cart",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/cartRoutes"),
  },
  {
    mountPath: "/orders",
    tag: "Orders",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/orderRoutes"),
  },
  {
    mountPath: "/feedback",
    tag: "Feedback",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/feedbackRoutes"),
  },
  {
    mountPath: "/waiter-calls",
    tag: "Waiter Calls",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/waiterCallRoutes"),
  },
  {
    mountPath: "/kitchen",
    tag: "Kitchen",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/kitchenRoutes"),
  },
  {
    mountPath: "/kitchen-stations",
    tag: "Kitchen Stations",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/kitchenStationRoutes"),
  },
  {
    mountPath: "/images",
    tag: "Images",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/imageRoutes"),
  },
  {
    mountPath: "/bills",
    tag: "Bills",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/billRoutes"),
  },
  {
    mountPath: "/notifications",
    tag: "Notifications",
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/notificationRoutes"),
  },
  {
    mountPath: "/push-notifications",
    tag: "Push Notifications",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/pushNotificationRoutes"),
  },
  {
    mountPath: "/settings",
    tag: "Settings",
    loadRouter: () => require("../routes/settingsRoutes"),
  },
  {
    mountPath: "/dashboard",
    tag: "Dashboard",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/dashboardRoutes"),
  },
  {
    mountPath: "/reports",
    tag: "Reports",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/reportRoutes"),
  },
  {
    mountPath: "/backups",
    tag: "Backups",
    tenantScoped: true,
    superAdminReadOnly: true,
    loadRouter: () => require("../routes/backupRoutes"),
  },
];

const SUCCESS_STATUS_BY_METHOD = {
  get: "200",
  post: "200",
  put: "200",
  patch: "200",
  delete: "200",
};

const TENANT_PARAMETER_REFS = [
  {
    $ref: "#/components/parameters/TenantIdHeader",
  },
  {
    $ref: "#/components/parameters/TenantSlugHeader",
  },
  {
    $ref: "#/components/parameters/TenantKeyHeader",
  },
];

const classifyMiddleware = (middleware) => {
  const source = String(middleware || "");
  return {
    optionalAuth: source.includes("if (!accessToken) return next();"),
    requiresAuth:
      source.includes("Not authorized to access this route") ||
      source.includes("Failed to refresh token"),
    requiresRole:
      source.includes("User role") || source.includes("User not authenticated"),
    requiresPermission: source.includes(
      "You do not have permission to access this resource",
    ),
    requiresTenant: source.includes(
      "Restaurant context is required for this request",
    ),
    readOnly: source.includes("Super admin monitoring mode is read-only"),
  };
};

const normalizeRoutePath = (mountPath, routePath) =>
  `${mountPath}${routePath === "/" ? "" : routePath}`.replace(/\/+/g, "/");

const toOpenApiPath = (path) => path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");

const buildOperationId = (method, path) =>
  `${method}_${path}`
    .replace(/[{}]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const buildPathParameters = (path) =>
  Array.from(path.matchAll(/:([A-Za-z0-9_]+)/g), (match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: {
      type: "string",
    },
  }));

const buildRequestBody = () => ({
  required: false,
  content: {
    "application/json": {
      schema: {
        type: "object",
        additionalProperties: true,
      },
    },
    "multipart/form-data": {
      schema: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
});

const buildDescription = ({ requiresTenant, readOnly, optionalAuth }) => {
  const notes = ["Auto-generated from the active Express router."];
  if (requiresTenant) {
    notes.push(
      "Provide tenant context with `x-tenant-id` or `x-tenant-slug` plus `x-tenant-key`.",
    );
  }
  if (readOnly) {
    notes.push(
      "Super admin monitoring mode is read-only for write requests in a tenant workspace.",
    );
  }
  if (optionalAuth) {
    notes.push("Authorization is optional for this endpoint.");
  }
  return notes.join(" ");
};

const buildOperation = ({
  method,
  tag,
  fullPath,
  requiresAuth,
  requiresTenant,
  readOnly,
  optionalAuth,
}) => {
  const operation = {
    tags: [tag],
    operationId: buildOperationId(method, fullPath),
    summary: `${method.toUpperCase()} ${fullPath}`,
    description: buildDescription({
      requiresTenant,
      readOnly,
      optionalAuth,
    }),
    parameters: [
      ...buildPathParameters(fullPath),
      ...(requiresTenant ? TENANT_PARAMETER_REFS : []),
    ],
    responses: {
      [SUCCESS_STATUS_BY_METHOD[method] || "200"]: {
        description: "Request completed successfully.",
      },
      default: {
        description: "Unexpected error.",
      },
    },
  };

  if (requiresAuth) {
    operation.security = [
      {
        bearerAuth: [],
      },
    ];
  }

  if (["post", "put", "patch"].includes(method)) {
    operation.requestBody = buildRequestBody();
  }

  return operation;
};

const buildPathsFromRouter = (group) => {
  const router = group.loadRouter();
  const paths = {};
  const inherited = {
    requiresAuth: false,
    requiresTenant: Boolean(group.tenantScoped),
    readOnly: Boolean(group.superAdminReadOnly),
  };

  for (const layer of router.stack || []) {
    if (!layer.route) {
      const middleware = classifyMiddleware(layer.handle);
      if (
        middleware.requiresAuth ||
        middleware.requiresRole ||
        middleware.requiresPermission
      ) {
        inherited.requiresAuth = true;
      }
      if (middleware.requiresTenant) {
        inherited.requiresTenant = true;
      }
      if (middleware.readOnly) {
        inherited.readOnly = true;
      }
      continue;
    }

    const routePath = normalizeRoutePath(group.mountPath, layer.route.path);
    const openApiPath = toOpenApiPath(routePath);
    const routeMiddlewares = (layer.route.stack || [])
      .slice(0, -1)
      .map((stackLayer) => classifyMiddleware(stackLayer.handle));
    const requiresAuth =
      inherited.requiresAuth ||
      routeMiddlewares.some(
        (middleware) =>
          middleware.requiresAuth ||
          middleware.requiresRole ||
          middleware.requiresPermission,
      );
    const optionalAuth = routeMiddlewares.some(
      (middleware) => middleware.optionalAuth,
    );
    const requiresTenant =
      inherited.requiresTenant ||
      routeMiddlewares.some((middleware) => middleware.requiresTenant);
    const readOnly =
      inherited.readOnly ||
      routeMiddlewares.some((middleware) => middleware.readOnly);

    paths[openApiPath] = paths[openApiPath] || {};
    for (const method of Object.keys(layer.route.methods || {})) {
      paths[openApiPath][method] = buildOperation({
        method,
        tag: group.tag,
        fullPath: routePath,
        requiresAuth,
        requiresTenant,
        readOnly,
        optionalAuth,
      });
    }
  }

  return paths;
};

const buildSystemPaths = () => {
  const profilingEnabled =
    process.env.PROFILE_ENDPOINT_ENABLED === "true" ||
    process.env.NODE_ENV !== "production";

  const paths = {
    "/healthz": {
      get: {
        tags: ["System"],
        operationId: "get_healthz",
        summary: "GET /healthz",
        description: "Health check endpoint.",
        responses: {
          200: {
            description: "API is healthy.",
          },
          503: {
            description: "API is degraded.",
          },
        },
      },
    },
  };

  if (profilingEnabled) {
    paths["/healthz/profiling"] = {
      get: {
        tags: ["System"],
        operationId: "get_healthz_profiling",
        summary: "GET /healthz/profiling",
        description: "Returns recent request profiling snapshots.",
        responses: {
          200: {
            description: "Profiling data returned successfully.",
          },
        },
      },
    };
    paths["/healthz/profiling/reset"] = {
      post: {
        tags: ["System"],
        operationId: "post_healthz_profiling_reset",
        summary: "POST /healthz/profiling/reset",
        description: "Resets request profiling counters.",
        responses: {
          200: {
            description: "Profiling counters reset successfully.",
          },
        },
      },
    };
  }

  return paths;
};

const buildSwaggerPaths = () =>
  ROUTE_GROUPS.reduce(
    (allPaths, group) => ({
      ...allPaths,
      ...buildPathsFromRouter(group),
    }),
    buildSystemPaths(),
  );

const buildSwaggerTags = () => {
  const tags = ROUTE_GROUPS
    .map((group) => ({
      name: group.tag,
    }))
    .sort((left, right) => {
      if (left.name === "Auth") {
        return -1;
      }
      if (right.name === "Auth") {
        return 1;
      }
      return left.name.localeCompare(right.name);
    });
  tags.push({
    name: "System",
  });
  return tags;
};

module.exports = {
  buildSwaggerPaths,
  buildSwaggerTags,
};
