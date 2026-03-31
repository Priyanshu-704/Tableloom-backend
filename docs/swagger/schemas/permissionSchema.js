/**
 * @swagger
 * components:
 *   schemas:
 *     Permission:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Permission identifier
 *           example: "USER_CREATE"
 *         description:
 *           type: string
 *           description: Human-readable description
 *           example: "Can create new users"
 *         category:
 *           type: string
 *           description: Permission category
 *           example: "Users"
 * 
 *     AvailablePermissions:
 *       type: object
 *       properties:
 *         permissions:
 *           type: object
 *           additionalProperties:
 *             type: string
 *         allPermissions:
 *           type: array
 *           items:
 *             type: string
 *           description: List of all permission identifiers
 *         rolePermissions:
 *           type: object
 *           additionalProperties:
 *             type: array
 *             items:
 *               type: string
 *           description: Default permissions for each role fetched from settings
 *         source:
 *           type: string
 *           example: "database"
 * 
 *     UserPermissionsResponse:
 *       type: object
 *       properties:
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           description: User's current permissions
 *         role:
 *           type: string
 *           enum: [admin, manager, chef, waiter, staff, cashier]
 *           description: User's role
 *         customPermissions:
 *           type: array
 *           items:
 *             type: string
 *           description: User-specific permission overrides stored on the user
 *         defaultPermissions:
 *           type: array
 *           items:
 *             type: string
 *           description: Default permissions for user's role
 * 
 *     UpdatePermissionsRequest:
 *       type: object
 *       required:
 *         - permissions
 *       properties:
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           description: New permission list for user
 *           example: ["USER_VIEW", "USER_CREATE", "USER_EDIT"]
 * 
 *     UpdatePermissionsResponse:
 *       type: object
 *       properties:
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *         role:
 *           type: string
 *         updatedBy:
 *           type: string
 *           description: User ID who updated permissions
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     ResetPermissionsResponse:
 *       type: object
 *       properties:
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *         role:
 *           type: string
 *         message:
 *           type: string
 *           example: "Permissions reset to role defaults"
 * 
 *     MyPermissionsResponse:
 *       type: object
 *       properties:
 *         role:
 *           type: string
 *           enum: [admin, manager, chef, waiter, staff, cashier]
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           description: Effective permissions (role defaults + custom)
 *         defaultPermissions:
 *           type: array
 *           items:
 *             type: string
 *         source:
 *           type: string
 *           example: "database"
 */
