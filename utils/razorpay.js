const crypto = require("crypto");
const Razorpay = require("razorpay");
require("dotenv").config({
  quiet: true,
});

let razorpayClient = null;

const getRazorpayCredentials = () => ({
  keyId: String(process.env.RAZORPAY_KEY_ID || "").trim(),
  keySecret: String(process.env.RAZORPAY_KEY_SECRET || "").trim(),
});

const isRazorpayConfigured = () => {
  const { keyId, keySecret } = getRazorpayCredentials();
  return Boolean(keyId && keySecret);
};

const assertRazorpayConfigured = () => {
  if (isRazorpayConfigured()) {
    return;
  }

  throw new Error(
    "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the backend environment.",
  );
};

const getRazorpayClient = () => {
  assertRazorpayConfigured();

  if (!razorpayClient) {
    const { keyId, keySecret } = getRazorpayCredentials();
    razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayClient;
};

const getRazorpayPublicConfig = () => ({
  enabled: isRazorpayConfigured(),
  keyId: getRazorpayCredentials().keyId,
});

const convertAmountToSubunits = (amount = 0) => {
  const normalizedAmount = Number(amount || 0);

  if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
    return 0;
  }

  return Math.round(normalizedAmount * 100);
};

const verifyRazorpaySignature = ({
  orderId = "",
  paymentId = "",
  signature = "",
}) => {
  const { keySecret } = getRazorpayCredentials();
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
