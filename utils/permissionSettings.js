const Permission = require("../models/Permission");
const Role = require("../models/Role");
const RolePermission = require("../models/RolePermission");
const UserRole = require("../models/UserRole");
const {
  AllPermissions,
  DefaultRoleDefinitions,
  PermissionDefinitions,
  Permissions,
  RolePermissions,
  expandPermissionHierarchy,
  normalizePermissionKey,
  normalizeRoleKey,
} = require("../config/permissions");

const USER_ACCESS_CACHE = new Map();
const PERMISSION_METADATA_CACHE = new Map();
const CACHE_TTL_MS = Number(process.env.RBAC_CACHE_TTL_MS || 30000);
const RBAC_SEED_COOLDOWN_MS = Number(
  process.env.RBAC_SEED_COOLDOWN_MS || 30000,
);
const ROLE_PRIORITY = [
  "super_admin",
  "admin",
  "manager",
  "chef",
  "waiter",
  "customer",
  "user",
];
const FULL_ACCESS_ROLE_KEYS = new Set(["super_admin", "admin"]);

const getNow = () => Date.now();
let defaultRbacSeedPromise = null;
let defaultRbacSeedCompletedAt = 0;

const getCacheEntry = (cache, key) => {
  const cacheKey = String(key || "");
  const entry = cache.get(cacheKey);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= getNow()) {
    cache.delete(cacheKey);
    return null;
  }
  return entry.value;
};

const setCacheEntry = (cache, key, value, ttlMs = CACHE_TTL_MS) => {
  cache.set(String(key || ""), {
    value,
    expiresAt: getNow() + ttlMs,
  });
  return value;
};

const clearUserAccessCache = (userId) => {
  if (!userId) {
    USER_ACCESS_CACHE.clear();
    return;
  }
  USER_ACCESS_CACHE.delete(String(userId));
};

const clearPermissionMetadataCache = (tenantId = "global") => {
  PERMISSION_METADATA_CACHE.delete(String(tenantId || "global"));
};

const uniqueStrings = (values = []) =>
  [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];

const uniqueValues = (values = []) =>
  [...new Set(values.filter((value) => value !== undefined))];

const toTenantKey = (tenantId) => String(tenantId || "");

const toUserObjectId = (user) => user?._id || user?.id || null;

const normalizePermission = (permission) => normalizePermissionKey(permission);

const expandPermissionEntries = (permissions = []) =>
  uniqueStrings(expandPermissionHierarchy(permissions || []));

const sortRoleKeys = (roleKeys = []) =>
  [...new Set(roleKeys.map(normalizeRoleKey).filter(Boolean))].sort((a, b) => {
    const aIndex = ROLE_PRIORITY.indexOf(a);
    const bIndex = ROLE_PRIORITY.indexOf(b);
    const normalizedA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const normalizedB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    if (normalizedA !== normalizedB) {
      return normalizedA - normalizedB;
    }
    return a.localeCompare(b);
  });

const getPrimaryRoleKey = (requestedRole, assignedRoleKeys = []) => {
  const normalizedRequestedRole = normalizeRoleKey(requestedRole);
  const normalizedAssignedRoles = sortRoleKeys(assignedRoleKeys);
  if (
    normalizedRequestedRole &&
    normalizedAssignedRoles.includes(normalizedRequestedRole)
  ) {
    return normalizedRequestedRole;
  }
  return normalizedAssignedRoles[0] || normalizedRequestedRole || "user";
};

