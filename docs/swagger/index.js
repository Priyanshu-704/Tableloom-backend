// Import all schemas
require("./schemas/commonSchema");
require("./schemas/userSchema");
require("./schemas/tableSchema");
require("./schemas/kitchenStationSchema");
require("./schemas/menuSchema");
require("./schemas/customerSchema");
require("./schemas/cartSchema");
require("./schemas/orderSchema");
require("./schemas/kitchenSchema");
require("./schemas/imageSchema");
require("./schemas/permissionSchema");
require("./schemas/billSchema");
require("./schemas/waiterCallSchema");
require("./schemas/feedbackSchema");
require("./schemas/notificationSchema");

// Import all paths
require("./paths/authPaths");
require("./paths/userPaths");
require("./paths/tablePaths");
require("./paths/kitchenStationPaths");
require("./paths/menuPaths");
require("./paths/customerPaths");
require("./paths/cartPaths");
require("./paths/orderPaths");
require("./paths/kitchenPaths");
require("./paths/imagePaths");
require("./paths/permissionPaths");
require("./paths/billPaths");
require("./paths/waiterCallPaths");
require("./paths/feedbackPaths");
require("./paths/notificationPaths");
require("./paths/settingsPaths");
require("./paths/backupPaths");
require("./paths/tenantPaths");

// Additional global definitions can be added here
/**
 * @swagger
 * components:
 *   parameters:
 *     AuthorizationHeader:
 *       name: Authorization
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *         example: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       description: JWT access token
 *
 *     TenantSlugHeader:
 *       name: x-tenant-slug
 *       in: header
 *       required: false
 *       schema:
 *         type: string
 *         example: spice-villa
 *       description: Tenant slug for restaurant-scoped routes. Use this together with `x-tenant-key` when testing a tenant workspace without `x-tenant-id`.
 *
 *     TenantKeyHeader:
 *       name: x-tenant-key
 *       in: header
 *       required: false
 *       schema:
 *         type: string
 *         example: sv01
 *       description: Tenant key paired with `x-tenant-slug` for restaurant-scoped routes.
 *
 *     TenantIdHeader:
 *       name: x-tenant-id
 *       in: header
 *       required: false
 *       schema:
 *         type: string
 *         pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439012"
 *       description: Direct tenant id for restaurant-scoped routes. If present, the backend resolves tenant context from this header before checking slug/key headers.
 *
 *     UserIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439011"
 *       description: MongoDB ObjectId of the user
 */
