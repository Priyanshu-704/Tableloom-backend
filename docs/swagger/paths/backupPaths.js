/**
 * @swagger
 * /backups/export:
 *   get:
 *     summary: Export tenant backup
 *     description: |
 *       Downloads a JSON backup for the current tenant workspace only.
 *       Requires authentication, tenant context, and `BACKUP_RESTORE`.
 *     tags:
 *       - Backups
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TenantIdHeader'
 *       - $ref: '#/components/parameters/TenantSlugHeader'
 *       - $ref: '#/components/parameters/TenantKeyHeader'
 *     responses:
 *       200:
 *         description: Backup exported successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /backups/clone:
 *   post:
 *     summary: Clone tenant backup into another MongoDB database
 *     description: |
 *       Copies the current tenant workspace collections into a target MongoDB database.
 *       Requires authentication, tenant context, and `BACKUP_RESTORE`.
 *     tags:
 *       - Backups
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
 *             required:
 *               - targetUri
 *             properties:
 *               targetUri:
 *                 type: string
 *                 example: mongodb+srv://user:password@cluster.mongodb.net/
 *               targetDbName:
 *                 type: string
 *                 example: quickbite_clone
 *               mode:
 *                 type: string
 *                 enum: [replace, append]
 *                 default: replace
 *           example:
 *             targetUri: mongodb+srv://user:password@cluster.mongodb.net/
 *             targetDbName: quickbite_clone
 *             mode: replace
 *     responses:
 *       200:
 *         description: Backup cloned successfully.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
