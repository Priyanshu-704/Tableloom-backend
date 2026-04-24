const DEFAULT_ROUTE_RESOURCE = "general";
const RESPONSE_CACHE_PREFIX = "response:";
const DEFAULT_RESPONSE_CACHE_TTL_MS = Math.max(
  Number(process.env.RESPONSE_CACHE_TTL_MS || 15000),
  1000,
);

const RESOURCE_CACHE_TTLS_MS = {
  menu: 20000,
  settings: 30000,
  dashboard: 15000,
  reports: 15000,
  "waiter-calls": 8000,
  notifications: 5000,
  orders: 5000,
  cart: 5000,
  customers: 8000,
  bills: 10000,
  kitchen: 5000,
  "kitchen-stations": 15000,
  inventory: 10000,
  tables: 10000,
  users: 10000,
  permissions: 10000,
  tenants: 20000,
  support: 10000,
};

const NON_INVALIDATING_MUTATION_PATTERNS = [
  /^\/users\/login\/?$/i,
  /^\/users\/logout\/?$/i,
  /^\/users\/refresh-token\/?$/i,
  /^\/users\/forgot-password\/?$/i,
  /^\/users\/reset-password\/[^/]+\/?$/i,
  /^\/users\/validate-reset-token\/[^/]+\/?$/i,
  /^\/reports\/analytics\/generate\/?$/i,
];

const RESPONSE_CACHE_BYPASS_PATTERNS = [
  /^\/customers\/session\/[^/]+\/?$/i,
  /^\/bills\/session\/[^/]+\/?$/i,
  /^\/images(?:\/|$)/i,
  /^\/backups\/export\/?$/i,
];

const MUTATION_RESOURCE_TAGS = {
  tenants: [
    "resource:tenants",
    "resource:users",
    "resource:permissions",
    "resource:settings",
  ],
  users: ["resource:users", "resource:permissions", "resource:notifications"],
  permissions: ["resource:permissions", "resource:users"],
  support: ["resource:support"],
  menu: [
    "resource:menu",
    "resource:kitchen-stations",
    "resource:dashboard",
    "resource:reports",
  ],
  inventory: [
    "resource:inventory",
    "resource:menu",
    "resource:dashboard",
    "resource:reports",
  ],
  tables: [
    "resource:tables",
    "resource:customers",
    "resource:dashboard",
    "resource:reports",
  ],
  customers: [
    "resource:customers",
    "resource:orders",
    "resource:bills",
    "resource:dashboard",
    "resource:reports",
    "resource:notifications",
  ],
  cart: [
    "resource:cart",
    "resource:orders",
    "resource:bills",
    "resource:customers",
    "resource:dashboard",
    "resource:reports",
  ],
  orders: [
    "resource:orders",
    "resource:kitchen",
    "resource:bills",
    "resource:customers",
    "resource:dashboard",
    "resource:reports",
    "resource:notifications",
  ],
  feedback: ["resource:feedback", "resource:dashboard", "resource:reports"],
  "waiter-calls": [
    "resource:waiter-calls",
    "resource:dashboard",
    "resource:reports",
    "resource:notifications",
  ],
  kitchen: [
    "resource:kitchen",
    "resource:orders",
    "resource:dashboard",
    "resource:reports",
  ],
  "kitchen-stations": [
    "resource:kitchen-stations",
    "resource:kitchen",
    "resource:menu",
    "resource:dashboard",
    "resource:reports",
  ],
  images: ["resource:menu", "resource:tables", "resource:settings"],
  bills: [
    "resource:bills",
    "resource:orders",
    "resource:customers",
    "resource:dashboard",
    "resource:reports",
  ],
  notifications: ["resource:notifications", "resource:dashboard"],
  "push-notifications": ["resource:notifications", "resource:users"],
  settings: ["resource:settings", "resource:dashboard", "resource:reports"],
  dashboard: ["resource:dashboard"],
  reports: ["resource:reports"],
  backups: ["resource:backups"],
};

const normalizeTenantTag = (tenantId = null) =>
  `tenant:${tenantId || "global"}`;

const buildResourceTag = (resource = DEFAULT_ROUTE_RESOURCE) =>
  `resource:${resource || DEFAULT_ROUTE_RESOURCE}`;

const normalizePathname = (pathname = "/") => {
  const normalized = String(pathname || "/").trim() || "/";
  if (normalized === "/") {
    return normalized;
  }
  return normalized.replace(/\/+$/, "") || "/";
};

const getRequestPathname = (req = {}) => normalizePathname(req.path || req.url);

const getPrimaryResource = (pathname = "/") => {
  const [resource = DEFAULT_ROUTE_RESOURCE] = normalizePathname(pathname)
    .split("/")
    .filter(Boolean);
  return resource || DEFAULT_ROUTE_RESOURCE;
};

const getTenantScopedTags = (tenantId = null, tags = []) =>
  [...new Set([normalizeTenantTag(tenantId), ...tags.filter(Boolean)])];

const getResponseCacheTags = (req = {}, additionalTags = []) => {
  const resource = getPrimaryResource(getRequestPathname(req));
  return getTenantScopedTags(req.tenantId || req.tenant?._id, [
    buildResourceTag(resource),
    ...additionalTags,
  ]);
};

const getInvalidationTagsForRequest = (req = {}) => {
  const resource = getPrimaryResource(getRequestPathname(req));
  return getTenantScopedTags(req.tenantId || req.tenant?._id, [
    ...(MUTATION_RESOURCE_TAGS[resource] || [buildResourceTag(resource)]),
  ]);
};

const shouldBypassResponseCache = (req = {}) => {
  const pathname = getRequestPathname(req);
  return RESPONSE_CACHE_BYPASS_PATTERNS.some((pattern) =>
    pattern.test(pathname),
  );
};

const shouldInvalidateMutation = (req = {}) => {
  const pathname = getRequestPathname(req);
  return !NON_INVALIDATING_MUTATION_PATTERNS.some((pattern) =>
    pattern.test(pathname),
  );
};

const getResponseCacheTtlMs = (req = {}) => {
  const resource = getPrimaryResource(getRequestPathname(req));
  return RESOURCE_CACHE_TTLS_MS[resource] || DEFAULT_RESPONSE_CACHE_TTL_MS;
};

module.exports = {
  RESPONSE_CACHE_PREFIX,
  buildResourceTag,
  getInvalidationTagsForRequest,
  getPrimaryResource,
  getRequestPathname,
  getResponseCacheTags,
  getResponseCacheTtlMs,
  normalizeTenantTag,
  shouldBypassResponseCache,
  shouldInvalidateMutation,
};
