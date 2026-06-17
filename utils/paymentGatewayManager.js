const crypto = require("crypto");
const AppSetting = require("../models/AppSetting");
const Branch = require("../models/Branch");
const Tenant = require("../models/Tenant");

const DEFAULT_PAYMENT_METHODS = Object.freeze({
  cash: true,
  online: true,
  card: true,
  upi: true,
  digitalWallet: false,
  splitBill: true,
});

const CHECKOUT_METHOD_TO_SETTING_FIELD = Object.freeze({
  cash: "cash",
  online: "online",
  card: "card",
  upi: "upi",
  wallet: "digitalWallet",
});

const MANUAL_METHOD_TO_SETTING_FIELD = Object.freeze({
  cash: "cash",
  card: "card",
  upi: "upi",
  wallet: "digitalWallet",
});

const normalizePaymentMethods = (paymentMethods = {}) => {
  const merged = {
    ...DEFAULT_PAYMENT_METHODS,
    ...(paymentMethods || {}),
  };

  return {
    cash: merged.cash !== false,
    online: merged.online !== false,
    card: merged.card !== false,
    upi: merged.upi !== false,
    digitalWallet: merged.digitalWallet === true,
    splitBill: merged.splitBill !== false,
  };
};

const hasEncryptedValue = (value = "") => Boolean(String(value || "").trim());

