/**
 * @swagger
 * /settings/public:
 *   get:
 *     summary: Get public tenant settings
 *     description: |
 *       Returns the public-facing restaurant settings for the current tenant workspace.
 *       Resolve tenant context with either `x-tenant-id` or the `x-tenant-slug` + `x-tenant-key` header pair.
 *     tags:
 *       - Settings
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - $ref: '#/components/parameters/TenantSlugHeader'
 *       - $ref: '#/components/parameters/TenantKeyHeader'
 *     responses:
 *       200:
 *         description: Public settings returned successfully.
 *       400:
 *         $ref: '#/components/responses/TenantRequiredError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /settings:
 *   get:
 *     summary: Get admin tenant settings
 *     description: |
 *       Returns full settings for the current tenant workspace.
 *       Requires authentication, tenant context, and `SYSTEM_SETTINGS`.
 *     tags:
 *       - Settings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - $ref: '#/components/parameters/TenantSlugHeader'
 *       - $ref: '#/components/parameters/TenantKeyHeader'
 *     responses:
 *       200:
 *         description: Admin settings returned successfully.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 *   put:
 *     summary: Update admin tenant settings
 *     description: |
 *       Updates settings only for the current tenant workspace.
 *       Requires authentication, tenant context, and `SYSTEM_SETTINGS`.
 *       Super admin write attempts inside tenant monitoring mode are rejected with `403`.
 *     tags:
 *       - Settings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - $ref: '#/components/parameters/TenantSlugHeader'
 *       - $ref: '#/components/parameters/TenantKeyHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               restaurant:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: Spice Villa
 *                   email:
 *                     type: string
 *                     example: contact@spicevilla.example
 *                   phone:
 *                     type: string
 *                     example: +91 9876543210
 *               businessHours:
 *                 type: object
 *               taxSettings:
 *                 type: object
 *               paymentMethods:
 *                 type: object
 *               notifications:
 *                 type: object
 *               operations:
 *                 type: object
 *           example:
 *             restaurant:
 *               name: Spice Villa
 *               email: contact@spicevilla.example
 *               phone: +91 9876543210
 *             taxSettings:
 *               taxRate: 5
 *               serviceCharge: 10
 *               currency: INR
 *               currencySymbol: "₹"
 *     responses:
 *       200:
 *         description: Settings updated successfully for the active tenant.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Missing permission or super admin write attempt in tenant monitoring mode.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
