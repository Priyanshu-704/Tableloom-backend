const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const MIN_JWT_SECRET_LENGTH = 32;
const DEFAULT_ACCESS_TOKEN_EXPIRE = "1h";
const DEFAULT_JWT_ISSUER = "quickbite-admin";
const DEFAULT_JWT_AUDIENCE = "quickbite-staff";

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
const getAccessTokenExpiry = () =>
  String(process.env.ACCESS_TOKEN_EXPIRE || DEFAULT_ACCESS_TOKEN_EXPIRE).trim();

const buildAccessTokenPayload = (user) => ({
  sub: String(user?._id || user?.id || ""),
  role: String(user?.role || "").toLowerCase(),
  tenantId: user?.tenantId ? String(user.tenantId) : null,
  type: "access",
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

const getTokenUserId = (decodedToken) =>
  String(decodedToken?.sub || decodedToken?.id || "").trim();

const assertAuthConfig = () => {
  getJwtSecret();
  getJwtIssuer();
  getJwtAudience();
  getAccessTokenExpiry();
};

module.exports = {
  assertAuthConfig,
  getTokenUserId,
  signAccessToken,
  verifyAccessToken,
};
