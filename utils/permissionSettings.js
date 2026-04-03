const AppSetting = require("../models/AppSetting");
const { Permissions, RolePermissions, AllPermissions } = require("../config/permissions");
const { getCurrentTenantId } = require("./tenantContext");
const rolePermissionsCache = new Map();
const ROLE_PERMISSIONS_CACHE_TTL_MS = Number(
  process.env.ROLE_PERMISSIONS_CACHE_TTL_MS || 30000
);

const LEGACY_PERMISSION_GROUPS = {
  all: AllPermissions,
  users: [
    Permissions.USER_VIEW_ALL,
    Permissions.USER_CREATE,
    Permissions.USER_EDIT,
    Permissions.USER_DELETE,
    Permissions.USER_CHANGE_STATUS,
    Permissions.USER_CHANGE_ROLE,
    Permissions.USER_MANAGE_PERMISSIONS,
  ],
  menu: [
    Permissions.CATEGORY_TOGGLE_STATUS,
    Permissions.MENU_CREATE,
    Permissions.MENU_EDIT,
    Permissions.MENU_DELETE,
    Permissions.MENU_TOGGLE_AVAILABILITY,
    Permissions.MENU_VIEW_ALL,
    Permissions.MENU_BULK_OPERATIONS,
    Permissions.MENU_IMPORT_EXPORT,
    Permissions.MENU_STATS,
    Permissions.PRICE_STATS,
  ],
  inventory: [
    Permissions.INVENTORY_VIEW_ALL,
    Permissions.INVENTORY_CREATE,
    Permissions.INVENTORY_EDIT,
    Permissions.INVENTORY_DELETE,
    Permissions.INVENTORY_ADJUST,
    Permissions.INVENTORY_STATISTICS,
  ],
  orders: [
    Permissions.ORDER_CREATE,
    Permissions.ORDER_VIEW_ALL,
    Permissions.ORDER_VIEW_OWN,
    Permissions.ORDER_UPDATE,
    Permissions.ORDER_UPDATE_STATUS,
    Permissions.ORDER_UPDATE_ITEM_STATUS,
    Permissions.ORDER_PROCESS_PAYMENT,
    Permissions.ORDER_DELETE,
  ],
  tables: [
    Permissions.TABLE_CREATE,
    Permissions.TABLE_EDIT,
    Permissions.TABLE_DELETE,
    Permissions.TABLE_VIEW_ALL,
    Permissions.TABLE_UPDATE_STATUS,
  ],
  sessions: [
    Permissions.SESSION_VIEW_ALL,
    Permissions.SESSION_UPDATE,
    Permissions.SESSION_COMPLETE_OFFLINE,
    Permissions.SESSION_CANCEL,
    Permissions.SESSION_STATISTICS,
  ],
  kitchen: [
    Permissions.KITCHEN_VIEW_DASHBOARD,
    Permissions.KITCHEN_ACCEPT_ORDER,
    Permissions.KITCHEN_START_PREPARING,
    Permissions.KITCHEN_MARK_READY,
    Permissions.KITCHEN_MARK_SERVED,
    Permissions.KITCHEN_MANAGE_STATIONS,
  ],
  cart: [
    Permissions.CART_MANAGE,
    Permissions.CART_CHECKOUT,
    Permissions.CART_APPLY_DISCOUNT,
  ],
  feedback: [
    Permissions.FEEDBACK_VIEW_ALL,
    Permissions.FEEDBACK_RESPOND,
    Permissions.FEEDBACK_STATISTICS,
  ],
  notifications: [
    Permissions.NOTIFICATION_VIEW,
    Permissions.NOTIFICATION_ANNOUNCE,
  ],
  waiter_calls: [
    Permissions.WAITER_CALL_ACKNOWLEDGE,
    Permissions.WAITER_CALL_COMPLETE,
    Permissions.WAITER_CALL_VIEW_ALL,
    Permissions.WAITER_CALL_STATISTICS,
  ],
  reports: [
    Permissions.VIEW_REPORTS,
    Permissions.VIEW_DASHBOARD,
    Permissions.VIEW_STATISTICS,
  ],
  settings: [Permissions.SYSTEM_SETTINGS],
  backup: [Permissions.BACKUP_RESTORE],
};

