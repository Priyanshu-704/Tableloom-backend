const normalizeTenantSlug = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
const normalizeTenantKey = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TENANT_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isTenantSlugValid = (value = "") =>
  TENANT_SLUG_PATTERN.test(
    String(value || "")
      .trim()
      .toLowerCase(),
  );
const isTenantKeyValid = (value = "") =>
  TENANT_KEY_PATTERN.test(
    String(value || "")
      .trim()
      .toLowerCase(),
  );
module.exports = {
  normalizeTenantSlug,
  normalizeTenantKey,
  isTenantSlugValid,
  isTenantKeyValid,
  TENANT_SLUG_PATTERN,
  TENANT_KEY_PATTERN,
};
