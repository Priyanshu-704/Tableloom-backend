const {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_DEFINITIONS,
  PERMISSION_DEFINITIONS,
  expandPermissionHierarchy,
  normalizePermissionKey,
  normalizeRoleKey,
} = require("../data/rbacCatalog");

const Permissions = Object.freeze(
  PERMISSION_DEFINITIONS.reduce((accumulator, definition) => {
    accumulator[definition.constant] = definition.key;
    return accumulator;
  }, {}),
);

const RolePermissions = Object.freeze(
  DEFAULT_ROLE_DEFINITIONS.reduce((accumulator, roleDefinition) => {
    accumulator[roleDefinition.key] = expandPermissionHierarchy(
      roleDefinition.permissions,
    );
    return accumulator;
  }, {}),
);

module.exports = {
  AllPermissions: [...ALL_PERMISSION_KEYS],
  DefaultRoleDefinitions: DEFAULT_ROLE_DEFINITIONS,
  PermissionDefinitions: PERMISSION_DEFINITIONS,
  Permissions,
  RolePermissions,
  expandPermissionHierarchy,
  normalizePermissionKey,
  normalizeRoleKey,
};