const normalizePermission = (permission) =>
  String(permission || "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

const normalizeRoleKey = (role) => String(role || "").trim().toLowerCase();

const uniquePermissions = (permissions = []) => [...new Set(permissions)];

const expandPermissionEntries = (permissions = []) => {
  const expanded = [];

  permissions.forEach((permission) => {
    const normalized = normalizePermission(permission);

    if (!normalized) {
      return;
    }

    if (LEGACY_PERMISSION_GROUPS[normalized]) {
      expanded.push(...LEGACY_PERMISSION_GROUPS[normalized]);
      return;
    }

    if (AllPermissions.includes(normalized)) {
      expanded.push(normalized);
      return;
    }

    const matchedEntry = Object.entries(Permissions).find(
      ([key]) => key.toLowerCase() === normalized
    );

    if (matchedEntry) {
      expanded.push(matchedEntry[1]);
    }
  });

  return uniquePermissions(expanded);
};

const getSettingsDocument = async () =>
  AppSetting.findOne({ tenantId: getCurrentTenantId() }).lean();

const getCachedRolePermissionsMap = (tenantId) => {
  const cacheKey = String(tenantId || "global");
  const cached = rolePermissionsCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    rolePermissionsCache.delete(cacheKey);
    return null;
  }

  return cached.value;
};

const setCachedRolePermissionsMap = (tenantId, value) => {
  const cacheKey = String(tenantId || "global");
  rolePermissionsCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ROLE_PERMISSIONS_CACHE_TTL_MS,
  });

  return value;
};

const buildRolePermissionsMap = async () => {
  const tenantId = getCurrentTenantId();
  const cached = getCachedRolePermissionsMap(tenantId);
  if (cached) {
    return cached;
  }

  const settings = await getSettingsDocument();
  const storedRoles = settings?.staff?.roles || [];
  const rolePermissions = {};

  storedRoles.forEach((roleDefinition) => {
    const roleKey = normalizeRoleKey(roleDefinition?.key || roleDefinition?.name);
    if (!roleKey) {
      return;
    }

    rolePermissions[roleKey] = expandPermissionEntries(
      roleDefinition?.permissions || []
    );
  });

  Object.keys(RolePermissions).forEach((roleKey) => {
    if (!rolePermissions[roleKey] || rolePermissions[roleKey].length === 0) {
      rolePermissions[roleKey] = [...(RolePermissions[roleKey] || [])];
    }
  });

  rolePermissions.super_admin = [...AllPermissions];
  return setCachedRolePermissionsMap(tenantId, rolePermissions);
};

const getDefaultRolePermissions = async (role) => {
  const rolePermissions = await buildRolePermissionsMap();
  return rolePermissions[normalizeRoleKey(role)] || [];
};

const getEffectivePermissionsForUser = async (user) => {
  if (!user) {
    return [];
  }

  if (["super_admin", "admin"].includes(normalizeRoleKey(user.role))) {
    return [...AllPermissions];
  }

  if (Array.isArray(user.customPermissions) && user.customPermissions.length > 0) {
    return expandPermissionEntries(user.customPermissions);
  }

  return getDefaultRolePermissions(user.role);
};

const hydrateUserPermissions = async (user) => {
  if (!user) {
    return user;
  }

  const normalizedRole = normalizeRoleKey(user.role);
  if (["super_admin", "admin"].includes(normalizedRole)) {
    user.resolvedRolePermissions = [...AllPermissions];
    user.resolvedPermissions = [...AllPermissions];
    return user;
  }

  user.resolvedRolePermissions = await getDefaultRolePermissions(user.role);
  user.resolvedPermissions = await getEffectivePermissionsForUser(user);
  return user;
};

const getPermissionMetadata = async () => ({
  permissions: Permissions,
  allPermissions: [...AllPermissions],
  rolePermissions: await buildRolePermissionsMap(),
});

module.exports = {
  AllPermissions,
  Permissions,
  expandPermissionEntries,
  getDefaultRolePermissions,
  getEffectivePermissionsForUser,
  getPermissionMetadata,
  hydrateUserPermissions,
  normalizePermission,
  normalizeRoleKey,
};
