const admin = require("firebase-admin");
const { logger } = require("./logger.js");

let firebaseApp = null;
let hasLoggedMissingConfig = false;

const parseServiceAccount = () => {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  try {
    if (rawJson) {
      return JSON.parse(rawJson);
    }

    if (rawBase64) {
      return JSON.parse(Buffer.from(rawBase64, "base64").toString("utf8"));
    }
  } catch (error) {
    logger.error("Failed to parse Firebase service account credentials:", error.message);
    return null;
  }

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: String(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, "\n"),
    };
  }

  return null;
};

const getFirebaseApp = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    if (!hasLoggedMissingConfig) {
      hasLoggedMissingConfig = true;
      logger.warn("Firebase admin credentials are not configured. Push notifications will be skipped.");
    }
    return null;
  }

  firebaseApp = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

  return firebaseApp;
};

exports.isFirebaseAdminConfigured = () => Boolean(parseServiceAccount());

exports.getFirebaseMessaging = () => {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  return admin.messaging(app);
};
