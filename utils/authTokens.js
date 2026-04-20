const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const MIN_JWT_SECRET_LENGTH = 32;
const DEFAULT_ACCESS_TOKEN_EXPIRE = "1h";
const DEFAULT_CUSTOMER_SESSION_TOKEN_EXPIRE = "12h";
const DEFAULT_JWT_ISSUER = "quickbite-admin";
const DEFAULT_JWT_AUDIENCE = "quickbite-staff";
const DEFAULT_CUSTOMER_SESSION_AUDIENCE = "quickbite-customer";

const getJwtSecret = () => {
  const jwtSecret = String(process.env.JWT_SECRET || "");
  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long.`,
    );
  }
  return jwtSecret;
};

const getJwtIssuer = () =>
  String(process.env.JWT_ISSUER || DEFAULT_JWT_ISSUER).trim();
const getJwtAudience = () =>
  String(process.env.JWT_AUDIENCE || DEFAULT_JWT_AUDIENCE).trim();
const getCustomerSessionAudience = () =>
  String(
    process.env.CUSTOMER_SESSION_AUDIENCE ||
      DEFAULT_CUSTOMER_SESSION_AUDIENCE,
  ).trim();
const getAccessTokenExpiry = () =>
  String(process.env.ACCESS_TOKEN_EXPIRE || DEFAULT_ACCESS_TOKEN_EXPIRE).trim();
const getCustomerSessionExpiry = () =>
  String(
    process.env.CUSTOMER_SESSION_TOKEN_EXPIRE ||
      DEFAULT_CUSTOMER_SESSION_TOKEN_EXPIRE,
  ).trim();

const buildAccessTokenPayload = (user) => ({
  sub: String(user?._id || user?.id || ""),
  role: String(user?.role || "").toLowerCase(),
  tenantId: user?.tenantId ? String(user.tenantId) : null,
  type: "access",
});

const buildCustomerSessionTokenPayload = (session) => ({
  sub: String(session?.sessionId || session?._id || ""),
  tenantId: session?.tenantId ? String(session.tenantId) : null,
  type: "customer_session",
});

const signAccessToken = (user) => {
  const payload = buildAccessTokenPayload(user);
  if (!payload.sub) {
    throw new Error("A valid user id is required to sign an access token.");
  }
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getAccessTokenExpiry(),
    issuer: getJwtIssuer(),
    audience: getJwtAudience(),
    jwtid: crypto.randomBytes(16).toString("hex"),
  });
};

const signCustomerSessionToken = (session) => {
  const payload = buildCustomerSessionTokenPayload(session);
  if (!payload.sub) {
    throw new Error(
      "A valid customer session id is required to sign a session token.",
    );
  }

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getCustomerSessionExpiry(),
    issuer: getJwtIssuer(),
    audience: getCustomerSessionAudience(),
    jwtid: crypto.randomBytes(16).toString("hex"),
  });
};

const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, getJwtSecret(), {
    issuer: getJwtIssuer(),
    audience: getJwtAudience(),
  });
  if (decoded?.type !== "access") {
    throw new Error("Invalid token type");
  }
  return decoded;
};

const verifyCustomerSessionToken = (token) => {
  const decoded = jwt.verify(token, getJwtSecret(), {
    issuer: getJwtIssuer(),
    audience: getCustomerSessionAudience(),
  });
  if (decoded?.type !== "customer_session") {
    throw new Error("Invalid customer session token type");
  }
  return decoded;
};

const getTokenUserId = (decodedToken) =>
  String(decodedToken?.sub || decodedToken?.id || "").trim();

const getTokenSessionId = (decodedToken) =>
  String(decodedToken?.sub || decodedToken?.sessionId || "").trim();

const assertAuthConfig = () => {
  getJwtSecret();
  getJwtIssuer();
  getJwtAudience();
  getAccessTokenExpiry();
  getCustomerSessionAudience();
  getCustomerSessionExpiry();
};

module.exports = {
  assertAuthConfig,
  getTokenSessionId,
  getTokenUserId,
  signAccessToken,
  signCustomerSessionToken,
  verifyAccessToken,
  verifyCustomerSessionToken,
};
