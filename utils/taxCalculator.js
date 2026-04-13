const AppSetting = require("../models/AppSetting");
const {
  getCurrentTenantId
} = require("./tenantContext");
const TAX_SETTINGS_CACHE_TTL_MS = 30 * 1000;
const DEFAULT_TAX_SETTINGS = Object.freeze({
  taxRate: 9,
  serviceCharge: 10,
  taxInclusive: false,
  currency: "INR",
  currencySymbol: "₹"
});
const currencySymbols = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED",
  SAR: "SAR",
  CAD: "CA$",
  AUD: "A$"
};
const taxSettingsCache = new Map();
const MAX_TAX_SETTINGS_CACHE_ENTRIES = Math.max(Number(process.env.TAX_SETTINGS_CACHE_MAX_ENTRIES || 200), 25);
const roundCurrency = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const clampMoney = value => Math.max(roundCurrency(value), 0);
const normalizeTaxSettings = (settings = {}) => {
  const currency = String(settings.currency || DEFAULT_TAX_SETTINGS.currency).toUpperCase();
  return {
    taxRate: clampMoney(settings.taxRate ?? DEFAULT_TAX_SETTINGS.taxRate),
    serviceCharge: clampMoney(settings.serviceCharge ?? DEFAULT_TAX_SETTINGS.serviceCharge),
    taxInclusive: Boolean(settings.taxInclusive ?? DEFAULT_TAX_SETTINGS.taxInclusive),
    currency,
    currencySymbol: settings.currencySymbol || currencySymbols[currency] || DEFAULT_TAX_SETTINGS.currencySymbol
  };
};
const getCachedTaxSettings = tenantId => {
  if (!tenantId) {
    return null;
  }
  const cacheKey = String(tenantId);
  const cached = taxSettingsCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt < Date.now()) {
    taxSettingsCache.delete(cacheKey);
    return null;
  }
  taxSettingsCache.delete(cacheKey);
  taxSettingsCache.set(cacheKey, cached);
  return cached.value;
};
const setCachedTaxSettings = (tenantId, value) => {
  if (!tenantId) {
    return;
  }
  const cacheKey = String(tenantId);
  for (const [key, entry] of taxSettingsCache.entries()) {
    if (!entry || entry.expiresAt < Date.now()) {
      taxSettingsCache.delete(key);
    }
  }
  if (taxSettingsCache.has(cacheKey)) {
    taxSettingsCache.delete(cacheKey);
  }
  taxSettingsCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + TAX_SETTINGS_CACHE_TTL_MS
  });
  while (taxSettingsCache.size > MAX_TAX_SETTINGS_CACHE_ENTRIES) {
    const oldestKey = taxSettingsCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    taxSettingsCache.delete(oldestKey);
  }
};
const invalidateTenantTaxSettings = tenantId => {
  if (!tenantId) {
    return;
  }
  taxSettingsCache.delete(String(tenantId));
};
const getTenantTaxSettings = async (options = {}) => {
  const tenantId = options.tenantId || getCurrentTenantId();
  if (!options.forceRefresh) {
    const cached = getCachedTaxSettings(tenantId);
    if (cached) {
      return cached;
    }
  }
  const settings = await AppSetting.findOne({
    key: "app-settings"
  }).select("taxSettings").lean();
  const normalized = normalizeTaxSettings(settings?.taxSettings || {});
  setCachedTaxSettings(tenantId, normalized);
  return normalized;
};
const createTaxSnapshot = (settings = {}) => {
  const normalized = normalizeTaxSettings(settings);
  return {
    taxRate: normalized.taxRate,
    serviceChargeRate: normalized.serviceCharge,
    taxInclusive: normalized.taxInclusive,
    currency: normalized.currency,
    currencySymbol: normalized.currencySymbol
  };
};
const calculatePricingBreakdown = ({
  subtotal = 0,
  discountAmount = 0,
  settings = {}
}) => {
  const normalizedSettings = normalizeTaxSettings(settings);
  const normalizedSubtotal = clampMoney(subtotal);
  const normalizedDiscount = Math.min(clampMoney(discountAmount), normalizedSubtotal);
  const taxableSubtotal = clampMoney(normalizedSubtotal - normalizedDiscount);
  let baseAmount = taxableSubtotal;
  let taxAmount = 0;
  if (normalizedSettings.taxInclusive && normalizedSettings.taxRate > 0) {
    baseAmount = roundCurrency(taxableSubtotal / (1 + normalizedSettings.taxRate / 100));
    taxAmount = clampMoney(taxableSubtotal - baseAmount);
  } else {
    taxAmount = clampMoney(taxableSubtotal * normalizedSettings.taxRate / 100);
  }
  const serviceChargeAmount = clampMoney(baseAmount * normalizedSettings.serviceCharge / 100);
  const totalAmount = normalizedSettings.taxInclusive ? clampMoney(taxableSubtotal + serviceChargeAmount) : clampMoney(taxableSubtotal + taxAmount + serviceChargeAmount);
  return {
    subtotal: normalizedSubtotal,
    discountAmount: normalizedDiscount,
    taxableSubtotal,
    baseAmount,
    taxAmount,
    serviceChargeAmount,
    totalAmount,
    ...createTaxSnapshot(normalizedSettings)
  };
};
module.exports = {
  DEFAULT_TAX_SETTINGS,
  calculatePricingBreakdown,
  createTaxSnapshot,
  getTenantTaxSettings,
  invalidateTenantTaxSettings,
  normalizeTaxSettings,
  roundCurrency
};
