const { logger } = require("./logger.js");
const cron = require("node-cron");
const kitchenManager = require("./kitchenManager");
const AppSetting = require("../models/AppSetting");

const DEFAULT_CONFIG = {
  enabled: true,
  intervalMinutes: 5,
  notifyOnDelay: true,
  criticalThresholdMinutes: 15,
};

class DelayMonitor {
  constructor() {
    this.task = null;
    this.isRunning = false;
    this.lastCheck = null;
    this.lastError = null;
    this.lastRunSummary = null;
    this.config = { ...DEFAULT_CONFIG };
  }

  async loadConfig() {
    const settings = await AppSetting.findOne({ key: "app-settings" }).lean();
    return {
      ...DEFAULT_CONFIG,
      ...(settings?.operations?.delayMonitor || {}),
      intervalMinutes: Math.min(
        59,
        Math.max(
          1,
          Number(
            settings?.operations?.delayMonitor?.intervalMinutes ||
              DEFAULT_CONFIG.intervalMinutes
          )
        )
      ),
    };
  }

  getCronExpression(intervalMinutes) {
    return `*/${intervalMinutes} * * * *`;
  }

  async runCheck(trigger = "scheduled") {
    try {
      const delayedOrders = await kitchenManager.checkDelayedOrders();
      this.lastCheck = new Date();
      this.lastError = null;
      this.lastRunSummary = {
        trigger,
        delayedOrdersFound: delayedOrders.length,
        checkedAt: this.lastCheck,
      };
      return delayedOrders;
    } catch (error) {
      this.lastError = error.message;
      logger.error("Delay check failed:", error);
      throw error;
    }
  }

  async syncWithSettings() {
    this.config = await this.loadConfig();

    if (this.task) {
      this.task.stop();
      this.task.destroy();
      this.task = null;
    }

    if (!this.config.enabled) {
      this.isRunning = false;
      return this.getStatus();
    }

    this.task = cron.schedule(
      this.getCronExpression(this.config.intervalMinutes),
      async () => {
        await this.runCheck("scheduled");
      }
    );

    this.isRunning = true;
    return this.getStatus();
  }

  async start() {
    return this.syncWithSettings();
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task.destroy();
      this.task = null;
    }
    this.isRunning = false;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      enabled: this.config.enabled,
      intervalMinutes: this.config.intervalMinutes,
      lastCheck: this.lastCheck,
      lastError: this.lastError,
      lastRunSummary: this.lastRunSummary,
    };
  }
}

module.exports = new DelayMonitor();
