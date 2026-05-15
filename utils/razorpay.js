const crypto = require("crypto");
const Razorpay = require("razorpay");
require("dotenv").config({
  quiet: true,
});

let razorpayClient = null;
const razorpayClientsByCredentialHash = new Map();

const getRazorpayCredentials = (overrideCredentials = null) => {
  if (overrideCredentials?.keyId || overrideCredentials?.keySecret) {
    return {
      keyId: String(overrideCredentials?.keyId || "").trim(),
      keySecret: String(overrideCredentials?.keySecret || "").trim(),
    };
  }

  return {
    keyId: String(process.env.RAZORPAY_KEY_ID || "").trim(),
    keySecret: String(process.env.RAZORPAY_KEY_SECRET || "").trim(),
  };
};

const isRazorpayConfigured = (overrideCredentials = null) => {
  const { keyId, keySecret } = getRazorpayCredentials(overrideCredentials);
  return Boolean(keyId && keySecret);
};

const assertRazorpayConfigured = (overrideCredentials = null) => {
  if (isRazorpayConfigured(overrideCredentials)) {
    return;
  }

  throw new Error(
    "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the backend environment.",
  );
};

const getCredentialCacheKey = ({ keyId = "", keySecret = "" } = {}) =>
  crypto
    .createHash("sha256")
    .update(`${keyId}:${keySecret}`)
    .digest("hex");

const getRazorpayClient = (overrideCredentials = null) => {
  assertRazorpayConfigured(overrideCredentials);
  const { keyId, keySecret } = getRazorpayCredentials(overrideCredentials);

  if (!overrideCredentials) {
    if (!razorpayClient) {
      razorpayClient = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }

    return razorpayClient;
  }

  const credentialCacheKey = getCredentialCacheKey({
    keyId,
    keySecret,
  });

  if (!razorpayClientsByCredentialHash.has(credentialCacheKey)) {
    razorpayClientsByCredentialHash.set(
      credentialCacheKey,
      new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      }),
    );
  }

  return razorpayClientsByCredentialHash.get(credentialCacheKey);
};

const getRazorpayPublicConfig = (overrideCredentials = null) => ({
  enabled: isRazorpayConfigured(overrideCredentials),
  keyId: getRazorpayCredentials(overrideCredentials).keyId,
});

const convertAmountToSubunits = (amount = 0) => {
  const normalizedAmount = Number(amount || 0);

  if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
    return 0;
  }

  return Math.round(normalizedAmount * 100);
};

const verifyRazorpaySignature = (
  {
    orderId = "",
    paymentId = "",
    signature = "",
  },
  overrideCredentials = null,
) => {
  const { keySecret } = getRazorpayCredentials(overrideCredentials);
  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return generatedSignature === signature;
};

module.exports = {
  assertRazorpayConfigured,
  convertAmountToSubunits,
  getRazorpayClient,
  getRazorpayPublicConfig,
  isRazorpayConfigured,
  verifyRazorpaySignature,
};
