const User = require("../models/User");
const Branch = require("../models/Branch");
const { runWithBranch } = require("../utils/branchContext");
const { getTokenUserId, verifyAccessToken } = require("../utils/authTokens");
const {
  getSubscriptionState,
  isSubscriptionActive,
} = require("../services/subscriptionService");
const { ensureMainBranch } = require("../services/branchService");

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALLOWLIST_PATH_FRAGMENTS = [
  "/billing",
  "/subscription",
  "/renew",
  "/razorpay",
  "/payment",
  "/support",
  "/contact",
  "/logout",
  "/profile",
  "/settings",
];

const extractAccessToken = (req) => {
  if (req.headers.authorization?.startsWith("Bearer ")) {
    return req.headers.authorization.split(" ")[1];
  }
  return req.cookies?.accessToken || null;
};

const hydrateUserFromToken = async (req) => {
  if (req.user) return req.user;
  const accessToken = extractAccessToken(req);
  if (!accessToken) return null;
  try {
    const decoded = verifyAccessToken(accessToken);
    const userId = getTokenUserId(decoded);
    if (!userId) return null;
    req.user = await User.findById(userId);
    return req.user;
  } catch (_error) {
    return null;
  }
};

const isAdminAllScope = (user = {}) => {
  const explicitScope = String(user?.branchScope || "").toLowerCase();
  const role = String(user?.role || "").toLowerCase();
  return explicitScope === "all" || role === "admin";
};

const isSuperAdmin = (user = {}) =>
  String(user?.branchScope || "").toLowerCase() === "global" ||
  String(user?.role || "").toLowerCase() === "super_admin";

const isMutationAllowlisted = (req) => {
  const path = String(req.originalUrl || req.path || "").toLowerCase();
  return ALLOWLIST_PATH_FRAGMENTS.some((fragment) => path.includes(fragment));
};

const getRequestedBranchSelector = (req) =>
  req.header("x-branch-id") ||
  req.header("x-branch-slug") ||
  req.query.branchId ||
  req.params.branchId ||
  req.query.branchSlug ||
  req.params.branchSlug ||
  null;

exports.resolveBranch = async (req, res, next) => {
  try {
    const tenant = req.tenant || null;
    const user = await hydrateUserFromToken(req);
    const subscriptionState = getSubscriptionState(tenant || {});
    req.subscriptionState = subscriptionState;

    if (!tenant) {
      return runWithBranch(
        {
          branchScope: isSuperAdmin(user) ? "global" : "own",
          subscriptionState,
          isAllBranches: false,
        },
        next,
      );
    }

    if (
      MUTATING_METHODS.has(String(req.method).toUpperCase()) &&
      !isSubscriptionActive(tenant) &&
      !isMutationAllowlisted(req)
    ) {
      return res.status(402).json({
        success: false,
        code: "SUBSCRIPTION_INACTIVE",
        message: "Subscription is inactive. Renew your subscription to continue.",
        subscriptionState,
      });
    }

    let selector = String(getRequestedBranchSelector(req) || "").trim();

    if (!selector) {
      let tableId = req.body?.tableId || req.query?.tableId || req.params?.tableId || req.body?.table || null;
      if (!tableId) {
        let sessionId = req.params?.sessionId || req.query?.sessionId || req.body?.sessionId || null;
        if (!sessionId) {
          const token = req.cookies?.customer_session || 
            (req.headers.authorization?.startsWith("Customer ") ? req.headers.authorization.split(" ")[1] : null);
          if (token) {
            try {
              const { verifyCustomerSessionToken, getTokenSessionId } = require("../utils/authTokens");
              const decoded = verifyCustomerSessionToken(token);
              sessionId = getTokenSessionId(decoded);
            } catch (e) {
              // Ignore token verification errors
            }
          }
        }
        if (sessionId) {
          try {
            const Customer = require("../models/Customer");
            const customer = await Customer.findOne({ sessionId }).select("table branchId").lean();
            if (customer) {
              if (customer.branchId) {
                selector = String(customer.branchId);
              } else if (customer.table) {
                tableId = customer.table;
              }
            }
          } catch (e) {
            // Ignore error
          }
        }
      }
      if (!selector && tableId && require("mongoose").Types.ObjectId.isValid(tableId)) {
        try {
          const Table = require("../models/Table");
          const tableObj = await Table.findById(tableId).select("branchId").lean();
          if (tableObj && tableObj.branchId) {
            selector = String(tableObj.branchId);
          }
        } catch (e) {
          // Ignore error
        }
      }
    }

    const userScope = isSuperAdmin(user)
      ? "global"
      : isAdminAllScope(user)
        ? "all"
        : "own";

    if (selector.toLowerCase() === "all") {
      if (!["all", "global"].includes(userScope)) {
        return res.status(403).json({
          success: false,
          message: "All-branches access is not available for this user",
        });
      }
      if (
        MUTATING_METHODS.has(String(req.method).toUpperCase()) &&
        !isMutationAllowlisted(req)
      ) {
        return res.status(400).json({
          success: false,
          message: "Select a single branch for write operations",
        });
      }
      const allowedBranches = await Branch.find({
        tenantId: tenant._id,
        status: { $ne: "archived" },
      }).select("_id");
      const context = {
        branchScope: "all",
        isAllBranches: true,
        allowedBranchIds: allowedBranches.map((branch) => branch._id),
        subscriptionState,
      };
      Object.assign(req, context);
      return runWithBranch(context, next);
    }

    let branch = null;
    if (selector) {
      const query = selector.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: selector }
        : { slug: selector.toLowerCase() };
      branch = await Branch.findOne(query);
      if (!branch) {
        return res.status(404).json({
          success: false,
          message: "Branch not found",
        });
      }
      if (String(branch.tenantId) !== String(tenant._id)) {
        return res.status(403).json({
          success: false,
          message: "Branch does not belong to this restaurant workspace",
        });
      }
    }

    if (!branch && userScope === "own") {
      const assignedBranchId = user?.homeBranchId || user?.branchId || null;
      if (assignedBranchId) {
        branch = await Branch.findOne({
          _id: assignedBranchId,
          tenantId: tenant._id,
        });
      }
    }

    if (!branch) {
      branch = await ensureMainBranch(tenant, user?._id || null);
    }

    if (userScope === "own") {
      const assignedBranchId = String(user?.homeBranchId || user?.branchId || "");
      if (assignedBranchId && String(branch._id) !== assignedBranchId) {
        return res.status(403).json({
          success: false,
          message: "User is not allowed to access this branch",
        });
      }
    }

    if (["inactive", "suspended"].includes(branch.status)) {
      return res.status(423).json({
        success: false,
        message: "Branch is not available",
      });
    }

    const context = {
      branch,
      branchId: branch._id,
      branchScope: userScope,
      isAllBranches: false,
      allowedBranchIds: [branch._id],
      subscriptionState,
    };
    Object.assign(req, context);
    return runWithBranch(context, next);
  } catch (error) {
    return next(error);
  }
};

exports.requireSingleBranch = (req, res, next) => {
  if (req.isAllBranches) {
    return res.status(400).json({
      success: false,
      message: "Select a single branch for this operation",
    });
  }
  return next();
};
