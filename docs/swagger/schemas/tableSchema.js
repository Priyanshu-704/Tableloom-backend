/**
 * @swagger
 * components:
 *   schemas:
 *     Table:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Table ID
 *         tableNumber:
 *           type: string
 *           description: Table number/identifier
 *         tableName:
 *           type: string
 *           nullable: true
 *           description: Descriptive table name
 *         capacity:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           description: Maximum seating capacity
 *         location:
 *           type: string
 *           enum: [indoor, outdoor, terrace, private-room, bar, main hall]
 *           default: indoor
 *         status:
 *           type: string
 *           enum: [available, occupied, billing, reserved, maintenance, cleaning, inactive]
 *           default: available
 *         qrCode:
 *           type: string
 *           nullable: true
 *           description: QR code image URL
 *         qrUrl:
 *           type: string
 *           nullable: true
 *           description: Full customer-facing URL encoded inside the QR image
 *         tokenExpiry:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: QR token expiry date
 *         tokenDaysRemaining:
 *           type: integer
 *           description: Days until token expires
 *         tokenExpired:
 *           type: boolean
 *           description: Whether token has expired
 *         currentOrder:
 *           type: object
 *           nullable: true
 *           properties:
 *             _id:
 *               type: string
 *             orderNumber:
 *               type: string
 *             totalAmount:
 *               type: number
 *             status:
 *               type: string
 *         currentCustomer:
 *           type: object
 *           nullable: true
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             phone:
 *               type: string
 *         lastOccupied:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         lastCleaned:
 *           type: string
 *           format: date-time
 *         notes:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *           default: true
 *         createdBy:
 *           type: object
 *           nullable: true
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     CreateTableRequest:
 *       type: object
 *       required:
 *         - tableNumber
 *         - capacity
 *       properties:
 *         tableNumber:
 *           type: string
 *           description: Unique table number/identifier
 *           example: "T01"
 *         tableName:
 *           type: string
 *           description: Descriptive table name
 *           example: "Window Side Table"
 *         capacity:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           description: Maximum seating capacity
 *           example: 4
 *         location:
 *           type: string
 *           enum: [indoor, outdoor, terrace, private-room, bar, main hall]
 *           default: indoor
 *           example: "indoor"
 *         notes:
 *           type: string
 *           description: Additional notes about the table
 *           example: "Near window, good view"
 *
 *     UpdateTableRequest:
 *       type: object
 *       properties:
 *         tableNumber:
 *           type: string
 *           description: Unique table number/identifier
 *           example: "T01"
 *         tableName:
 *           type: string
 *           description: Descriptive table name
 *           example: "Window Side Table"
 *         capacity:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           example: 6
 *         location:
 *           type: string
 *           enum: [indoor, outdoor, terrace, private-room, bar, main hall]
 *           example: "outdoor"
 *         notes:
 *           type: string
 *           description: Additional notes about the table
 *           example: "Updated capacity to 6"
 *
 *     UpdateTableStatusRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [available, occupied, billing, reserved, maintenance, cleaning, inactive]
 *           description: New table status
 *           example: "occupied"
 *         notes:
 *           type: string
 *           description: Reason for status change
 *           example: "Customer seated"
 *
 *     TableStatistics:
 *       type: object
 *       properties:
 *         totalTables:
 *           type: integer
 *           description: Total active tables
 *           example: 20
 *         available:
 *           type: integer
 *           description: Available tables count
 *           example: 10
 *         occupied:
 *           type: integer
 *           description: Occupied tables count
 *           example: 8
 *         reserved:
 *           type: integer
 *           description: Reserved tables count
 *           example: 1
 *         maintenance:
 *           type: integer
 *           description: Tables under maintenance
 *           example: 1
 *         occupancyRate:
 *           type: number
 *           format: float
 *           minimum: 0
 *           maximum: 100
 *           description: Current occupancy rate percentage
 *           example: 40.0
 *
 *     QRTokenStatus:
 *       type: object
 *       properties:
 *         tableNumber:
 *           type: string
 *           example: "T01"
 *         hasToken:
 *           type: boolean
 *           example: true
 *         tokenExpiry:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2024-12-31T23:59:59.999Z"
 *         status:
 *           type: string
 *           example: "available"
 *         isActive:
 *           type: boolean
 *           example: true
 *         tokenValid:
 *           type: boolean
 *           example: true
 *         daysRemaining:
 *           type: integer
 *           nullable: true
 *           example: 15
 *
 *     TableFilters:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [available, occupied, billing, reserved, maintenance, cleaning, inactive]
 *           description: Filter by table status
 *           example: "available"
 *         location:
 *           type: string
 *           enum: [indoor, outdoor, terrace, private-room, bar, main hall]
 *           description: Filter by location
 *           example: "indoor"
 *         activeOnly:
 *           type: string
 *           enum: [true, false]
 *           default: "true"
 *           description: Filter active tables only
 *           example: "true"
 *         capacity:
 *           type: integer
 *           description: Filter by capacity
 *           example: 4
 *         page:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *           example: 10
 *
 *     RegenerateQRResponse:
 *       type: object
 *       properties:
 *         qrCode:
 *           type: string
 *           description: New QR code URL
 *           example: "http://backend.url/images/table-qr/507f1f77bcf86cd799439011"
 *         qrUrl:
 *           type: string
 *           description: QR code scanning URL
 *           example: "http://frontend.url/table/507f1f77bcf86cd799439011?token=abc123"
 *         tokenExpiry:
 *           type: string
 *           format: date-time
 *           example: "2024-12-31T23:59:59.999Z"
 *         tokenDaysRemaining:
 *           type: integer
 *           example: 30
 *         tokenExpired:
 *           type: boolean
 *           example: false
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Error message"
 *         error:
 *           type: string
 *           example: "Detailed error description"
 *         data:
 *           type: object
 *           nullable: true
 *           description: Additional error data
 *
 *     SessionErrorData:
 *       type: object
 *       properties:
 *         sessionId:
 *           type: string
 *           example: "session_12345"
 *         sessionStatus:
 *           type: string
 *           example: "active"
 *
 *   parameters:
 *     TableIdPath:
 *       in: path
 *       name: id
 *       required: true
 *       schema:
 *         type: string
 *       description: Table ID
 *
 *   responses:
 *     TableNotFound:
 *       description: Table not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Table not found"
 *             error: "No table found with id 507f1f77bcf86cd799439011"
 *
 *     Unauthorized:
 *       description: Not authenticated
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Not authenticated"
 *             error: "No token provided"
 *
 *     Forbidden:
 *       description: Insufficient permissions
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Access denied"
 *             error: "Insufficient permissions for TABLE_CREATE"
 *
 *     ServerError:
 *       description: Server error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Server error"
 *             error: "Database connection failed"
 *
 *     TableNumberExists:
 *       description: Table number already exists
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Table with this number already exists"
 *             error: "Table number T01 is already in use"
 *
 *     OccupiedTableError:
 *       description: Cannot perform action on occupied table
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Cannot delete table that is currently occupied"
 *             error: "Table T01 has active orders"
 *
 *     ActiveSessionError:
 *       description: Table has active session
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Cannot change table status. There is an active session."
 *             error: "Active customer session exists"
 *             data:
 *               sessionId: "session_12345"
 *               sessionStatus: "active"
 *
 *     InvalidStatusTransition:
 *       description: Invalid status transition
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Invalid status transition from available to maintenance"
 *             error: "Available tables cannot be set to maintenance directly"
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
