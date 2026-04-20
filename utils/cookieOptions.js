const ACCESS_TOKEN_COOKIE_NAME = "accessToken";
const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
const CUSTOMER_SESSION_COOKIE_NAME = "customerSessionToken";

const ACCESS_TOKEN_MAX_AGE_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CUSTOMER_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const normalizeSameSite = () => {
  const configured = String(process.env.COOKIE_SAMESITE || "")
    .trim()
    .toLowerCase();

  if (["strict", "lax", "none"].includes(configured)) {
    return configured;
  }

  return process.env.NODE_ENV === "production" ? "none" : "lax";
};

const buildCookieOptions = ({
  maxAge,
  httpOnly = true,
  path = "/",
} = {}) => {
  const isProduction = process.env.NODE_ENV === "production";
  const sameSite = normalizeSameSite();
  const cookieOptions = {
    httpOnly,
    secure: isProduction ? process.env.COOKIE_SECURE !== "false" : false,
    sameSite,
    maxAge,
    path,
  };

  if (isProduction && process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }

  return cookieOptions;
};

const setAccessTokenCookie = (res, token) => {
  if (!token) {
    return;
  }

  res.cookie(
    ACCESS_TOKEN_COOKIE_NAME,
    token,
    buildCookieOptions({
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
      httpOnly: true,
    }),
  );
};

const setRefreshTokenCookie = (res, token) => {
  if (!token) {
    return;
  }

  res.cookie(
    REFRESH_TOKEN_COOKIE_NAME,
    token,
    buildCookieOptions({
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
      httpOnly: true,
    }),
  );
};

const setCustomerSessionCookie = (res, token) => {
  if (!token) {
    return;
  }

  res.cookie(
    CUSTOMER_SESSION_COOKIE_NAME,
    token,
    buildCookieOptions({
      maxAge: CUSTOMER_SESSION_MAX_AGE_MS,
      httpOnly: true,
    }),
  );
};

const clearCookie = (res, cookieName, options = {}) => {
  res.clearCookie(
    cookieName,
    buildCookieOptions({
      maxAge: 0,
      ...options,
    }),
  );
};

const clearAuthCookies = (res) => {
  clearCookie(res, ACCESS_TOKEN_COOKIE_NAME);
  clearCookie(res, REFRESH_TOKEN_COOKIE_NAME);
};

const clearCustomerSessionCookie = (res) => {
  clearCookie(res, CUSTOMER_SESSION_COOKIE_NAME);
};

module.exports = {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  CUSTOMER_SESSION_COOKIE_NAME,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setCustomerSessionCookie,
  clearAuthCookies,
  clearCustomerSessionCookie,
};
