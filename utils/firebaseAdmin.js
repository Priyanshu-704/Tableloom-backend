const admin = require("firebase-admin");
const { logger } = require("./logger.js");
let firebaseApp = null;
let hasLoggedMissingConfig = false;
const parseServiceAccount = () => {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    let rawKey = String(process.env.FIREBASE_PRIVATE_KEY).trim();
    if (
      (rawKey.startsWith('"') && rawKey.endsWith('"')) ||
      (rawKey.startsWith("'") && rawKey.endsWith("'"))
    ) {
      rawKey = rawKey.slice(1, -1);
    }
    rawKey = rawKey.replace(/^["'\\]+/, "").replace(/["'\\]+$/, "").trim();
    const privateKey = rawKey.replace(/\\n/g, "\n");
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
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
      logger.warn(
        "Firebase admin credentials are not configured. Push notifications will be skipped.",
      );
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
