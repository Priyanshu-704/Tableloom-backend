/**
 * @swagger
 * /tenants/register:
 *   post:
 *     summary: Register a tenant request
 *     description: Public endpoint for restaurant self-registration. Does not use tenant headers.
 *     tags:
 *       - Tenants
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantName
 *               - slug
 *               - key
 *               - adminName
 *               - adminEmail
 *             properties:
 *               restaurantName:
 *                 type: string
 *                 example: Spice Villa
 *               slug:
 *                 type: string
 *                 example: spice-villa
 *               key:
 *                 type: string
 *                 example: sv01
 *               adminName:
 *                 type: string
 *                 example: Restaurant Owner
 *               adminEmail:
 *                 type: string
 *                 example: owner@spicevilla.example
 *               phone:
 *                 type: string
 *                 example: +91 9876543210
 *     responses:
 *       201:
 *         description: Tenant registration submitted successfully.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /tenants:
 *   get:
 *     summary: List tenants
 *     description: Super-admin only endpoint that lists all tenant workspaces.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenants returned successfully.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *
 *   post:
 *     summary: Create a tenant directly
 *     description: Super-admin only endpoint for direct tenant creation and provisioning.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantName
 *               - slug
 *               - key
 *               - adminName
 *               - adminEmail
 *             properties:
 *               restaurantName:
 *                 type: string
 *                 example: Spice Villa
 *               slug:
 *                 type: string
 *                 example: spice-villa
 *               key:
 *                 type: string
 *                 example: sv01
 *               adminEmail:
 *                 type: string
 *                 example: owner@spicevilla.example
 *               adminName:
 *                 type: string
 *                 example: Tenant Admin
 *     responses:
 *       201:
 *         description: Tenant created successfully.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /tenants/{id}/overview:
 *   get:
 *     summary: Get tenant overview
 *     description: Super-admin only endpoint that returns tenant summary, settings, and recent workspace data.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/UserIdParam'
 *     responses:
 *       200:
 *         description: Tenant overview returned successfully.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *
 * /tenants/{id}/verify:
 *   patch:
 *     summary: Verify tenant
 *     description: Super-admin only endpoint that verifies a pending tenant and provisions the tenant admin.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/UserIdParam'
 *     responses:
 *       200:
 *         description: Tenant verified successfully.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