const maskPaymentCredential = (value = "") => {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}${"*".repeat(
      Math.max(normalized.length - 4, 1),
    )}${normalized.slice(-2)}`;
  }

  return `${normalized.slice(0, 4)}${"*".repeat(
    Math.max(normalized.length - 8, 4),
  )}${normalized.slice(-4)}`;
};

const getPaymentEncryptionKey = () => {
  const secretSource = String(
    process.env.PAYMENT_CONFIG_ENCRYPTION_KEY || process.env.JWT_SECRET || "",
  ).trim();

  if (!secretSource) {
    throw new Error(
      "Secure payment credential encryption is not configured. Set PAYMENT_CONFIG_ENCRYPTION_KEY.",
    );
  }

  return crypto.createHash("sha256").update(secretSource).digest();
};

const encryptPaymentCredential = (value = "") => {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "";
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    getPaymentEncryptionKey(),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "enc",
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
};

const decryptPaymentCredential = (payload = "") => {
  const normalized = String(payload || "").trim();

  if (!normalized) {
    return "";
  }

  const [prefix, ivHex, authTagHex, encryptedHex] = normalized.split(":");

  if (
    prefix !== "enc" ||
    !ivHex ||
    !authTagHex ||
    !encryptedHex
  ) {
    return "";
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getPaymentEncryptionKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

const buildPaymentGatewaySummary = (tenant = {}) => {
  const paymentGateway = tenant?.paymentGateway || {};
  const credentialsConfigured =
    hasEncryptedValue(paymentGateway.keyIdEncrypted) &&
    hasEncryptedValue(paymentGateway.keySecretEncrypted);
  const provider = credentialsConfigured
    ? String(paymentGateway.provider || "razorpay").trim().toLowerCase()
    : "none";
  const status = credentialsConfigured
    ? String(paymentGateway.status || "active").trim().toLowerCase()
    : "inactive";
  const enabled =
    credentialsConfigured && provider === "razorpay" && status === "active";

  return {
    provider,
    status,
    enabled,
    credentialsConfigured,
    keyIdMask: paymentGateway.keyIdMask || "",
    configuredAt: paymentGateway.configuredAt || null,
    updatedAt: paymentGateway.updatedAt || null,
  };
};

const applyPaymentGatewayRestrictions = (
  paymentMethods = {},
  paymentGatewaySummary = {},
) => {
  const normalized = normalizePaymentMethods(paymentMethods);

  if (paymentGatewaySummary?.enabled) {
    return normalized;
  }

  return {
    ...normalized,
    cash: true,
    online: false,
    card: false,
    upi: false,
    digitalWallet: false,
  };
};

const validateEnabledPaymentMethods = (paymentMethods = {}) => {
  const normalized = normalizePaymentMethods(paymentMethods);
  const enabledCount = [
    normalized.cash,
    normalized.online,
    normalized.card,
    normalized.upi,
    normalized.digitalWallet,
  ].filter(Boolean).length;

  if (enabledCount === 0) {
    throw new Error("Enable at least one payment method for this tenant.");
  }

  return normalized;
};

const loadTenantPaymentConfiguration = async (
  tenantId,
  {
    branchId = null,
    branchDocument = null,
    tenantDocument = null,
    settingsDocument = null,
  } = {},
) => {
  if (!tenantId) {
    return {
      tenant: null,
      settings: null,
      paymentGateway: buildPaymentGatewaySummary(null),
      paymentMethods: applyPaymentGatewayRestrictions(
        DEFAULT_PAYMENT_METHODS,
        buildPaymentGatewaySummary(null),
      ),
    };
  }

  const [tenant, branch, settings] = await Promise.all([
    tenantDocument
      ? Promise.resolve(tenantDocument)
      : Tenant.findById(tenantId)
          .select("paymentGateway status subscription")
          .lean(),
    branchDocument
      ? Promise.resolve(branchDocument)
      : branchId
        ? Branch.findOne({
            _id: branchId,
            tenantId,
          })
            .select("paymentGateway status type")
            .lean()
        : Promise.resolve(null),
    settingsDocument
      ? Promise.resolve(settingsDocument)
      : branchId
        ? AppSetting.findOne({
            tenantId,
            branchId,
            key: "app-settings",
          }).lean()
        : AppSetting.findOne({
            tenantId,
            branchId: null,
            key: "app-settings",
          }).lean(),
  ]);

  const fallbackSettings =
    settings ||
    (branchId
      ? await AppSetting.findOne({
          tenantId,
          branchId: null,
          key: "app-settings",
        }).lean()
      : null);
  const branchPaymentGateway = buildPaymentGatewaySummary(branch);
  const tenantPaymentGateway = buildPaymentGatewaySummary(tenant);
  const paymentGateway = branchPaymentGateway.enabled
    ? branchPaymentGateway
    : tenantPaymentGateway;
  const paymentMethods = applyPaymentGatewayRestrictions(
    fallbackSettings?.paymentMethods,
    paymentGateway,
  );

  return {
    tenant,
    branch,
    settings: fallbackSettings,
    paymentGateway,
    paymentMethods,
  };
};

const isCheckoutMethodAllowed = (paymentConfiguration = {}, method = "") => {
  const normalizedMethod = String(method || "")
    .trim()
    .toLowerCase();
  const settingField = CHECKOUT_METHOD_TO_SETTING_FIELD[normalizedMethod];

  if (!settingField) {
    return false;
  }

  return Boolean(paymentConfiguration?.paymentMethods?.[settingField]);
};

const isManualMethodAllowed = (paymentConfiguration = {}, method = "") => {
  const normalizedMethod = String(method || "")
    .trim()
    .toLowerCase();
  const settingField = MANUAL_METHOD_TO_SETTING_FIELD[normalizedMethod];

  if (!settingField) {
    return false;
  }

  return Boolean(paymentConfiguration?.paymentMethods?.[settingField]);
};

const getTenantRazorpayCredentials = async (
  tenantId,
  tenantDocument = null,
  { branchId = null, branchDocument = null } = {},
) => {
  const [tenant, branch] = await Promise.all([
    tenantDocument
      ? Promise.resolve(tenantDocument)
      : Tenant.findById(tenantId).select("paymentGateway").lean(),
    branchDocument
      ? Promise.resolve(branchDocument)
      : branchId
        ? Branch.findOne({
            _id: branchId,
            tenantId,
          })
            .select("paymentGateway")
            .lean()
        : Promise.resolve(null),
  ]);

  const branchPaymentGateway = buildPaymentGatewaySummary(branch);
  const tenantPaymentGateway = buildPaymentGatewaySummary(tenant);
  const credentialOwner = branchPaymentGateway.enabled ? branch : tenant;
  const paymentGateway = branchPaymentGateway.enabled
    ? branchPaymentGateway
    : tenantPaymentGateway;

  if (!paymentGateway.enabled) {
    throw new Error(
      "This tenant has not configured a payment gateway yet. Only cash payments are available.",
    );
  }

  if (paymentGateway.provider !== "razorpay") {
    throw new Error("Only Razorpay is supported for tenant payment checkout.");
  }

  const keyId = decryptPaymentCredential(
    credentialOwner?.paymentGateway?.keyIdEncrypted,
  );
  const keySecret = decryptPaymentCredential(
    credentialOwner?.paymentGateway?.keySecretEncrypted,
  );

  if (!keyId || !keySecret) {
    throw new Error(
      "Tenant payment gateway credentials are incomplete. Re-save the Razorpay credentials and try again.",
    );
  }

  return {
    keyId,
    keySecret,
  };
};

module.exports = {
  DEFAULT_PAYMENT_METHODS,
  applyPaymentGatewayRestrictions,
  buildPaymentGatewaySummary,
  decryptPaymentCredential,
  encryptPaymentCredential,
  getTenantRazorpayCredentials,
  isCheckoutMethodAllowed,
  isManualMethodAllowed,
  loadTenantPaymentConfiguration,
  maskPaymentCredential,
  normalizePaymentMethods,
  validateEnabledPaymentMethods,
};