const areSamePermissionSets = (left = [], right = []) => {
  const normalizedLeft = uniqueStrings(left).sort();
  const normalizedRight = uniqueStrings(right).sort();
  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

const getRolePermissionDocMap = async () => {
  const permissions = await Permission.find({})
    .select("_id key name description")
    .lean();
  return permissions.reduce((accumulator, permission) => {
    accumulator[permission.key] = permission;
    return accumulator;
  }, {});
};

const getRoleMapByKey = (roles = []) =>
  roles.reduce((accumulator, role) => {
    const key = normalizeRoleKey(role?.key);
    if (!key) {
      return accumulator;
    }
    const currentMatch = accumulator[key];
    const currentIsTenantSpecific = Boolean(currentMatch?.tenantId);
    const nextIsTenantSpecific = Boolean(role?.tenantId);
    if (!currentMatch || (!currentIsTenantSpecific && nextIsTenantSpecific)) {
      accumulator[key] = role;
    }
    return accumulator;
  }, {});

const ensureDefaultRbacSeedData = async ({ force = false } = {}) => {
  if (
    !force &&
    defaultRbacSeedCompletedAt > 0 &&
    getNow() - defaultRbacSeedCompletedAt < RBAC_SEED_COOLDOWN_MS
  ) {
    return;
  }

  if (defaultRbacSeedPromise) {
    return defaultRbacSeedPromise;
  }

  defaultRbacSeedPromise = (async () => {
    const permissionBulkOps = PermissionDefinitions.map((definition) => ({
      updateOne: {
        filter: {
          key: definition.key,
        },
        update: {
          $set: {
            name: definition.name,
            description: definition.description,
          },
          $setOnInsert: {
            key: definition.key,
          },
        },
        upsert: true,
      },
    }));

    if (permissionBulkOps.length > 0) {
      await Permission.bulkWrite(permissionBulkOps, {
        ordered: false,
      });
    }

    const roleBulkOps = DefaultRoleDefinitions.map((definition) => ({
      updateOne: {
        filter: {
          key: definition.key,
          tenantId: null,
        },
        update: {
          $set: {
            name: definition.name,
            description: definition.description,
            isSystem: definition.isSystem !== false,
            isActive: true,
            userId: null,
          },
          $setOnInsert: {
            key: definition.key,
            tenantId: null,
          },
        },
        upsert: true,
      },
    }));

    if (roleBulkOps.length > 0) {
      await Role.bulkWrite(roleBulkOps, {
        ordered: false,
      });
    }

    const [permissions, roles] = await Promise.all([
      Permission.find({}).select("_id key").lean(),
      Role.find({
        tenantId: null,
        key: {
          $in: DefaultRoleDefinitions.map(
            (roleDefinition) => roleDefinition.key,
          ),
        },
      })
        .select("_id key")
        .lean(),
    ]);

    const permissionIdByKey = permissions.reduce((accumulator, permission) => {
      accumulator[permission.key] = permission._id;
      return accumulator;
    }, {});
    const roleIdByKey = roles.reduce((accumulator, role) => {
      accumulator[role.key] = role._id;
      return accumulator;
    }, {});

    const rolePermissionBulkOps = [];
    const synchronizedRoleIds = [];
    DefaultRoleDefinitions.forEach((definition) => {
      const roleId = roleIdByKey[definition.key];
      if (!roleId) {
        return;
      }
      synchronizedRoleIds.push(String(roleId));
      const normalizedPermissionKeys = expandPermissionEntries(
        definition.permissions,
      );
      const permissionIds = normalizedPermissionKeys
        .map((permissionKey) => permissionIdByKey[permissionKey])
        .filter(Boolean);
      rolePermissionBulkOps.push({
        deleteMany: {
          filter: {
            roleId,
            permissionId: {
              $nin: permissionIds,
            },
          },
        },
      });
      expandPermissionEntries(definition.permissions).forEach((permissionKey) => {
        const permissionId = permissionIdByKey[permissionKey];
        if (!permissionId) {
          return;
        }
        rolePermissionBulkOps.push({
          updateOne: {
            filter: {
              roleId,
              permissionId,
            },
            update: {
              $setOnInsert: {
                roleId,
                permissionId,
              },
            },
            upsert: true,
          },
        });
      });
    });

    if (rolePermissionBulkOps.length > 0) {
      await RolePermission.bulkWrite(rolePermissionBulkOps, {
        ordered: false,
      });
    }

    if (synchronizedRoleIds.length > 0) {
      clearPermissionMetadataCache();
      clearUserAccessCache();
    }

    defaultRbacSeedCompletedAt = getNow();
  })()
    .finally(() => {
      defaultRbacSeedPromise = null;
    });

  return defaultRbacSeedPromise;
};

const findRolesByKeys = async (roleKeys = [], tenantId = null) => {
  const normalizedRoleKeys = uniqueStrings(roleKeys.map(normalizeRoleKey));
  if (normalizedRoleKeys.length === 0) {
    return [];
  }
  const roles = await Role.find({
    key: {
      $in: normalizedRoleKeys,
    },
    tenantId: {
      $in: uniqueValues([tenantId || null, null]),
    },
    isActive: {
      $ne: false,
    },
  })
    .select("_id key name description tenantId isSystem isActive userId")
    .lean();

  return Object.values(getRoleMapByKey(roles));
};

const getRolePermissionsMapByRoleId = async (roleIds = []) => {
  if (!roleIds.length) {
    return {};
  }
  const [rolePermissions, permissions] = await Promise.all([
    RolePermission.find({
      roleId: {
        $in: roleIds,
      },
    })
      .select("roleId permissionId")
      .lean(),
    Permission.find({}).select("_id key").lean(),
  ]);

  const permissionKeyById = permissions.reduce((accumulator, permission) => {
    accumulator[String(permission._id)] = permission.key;
    return accumulator;
  }, {});

  return rolePermissions.reduce((accumulator, entry) => {
    const roleId = String(entry.roleId);
    const permissionKey = permissionKeyById[String(entry.permissionId)];
    if (!permissionKey) {
      return accumulator;
    }
    if (!accumulator[roleId]) {
      accumulator[roleId] = [];
    }
    accumulator[roleId].push(permissionKey);
    return accumulator;
  }, {});
};

const getDefaultRolePermissions = async (role, tenantId = null) => {
  await ensureDefaultRbacSeedData();
  const normalizedRoleKey = normalizeRoleKey(role);
  if (!normalizedRoleKey) {
    return [];
  }
  if (FULL_ACCESS_ROLE_KEYS.has(normalizedRoleKey)) {
    return [...AllPermissions];
  }

  const matchedRoles = await findRolesByKeys([normalizedRoleKey], tenantId);
  const matchedRole = matchedRoles[0];
  if (!matchedRole) {
    return [...(RolePermissions[normalizedRoleKey] || [])];
  }

  const permissionMap = await getRolePermissionsMapByRoleId([matchedRole._id]);
  return expandPermissionEntries(permissionMap[String(matchedRole._id)] || []);
};

const getUserRoleAssignments = async (user) => {
  await ensureDefaultRbacSeedData();
  if (!user || !toUserObjectId(user)) {
    return [];
  }

  const userId = toUserObjectId(user);
  const tenantId = user?.tenantId || null;
  const assignments = await UserRole.find({
    userId,
  })
    .select("roleId")
    .lean();

  let assignedRoles = [];
  if (assignments.length > 0) {
    const assignedRoleIds = assignments.map((assignment) => assignment.roleId);
    assignedRoles = await Role.find({
      _id: {
        $in: assignedRoleIds,
      },
      isActive: {
        $ne: false,
      },
    })
      .select("_id key name description tenantId isSystem isActive userId")
      .lean();
  }

  if (assignedRoles.length === 0 && user?.role) {
    const primaryRole = (await findRolesByKeys([user.role], tenantId))[0];
    if (primaryRole) {
      await UserRole.updateOne(
        {
          userId,
          roleId: primaryRole._id,
        },
        {
          $setOnInsert: {
            userId,
            roleId: primaryRole._id,
            assignedBy: user?.updatedBy || user?._id || null,
          },
        },
        {
          upsert: true,
        },
      );
      assignedRoles = [primaryRole];
    }
  }

  return assignedRoles;
};

const getOrCreateCustomRoleForUser = async (user, permissions = []) => {
  const userId = toUserObjectId(user);
  if (!userId) {
    return null;
  }

  const roleKey = `custom.user.${String(userId).toLowerCase()}`;
  const roleName =
    user?.name || user?.email
      ? `${user?.name || user?.email} Custom Access`
      : "Custom Access";

  const role = await Role.findOneAndUpdate(
    {
      key: roleKey,
      tenantId: user?.tenantId || null,
    },
    {
      $set: {
        name: roleName,
        description: "Custom permission bundle generated for a single user.",
        isSystem: false,
        isActive: true,
        userId,
      },
      $setOnInsert: {
        key: roleKey,
        tenantId: user?.tenantId || null,
      },
    },
    {
      new: true,
      upsert: true,
    },
  );

  await setRolePermissions(role._id, permissions);
  await UserRole.updateOne(
    {
      userId,
      roleId: role._id,
    },
    {
      $setOnInsert: {
        userId,
        roleId: role._id,
        assignedBy: user?.updatedBy || user?._id || null,
      },
    },
    {
      upsert: true,
    },
  );

  return role;
};

const removeCustomRoleForUser = async (user) => {
  const userId = toUserObjectId(user);
  if (!userId) {
    return;
  }
  const customRoles = await Role.find({
    tenantId: user?.tenantId || null,
    userId,
  })
    .select("_id")
    .lean();
  if (!customRoles.length) {
    return;
  }
  const customRoleIds = customRoles.map((role) => role._id);
  await Promise.all([
    UserRole.deleteMany({
      userId,
      roleId: {
        $in: customRoleIds,
      },
    }),
    RolePermission.deleteMany({
      roleId: {
        $in: customRoleIds,
      },
    }),
    Role.deleteMany({
      _id: {
        $in: customRoleIds,
      },
    }),
  ]);
};

const syncLegacyCustomPermissions = async (user) => {
  if (!user || !Array.isArray(user.customPermissions)) {
    return;
  }

  const normalizedCustomPermissions = expandPermissionEntries(user.customPermissions);
  const defaultPermissions = await getDefaultRolePermissions(
    user.role,
    user?.tenantId || null,
  );

  if (
    normalizedCustomPermissions.length === 0 ||
    areSamePermissionSets(normalizedCustomPermissions, defaultPermissions)
  ) {
    await removeCustomRoleForUser(user);
    return;
  }

  await getOrCreateCustomRoleForUser(user, normalizedCustomPermissions);
};

const getResolvedUserAccess = async (user) => {
  if (!user || !toUserObjectId(user)) {
    return {
      permissions: [],
      roles: [],
      primaryRole: normalizeRoleKey(user?.role),
    };
  }

  const userId = String(toUserObjectId(user));
  const cached = getCacheEntry(USER_ACCESS_CACHE, userId);
  if (cached) {
    return cached;
  }

  await syncLegacyCustomPermissions(user);
  const roles = await getUserRoleAssignments(user);
  const roleIds = roles.map((role) => role._id);
  const rolePermissionMap = await getRolePermissionsMapByRoleId(roleIds);
  const roleKeys = roles.map((role) => normalizeRoleKey(role.key));
  const hasFullAccessRole =
    roleKeys.some((roleKey) => FULL_ACCESS_ROLE_KEYS.has(roleKey)) ||
    FULL_ACCESS_ROLE_KEYS.has(normalizeRoleKey(user?.role));
  const permissions = hasFullAccessRole
    ? [...AllPermissions]
    : uniqueStrings(
        roles.flatMap((role) => rolePermissionMap[String(role._id)] || []),
      );
  const primaryRole = getPrimaryRoleKey(user.role, roleKeys);

  const resolvedAccess = {
    permissions: expandPermissionEntries(permissions),
    roles: roles.map((role) => ({
      _id: role._id,
      key: normalizeRoleKey(role.key),
      name: role.name,
      description: role.description || "",
      tenantId: role.tenantId || null,
      isSystem: role.isSystem !== false,
      isCustom: Boolean(role.userId),
    })),
    primaryRole,
  };

  return setCacheEntry(USER_ACCESS_CACHE, userId, resolvedAccess);
};

const getEffectivePermissionsForUser = async (user) => {
  const resolvedAccess = await getResolvedUserAccess(user);
  return resolvedAccess.permissions;
};

const hydrateUserPermissions = async (user) => {
  if (!user) {
    return user;
  }

  const resolvedAccess = await getResolvedUserAccess(user);
  const primaryRole = resolvedAccess.primaryRole || normalizeRoleKey(user.role);
  user.role = primaryRole;
  user.roles = resolvedAccess.roles;
  user.roleKeys = resolvedAccess.roles.map((role) => role.key);
  user.resolvedRolePermissions = await getDefaultRolePermissions(
    primaryRole,
    user?.tenantId || null,
  );
  user.resolvedPermissions = resolvedAccess.permissions;
  return user;
};

const getPermissionMetadata = async (tenantId = null) => {
  const cacheKey = toTenantKey(tenantId) || "global";
  const cached = getCacheEntry(PERMISSION_METADATA_CACHE, cacheKey);
  if (cached) {
    return cached;
  }

  await ensureDefaultRbacSeedData();
  const [dbPermissions, roles] = await Promise.all([
    Permission.find({}).select("name key description").sort({ key: 1 }).lean(),
    Role.find({
      tenantId: {
        $in: uniqueValues([tenantId || null, null]),
      },
      isActive: {
        $ne: false,
      },
    })
      .select("_id key name description tenantId isSystem userId")
      .sort({
        isSystem: -1,
        name: 1,
      })
      .lean(),
  ]);

  const rolePermissionMap = await getRolePermissionsMapByRoleId(
    roles.map((role) => role._id),
  );

  const metadata = {
    permissions: Permissions,
    allPermissions: dbPermissions.map((permission) => permission.key),
    permissionDetails: dbPermissions.map((permission) => {
      const definition = PermissionDefinitions.find(
        (entry) => entry.key === permission.key,
      );
      return {
        ...permission,
        impliedPermissions: definition?.impliedPermissions || [],
        legacyKeys: definition?.legacyKeys || [],
        constant: definition?.constant || "",
      };
    }),
    rolePermissions: roles.reduce((accumulator, role) => {
      const normalizedRoleKey = normalizeRoleKey(role.key);
      accumulator[normalizedRoleKey] = FULL_ACCESS_ROLE_KEYS.has(
        normalizedRoleKey,
      )
        ? [...AllPermissions]
        : uniqueStrings(
            expandPermissionEntries(rolePermissionMap[String(role._id)] || []),
          );
      return accumulator;
    }, {}),
    roles: roles.map((role) => ({
      _id: role._id,
      key: normalizeRoleKey(role.key),
      name: role.name,
      description: role.description || "",
      tenantId: role.tenantId || null,
      isSystem: role.isSystem !== false,
      isCustom: Boolean(role.userId),
    })),
  };

  return setCacheEntry(PERMISSION_METADATA_CACHE, cacheKey, metadata);
};

const getRoleById = async (roleId) =>
  Role.findById(roleId)
    .select("_id key name description tenantId isSystem isActive userId")
    .lean();

const setRolePermissions = async (roleId, permissions = []) => {
  if (!roleId) {
    return [];
  }
  await ensureDefaultRbacSeedData();
  const normalizedPermissionKeys = expandPermissionEntries(permissions);
  const permissionDocs = await Permission.find({
    key: {
      $in: normalizedPermissionKeys,
    },
  })
    .select("_id key")
    .lean();

  const permissionIds = permissionDocs.map((permission) => permission._id);
  await RolePermission.deleteMany({
    roleId,
    permissionId: {
      $nin: permissionIds,
    },
  });

  if (permissionIds.length > 0) {
    await RolePermission.bulkWrite(
      permissionIds.map((permissionId) => ({
        updateOne: {
          filter: {
            roleId,
            permissionId,
          },
          update: {
            $setOnInsert: {
              roleId,
              permissionId,
            },
          },
          upsert: true,
        },
      })),
      {
        ordered: false,
      },
    );
  } else {
    await RolePermission.deleteMany({
      roleId,
    });
  }

  clearPermissionMetadataCache();
  return permissionDocs.map((permission) => permission.key);
};

const assignRolesToUser = async (
  user,
  roleKeys = [],
  { preserveCustomRoles = true, assignedBy = null } = {},
) => {
  if (!user || !toUserObjectId(user)) {
    return [];
  }

  await ensureDefaultRbacSeedData();

  const normalizedRoleKeys = sortRoleKeys(roleKeys);
  const matchedRoles = await findRolesByKeys(normalizedRoleKeys, user.tenantId);
  const matchedRoleIds = matchedRoles.map((role) => String(role._id));
  const currentRoles = await Role.find({
    _id: {
      $in: (
        await UserRole.find({
          userId: toUserObjectId(user),
        })
          .select("roleId")
          .lean()
      ).map((entry) => entry.roleId),
    },
  })
    .select("_id userId")
    .lean();

  const customRoleIds = preserveCustomRoles
    ? currentRoles
        .filter((role) => Boolean(role.userId))
        .map((role) => String(role._id))
    : [];

  await UserRole.deleteMany({
    userId: toUserObjectId(user),
    roleId: {
      $nin: customRoleIds,
    },
  });

  const newRoleIds = uniqueStrings([...matchedRoleIds, ...customRoleIds]);
  if (newRoleIds.length > 0) {
    await UserRole.bulkWrite(
      newRoleIds.map((roleId) => ({
        updateOne: {
          filter: {
            userId: toUserObjectId(user),
            roleId,
          },
          update: {
            $setOnInsert: {
              userId: toUserObjectId(user),
              roleId,
              assignedBy,
            },
          },
          upsert: true,
        },
      })),
      {
        ordered: false,
      },
    );
  }

  user.role = getPrimaryRoleKey(user.role, matchedRoles.map((role) => role.key));
  clearUserAccessCache(toUserObjectId(user));
  return matchedRoles;
};

const updateUserCustomPermissions = async (
  user,
  permissions = [],
  updatedBy = null,
) => {
  if (!user || !toUserObjectId(user)) {
    return [];
  }

  const normalizedPermissions = expandPermissionEntries(permissions);
  const defaultPermissions = await getDefaultRolePermissions(
    user.role,
    user?.tenantId || null,
  );

  if (
    normalizedPermissions.length === 0 ||
    areSamePermissionSets(normalizedPermissions, defaultPermissions)
  ) {
    await removeCustomRoleForUser(user);
  } else {
    const customRole = await getOrCreateCustomRoleForUser(user, normalizedPermissions);
    await UserRole.updateOne(
      {
        userId: toUserObjectId(user),
        roleId: customRole._id,
      },
      {
        $set: {
          assignedBy: updatedBy,
        },
      },
      {
        upsert: true,
      },
    );
  }

  user.customPermissions = normalizedPermissions;
  user.permissionsUpdatedBy = updatedBy || null;
  user.permissionsUpdatedAt = new Date();
  clearUserAccessCache(toUserObjectId(user));
  return getEffectivePermissionsForUser(user);
};

const resetUserCustomPermissions = async (user, updatedBy = null) => {
  if (!user || !toUserObjectId(user)) {
    return [];
  }
  await removeCustomRoleForUser(user);
  user.customPermissions = [];
  user.permissionsUpdatedBy = updatedBy || null;
  user.permissionsUpdatedAt = new Date();
  clearUserAccessCache(toUserObjectId(user));
  return getEffectivePermissionsForUser(user);
};

const userHasPermission = (user, permission) => {
  const normalizedTarget = normalizePermission(permission);
  if (!normalizedTarget) {
    return true;
  }
  const effectivePermissions = expandPermissionEntries(
    user?.resolvedPermissions || user?.permissions || user?.customPermissions || [],
  );
  return effectivePermissions.includes(normalizedTarget);
};

const userHasAnyPermission = (user, permissions = []) =>
  permissions.some((permission) => userHasPermission(user, permission));

module.exports = {
  AllPermissions,
  Permissions,
  RolePermissions,
  assignRolesToUser,
  clearPermissionMetadataCache,
  clearUserAccessCache,
  ensureDefaultRbacSeedData,
  expandPermissionEntries,
  getDefaultRolePermissions,
  getEffectivePermissionsForUser,
  getPermissionMetadata,
  getResolvedUserAccess,
  getRoleById,
  hydrateUserPermissions,
  normalizePermission,
  normalizeRoleKey,
  resetUserCustomPermissions,
  setRolePermissions,
  updateUserCustomPermissions,
  userHasAnyPermission,
  userHasPermission,
};
