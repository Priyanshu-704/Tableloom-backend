/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *           example: "507f1f77bcf86cd799439011"
 *         name:
 *           type: string
 *           description: User's full name
 *           example: "John Doe"
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *           example: "john@example.com"
 *         role:
 *           $ref: '#/components/schemas/Role'
 *         isActive:
 *           type: boolean
 *           description: Whether the user account is active
 *           example: true
 *         lastLogin:
 *           type: string
 *           format: date-time
 *           description: Last login timestamp
 *         loginCount:
 *           type: integer
 *           description: Number of times user has logged in
 *           example: 42
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Account creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 * 
 *     UserInput:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - role
 *       properties:
 *         name:
 *           type: string
 *           example: "Jane Doe"
 *         email:
 *           type: string
 *           format: email
 *           example: "jane@example.com"
 *         role:
 *           $ref: '#/components/schemas/Role'
 *         permissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Permission'
 *           description: Optional custom permissions (admin only)
 * 
 *     LoginCredentials:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "admin2@restaurant.com"
 *         password:
 *           type: string
 *           format: password
 *           example: "AdminTest123@$"
 * 
 *     PasswordUpdate:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *           format: password
 *           example: "OldP@ss123"
 *         newPassword:
 *           type: string
 *           format: password
 *           minLength: 8
 *           description: Must contain at least 2 uppercase, 2 lowercase, 2 numbers, and 2 special characters
 *           example: "NewSecureP@ss123!!"
 * 
 *     ForgotPassword:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 * 
 *     ResetPassword:
 *       type: object
 *       required:
 *         - password
 *       properties:
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           example: "NewP@ss123!!"
 * 
 *     StatusUpdate:
 *       type: object
 *       required:
 *         - isActive
 *       properties:
 *         isActive:
 *           type: boolean
 *           example: true
 * 
 *     RoleUpdate:
 *       type: object
 *       required:
 *         - role
 *       properties:
 *         role:
 *           $ref: '#/components/schemas/Role'
 * 
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Login successful"
 *         accessToken:
 *           type: string
 *           description: JWT access token
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         data:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: "507f1f77bcf86cd799439011"
 *             name:
 *               type: string
 *               example: "John Doe"
 *             email:
 *               type: string
 *               example: "john@example.com"
 *             role:
 *               $ref: '#/components/schemas/Role'
 */