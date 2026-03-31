/**
 * @swagger
 * tags:
 *   - name: Permissions
 *     description: User permission management
 */

/**
 * @swagger
 * /permissions/available:
 *   get:
 *     summary: Get all available permissions and DB-backed role defaults
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve complete list of all system permissions and role defaults resolved from application settings
 *     responses:
 *       200:
 *         description: Available permissions list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AvailablePermissions'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /permissions/user/{userId}:
 *   get:
 *     summary: Get user permissions (Admin/Manager only)
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to check permissions
 *     responses:
 *       200:
 *         description: User permissions retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPermissionsResponse'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /permissions/me:
 *   get:
 *     summary: Get my permissions
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     description: Get permissions of currently logged-in user
 *     responses:
 *       200:
 *         description: Current user's permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MyPermissionsResponse'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /permissions/user/{userId}:
 *   put:
 *     summary: Update user permissions (Admin/Manager only)
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to update permissions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePermissionsRequest'
 *     responses:
 *       200:
 *         description: User permissions updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UpdatePermissionsResponse'
 *       400:
 *         description: Invalid permissions or cannot update admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Invalid permissions: INVALID_PERMISSION"
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /permissions/user/{userId}/reset:
 *   post:
 *     summary: Reset user permissions to role defaults (Admin/Manager only)
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to reset permissions
 *     responses:
 *       200:
 *         description: Permissions reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResetPermissionsResponse'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
