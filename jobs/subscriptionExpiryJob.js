const { logger } = require("../utils/logger");
const {
  runSubscriptionExpiryNotifications,
} = require("../services/subscriptionExpiryService");

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

let timer = null;

const runOnce = async () => {
  const results = await runSubscriptionExpiryNotifications();
  const sentCount = results.filter((result) => result.sent).length;
  if (sentCount > 0) {
    logger.info(`Subscription expiry notifications sent: ${sentCount}`);
  }
  return results;
};

const start = () => {
  if (timer || process.env.SUBSCRIPTION_EXPIRY_JOB_ENABLED === "false") {
    return;
  }
  runOnce().catch((error) => {
    logger.error("Initial subscription expiry job failed:", error.message);
  });
  timer = setInterval(() => {
    runOnce().catch((error) => {
      logger.error("Subscription expiry job failed:", error.message);
    });
  }, Number(process.env.SUBSCRIPTION_EXPIRY_JOB_INTERVAL_MS || DEFAULT_INTERVAL_MS));
  timer.unref?.();
};

const stop = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

module.exports = {
  start,
  stop,
  runOnce,
};
