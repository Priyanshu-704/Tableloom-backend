const { logger } = require("./logger.js");
const cron = require("node-cron");
const kitchenManager = require("./kitchenManager");
const AppSetting = require("../models/AppSetting");
const { runWithTenant } = require("./tenantContext");
const DEFAULT_CONFIG = {
  enabled: true,
  intervalMinutes: 5,
  notifyOnDelay: true,
  criticalThresholdMinutes: 15,
};
class DelayMonitor {
  constructor() {
    this.tenantStates = new Map();
  }
  normalizeConfig(config = {}) {
    return {
      ...DEFAULT_CONFIG,
      ...(config || {}),
      intervalMinutes: Math.min(
        59,
        Math.max(
          1,
          Number(config?.intervalMinutes || DEFAULT_CONFIG.intervalMinutes),
        ),
      ),
      criticalThresholdMinutes: Math.min(
        240,
        Math.max(
          1,
          Number(
            config?.criticalThresholdMinutes ||
              DEFAULT_CONFIG.criticalThresholdMinutes,
          ),
        ),
      ),
      enabled: Boolean(
        Object.prototype.hasOwnProperty.call(config, "enabled")
          ? config.enabled
          : DEFAULT_CONFIG.enabled,
      ),
      notifyOnDelay: Boolean(
        Object.prototype.hasOwnProperty.call(config, "notifyOnDelay")
          ? config.notifyOnDelay
          : DEFAULT_CONFIG.notifyOnDelay,
      ),
    };
  }
  createTenantState(config = {}) {
    return {
      task: null,
      isRunning: false,
      lastCheck: null,
      lastError: null,
      lastRunSummary: null,
      config: this.normalizeConfig(config),
    };
  }
  getTenantState(tenantId, config = null) {
    const normalizedTenantId = String(tenantId || "").trim();
    if (!normalizedTenantId) {
      return null;
    }
    if (!this.tenantStates.has(normalizedTenantId)) {
      this.tenantStates.set(
        normalizedTenantId,
        this.createTenantState(config || DEFAULT_CONFIG),
      );
    }
    return this.tenantStates.get(normalizedTenantId);
  }
  async loadConfigs(tenantId = null) {
    const query = {
      key: "app-settings",
    };
    if (tenantId) {
      query.tenantId = tenantId;
    }
    const settings = await AppSetting.find(query)
      .select("tenantId operations.delayMonitor")
      .lean();
    return settings
      .map((setting) => {
        const normalizedTenantId = String(setting?.tenantId || "").trim();
        if (!normalizedTenantId) {
          return null;
        }
        return {
          tenantId: normalizedTenantId,
          config: this.normalizeConfig(setting?.operations?.delayMonitor || {}),
        };
      })
      .filter(Boolean);
  }
  getCronExpression(intervalMinutes) {
    return `*/${intervalMinutes} * * * *`;
  }
  stopTask(state) {
    if (state?.task) {
      state.task.stop();
      state.task.destroy();
      state.task = null;
    }
    if (state) {
      state.isRunning = false;
    }
  }
  scheduleTenant(tenantId, state) {
    this.stopTask(state);
    if (!state?.config?.enabled) {
      return;
    }
    state.task = cron.schedule(
      this.getCronExpression(state.config.intervalMinutes),
      async () => {
        try {
          await this.runCheck("scheduled", tenantId);
        } catch (error) {
          logger.error(
            `Scheduled delay monitor check failed for tenant ${tenantId}:`,
            error.message,
          );
        }
      },
    );
    state.isRunning = true;
  }
  async ensureTenantConfigLoaded(tenantId) {
    const normalizedTenantId = String(tenantId || "").trim();
    if (!normalizedTenantId) {
      throw new Error("tenantId is required");
    }
    const state = this.getTenantState(normalizedTenantId);
    if (
      state &&
      state.config &&
      typeof state.config.intervalMinutes === "number" &&
      typeof state.config.criticalThresholdMinutes === "number"
    ) {
      return state;
    }
    const [entry] = await this.loadConfigs(normalizedTenantId);
    if (entry) {
      state.config = entry.config;
    } else {
      state.config = this.normalizeConfig(DEFAULT_CONFIG);
    }
    return state;
  }
  async runCheck(trigger = "scheduled", tenantId = null) {
    const normalizedTenantId = String(tenantId || "").trim();
    if (!normalizedTenantId) {
      throw new Error("tenantId is required");
    }
    const state = await this.ensureTenantConfigLoaded(normalizedTenantId);
    try {
      const delayedOrders = await runWithTenant(normalizedTenantId, async () =>
        kitchenManager.checkDelayedOrders({
          notifyOnDelay: state.config.notifyOnDelay,
          criticalThresholdMinutes: state.config.criticalThresholdMinutes,
        }),
      );
      state.lastCheck = new Date();
      state.lastError = null;
      state.lastRunSummary = {
        trigger,
        delayedOrdersFound: delayedOrders.length,
        criticalDelayedOrders: delayedOrders.filter(
          (order) =>
            Number(order?.maxDelayMinutes || 0) >=
            Number(state.config.criticalThresholdMinutes || 15),
        ).length,
        checkedAt: state.lastCheck,
      };
      return delayedOrders;
    } catch (error) {
      state.lastError = error.message;
      logger.error("Delay check failed:", error);
      throw error;
    }
  }
  async syncWithSettings(tenantId = null) {
    if (tenantId) {
      const normalizedTenantId = String(tenantId || "").trim();
      const [entry] = await this.loadConfigs(normalizedTenantId);
      const state = this.getTenantState(normalizedTenantId);
      state.config = this.normalizeConfig(entry?.config || DEFAULT_CONFIG);
      this.scheduleTenant(normalizedTenantId, state);
      return this.getStatus(normalizedTenantId);
    }
    const configs = await this.loadConfigs();
    const configuredTenantIds = new Set();
    configs.forEach(({ tenantId: configuredTenantId, config }) => {
      configuredTenantIds.add(configuredTenantId);
      const state = this.getTenantState(configuredTenantId);
      state.config = this.normalizeConfig(config);
      this.scheduleTenant(configuredTenantId, state);
    });
    Array.from(this.tenantStates.entries()).forEach(([existingTenantId, state]) => {
      if (!configuredTenantIds.has(existingTenantId)) {
        this.stopTask(state);
        this.tenantStates.delete(existingTenantId);
      }
    });
    return this.getStatus();
  }
  async start() {
    return this.syncWithSettings();
  }
  stop(tenantId = null) {
    if (tenantId) {
      const state = this.tenantStates.get(String(tenantId || "").trim());
      if (state) {
        this.stopTask(state);
      }
      return;
    }
    Array.from(this.tenantStates.values()).forEach((state) => {
      this.stopTask(state);
    });
  }
  getStatus(tenantId = null) {
    if (tenantId) {
      const state =
        this.tenantStates.get(String(tenantId || "").trim()) ||
        this.createTenantState(DEFAULT_CONFIG);
      return {
        isRunning: Boolean(state.isRunning),
        enabled: Boolean(state.config.enabled),
        intervalMinutes: Number(state.config.intervalMinutes),
        notifyOnDelay: Boolean(state.config.notifyOnDelay),
        criticalThresholdMinutes: Number(
          state.config.criticalThresholdMinutes,
        ),
        lastCheck: state.lastCheck,
        lastError: state.lastError,
        lastRunSummary: state.lastRunSummary,
      };
    }
    const states = Array.from(this.tenantStates.values());
    return {
      isRunning: states.some((state) => state.isRunning),
      configuredTenants: states.length,
      runningTenants: states.filter((state) => state.isRunning).length,
    };
  }
}
module.exports = new DelayMonitor();
