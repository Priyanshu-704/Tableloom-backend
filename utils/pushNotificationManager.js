const PushNotificationToken = require("../models/PushNotificationToken");
const { getFirebaseMessaging } = require("./firebaseAdmin");
const { logger } = require("./logger.js");

const INVALID_FCM_TOKEN_ERRORS = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

const stringifyData = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const normalizeDataPayload = (data = {}) =>
  Object.entries(data || {}).reduce((accumulator, [key, value]) => {
    const normalizedValue = stringifyData(value);
    if (normalizedValue !== "") {
      accumulator[key] = normalizedValue;
    }
    return accumulator;
  }, {});

const dedupeTokens = (records = []) => {
  const seen = new Set();
  return records.filter((record) => {
    const token = String(record?.token || "").trim();
    if (!token || seen.has(token)) {
      return false;
    }
    seen.add(token);
    return true;
  });
};

const getPrimaryLink = (actions = [], fallbackLink = "") => {
  if (!Array.isArray(actions)) {
    return fallbackLink;
  }

  const linkAction = actions.find(
    (action) => action?.type === "link" && String(action.action || "").trim()
  );

  return String(linkAction?.action || fallbackLink || "").trim();
};

class PushNotificationManager {
  async registerToken({
    tenantId,
    token,
    audience,
    userId = null,
    role = null,
    customerSessionId = null,
    permission = "default",
    device = {},
  } = {}) {
    const normalizedToken = String(token || "").trim();
    if (!tenantId || !normalizedToken || !audience) {
      throw new Error("tenantId, token, and audience are required");
    }

    return PushNotificationToken.findOneAndUpdate(
      { tenantId, token: normalizedToken },
      {
        $set: {
          tenantId,
          token: normalizedToken,
          audience,
          user: userId || null,
          role: role || null,
          customerSessionId: customerSessionId || null,
          permission: permission || "default",
          device: {
            platform: device?.platform || "web",
            userAgent: device?.userAgent || "",
            language: device?.language || "",
          },
          isActive: true,
          lastUsedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );
  }

  async unregisterToken({
    tenantId,
    token,
    audience,
    userId = null,
    customerSessionId = null,
  } = {}) {
    const normalizedToken = String(token || "").trim();
    if (!tenantId || !normalizedToken || !audience) {
      throw new Error("tenantId, token, and audience are required");
    }

    const query = {
      tenantId,
      token: normalizedToken,
      audience,
    };

    if (audience === "staff" && userId) {
      query.user = userId;
    }

    if (audience === "customer" && customerSessionId) {
      query.customerSessionId = customerSessionId;
    }

    return PushNotificationToken.findOneAndUpdate(
      query,
      {
        $set: {
          isActive: false,
          lastUsedAt: new Date(),
        },
      },
      { new: true }
    );
  }

  async getRoleTokens(tenantId, roles = []) {
    const normalizedRoles = [...new Set((roles || []).map((role) => String(role || "").trim()).filter(Boolean))];
    if (!tenantId || !normalizedRoles.length) {
      return [];
    }

    return PushNotificationToken.find({
      tenantId,
      audience: "staff",
      role: { $in: normalizedRoles },
      isActive: true,
    })
      .select("token")
      .lean();
  }

  async getUserTokens(tenantId, userIds = []) {
    const normalizedUserIds = [...new Set((userIds || []).map((userId) => String(userId || "").trim()).filter(Boolean))];
    if (!tenantId || !normalizedUserIds.length) {
      return [];
    }

    return PushNotificationToken.find({
      tenantId,
      audience: "staff",
      user: { $in: normalizedUserIds },
      isActive: true,
    })
      .select("token")
      .lean();
  }

  async getCustomerSessionTokens(tenantId, customerSessionId) {
    if (!tenantId || !customerSessionId) {
      return [];
    }

    return PushNotificationToken.find({
      tenantId,
      audience: "customer",
      customerSessionId,
      isActive: true,
    })
      .select("token")
      .lean();
  }

  async deactivateInvalidTokens(tenantId, tokens = []) {
    const invalidTokens = [...new Set((tokens || []).map((token) => String(token || "").trim()).filter(Boolean))];
    if (!tenantId || !invalidTokens.length) {
      return;
    }

    await PushNotificationToken.updateMany(
      {
        tenantId,
        token: { $in: invalidTokens },
      },
      {
        $set: {
          isActive: false,
          lastUsedAt: new Date(),
        },
      }
    );
  }

  async sendToTokenRecords(records = [], payload = {}) {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      return {
        success: false,
        skipped: true,
        message: "Firebase messaging is not configured",
      };
    }

    const uniqueRecords = dedupeTokens(records);
    if (!uniqueRecords.length) {
      return {
        success: true,
        skipped: true,
        message: "No active push tokens found",
      };
    }

    const message = {
      tokens: uniqueRecords.map((record) => record.token),
      notification: {
        title: payload.title || "New notification",
        body: payload.body || "",
      },
      data: normalizeDataPayload(payload.data),
      webpush: {
        headers: {
          Urgency: payload.priority === "urgent" ? "high" : "normal",
        },
        notification: {
          title: payload.title || "New notification",
          body: payload.body || "",
          icon: "/tableloom-mark.svg",
          badge: "/tableloom-mark.svg",
          requireInteraction: payload.priority === "urgent",
          data: payload.data || {},
        },
        fcmOptions: payload.link ? { link: payload.link } : undefined,
      },
    };

    const response = await messaging.sendEachForMulticast(message);
    const invalidTokens = [];

    response.responses.forEach((result, index) => {
      if (!result.success && INVALID_FCM_TOKEN_ERRORS.has(result.error?.code)) {
        invalidTokens.push(uniqueRecords[index]?.token);
      }
    });

    if (invalidTokens.length && payload.tenantId) {
      await this.deactivateInvalidTokens(payload.tenantId, invalidTokens);
    }

    return {
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      invalidTokens: invalidTokens.length,
    };
  }

  async sendNotificationPush(notification = {}) {
    const tenantId = notification?.tenantId || notification?._doc?.tenantId || null;
    if (!tenantId) {
      return {
        success: false,
        skipped: true,
        message: "Notification tenantId missing",
      };
    }

    let tokenRecords = [];

    if (notification.customerSessionId) {
      tokenRecords = await this.getCustomerSessionTokens(
        tenantId,
        notification.customerSessionId
      );
    } else if (notification.recipientType === "user") {
      tokenRecords = await this.getUserTokens(tenantId, notification.recipients || []);
    } else if (notification.recipientType === "role") {
      tokenRecords = await this.getRoleTokens(tenantId, notification.roles || []);
    } else if (notification.recipientType === "all") {
      tokenRecords = await PushNotificationToken.find({
        tenantId,
        audience: "staff",
        isActive: true,
      })
        .select("token")
        .lean();
    }

    const link = getPrimaryLink(notification.actions, notification.metadata?.link || "");

    return this.sendToTokenRecords(tokenRecords, {
      tenantId,
      title: notification.title,
      body: notification.message,
      priority: notification.priority || "medium",
      link,
      data: {
        notificationId: notification._id,
        type: notification.type,
        priority: notification.priority,
        recipientType: notification.recipientType,
        relatedModel: notification.relatedModel,
        relatedTo: notification.relatedTo,
        customerSessionId: notification.customerSessionId,
        metadata: notification.metadata || {},
      },
    });
  }
}

module.exports = new PushNotificationManager();
