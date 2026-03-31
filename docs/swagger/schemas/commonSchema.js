/**
 * @swagger
 * components:
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Error message here"
 *         error:
 *           type: string
 *           example: "Detailed error message"
 * 
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Operation successful"
 *         data:
 *           type: object
 * 
 *     Pagination:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           example: 1
 *         pages:
 *           type: integer
 *           example: 5
 *         total:
 *           type: integer
 *           example: 100
 * 
 *     Permission:
 *       type: string
 *       enum:
 *         - USER_CREATE
 *         - USER_VIEW_ALL
 *         - USER_CHANGE_STATUS
 *         - USER_CHANGE_ROLE
 *         - USER_DELETE
 * 
 *     Role:
 *       type: string
 *       enum:
 *         - admin
 *         - manager
 *         - chef
 *         - waiter
 *         - customer
 *
 *   responses:
 *     UnauthorizedError:
 *       description: Missing, invalid, or expired authentication token.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             statusCode: 401
 *             message: Not authorized to access this route
 *
 *     ForbiddenError:
 *       description: Authenticated, but missing the required permission or role.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             statusCode: 403
 *             message: You do not have permission to access this resource
 *
 *     TenantRequiredError:
 *       description: The route needs a tenant context but no tenant was resolved from the request.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             statusCode: 400
 *             message: Tenant context is required for this route
 *
 *     TenantWorkspaceReadonlyError:
 *       description: Super admin attempted a write operation while monitoring a tenant workspace.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             statusCode: 403
 *             message: Super admin monitoring mode is read-only inside restaurant workspaces
 *
 *     NotFoundError:
 *       description: Requested resource was not found.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             statusCode: 404
 *             message: Resource not found
 *
 *     ValidationError:
 *       description: Request validation failed.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             statusCode: 400
 *             message: Validation failed
 *
 *     ServerError:
 *       description: Unexpected server error.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             statusCode: 500
 *             message: Internal server error
 */
