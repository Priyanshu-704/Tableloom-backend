const ACCESS_TOKEN_COOKIE_NAME = "accessToken";
const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
const CUSTOMER_SESSION_COOKIE_NAME = "customerSessionToken";

const ACCESS_TOKEN_MAX_AGE_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CUSTOMER_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const isProduction = () => process.env.NODE_ENV === "production";

const normalizeSameSite = () => {
  const configured = String(process.env.COOKIE_SAMESITE || "")
    .trim()
    .toLowerCase();

  if (["strict", "lax"].includes(configured)) {
    return configured;
  }

  if (configured === "none") {
    // Browsers reject SameSite=None cookies over plain HTTP, so keep local
    // development usable even if production cookie env vars are reused.
    return isProduction() ? "none" : "lax";
  }

  return isProduction() ? "none" : "lax";
};

const normalizeCookieDomain = () => {
  const configured = String(process.env.COOKIE_DOMAIN || "").trim();

  if (!configured) {
    return "";
  }

  let hostname = configured;

  try {
    hostname = new URL(configured).hostname;
  } catch {
    hostname = configured
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "");
  }

  hostname = hostname.replace(/^\.+/, "").trim().toLowerCase();

  if (
    !hostname ||
    hostname === "localhost" ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
  ) {
    return "";
  }

  return hostname;
};

const shouldUseSecureCookies = (sameSite) => {
  const configuredSecure = String(process.env.COOKIE_SECURE || "")
    .trim()
    .toLowerCase();

  if (!isProduction()) {
    return false;
  }

  if (configuredSecure === "false") {
    return false;
  }

  if (configuredSecure === "true") {
    return true;
  }

  return String(sameSite || "").toLowerCase() === "none";
};

const buildCookieOptions = ({
  maxAge,
  httpOnly = true,
  path = "/",
} = {}) => {
  const sameSite = normalizeSameSite();
  const cookieOptions = {
    httpOnly,
    secure: shouldUseSecureCookies(sameSite),
    sameSite,
    maxAge,
    path,
  };

  const cookieDomain = normalizeCookieDomain();

  if (isProduction() && cookieDomain) {
    cookieOptions.domain = cookieDomain;
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
