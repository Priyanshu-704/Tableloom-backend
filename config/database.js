const { logger } = require("./../utils/logger.js");
const mongoose = require("mongoose");
require("dotenv").config({
  quiet: true,
});
const reconcileIndexes = async () => {
  const AppSetting = require("../models/AppSetting");
  const Tenant = require("../models/Tenant");
  try {
    const appSettingCollection = AppSetting.collection;
    const appSettingIndexes = await appSettingCollection.indexes();
    const legacyAppSettingKeyIndex = appSettingIndexes.find((index) => {
      const keyEntries = Object.entries(index.key || {});
      return (
        index.unique === true &&
        keyEntries.length === 1 &&
        keyEntries[0][0] === "key"
      );
    });
    if (legacyAppSettingKeyIndex) {
      await appSettingCollection.dropIndex(legacyAppSettingKeyIndex.name);
      logger.info(
        `Dropped legacy AppSetting index: ${legacyAppSettingKeyIndex.name}`,
      );
    }

    const tenantCollection = Tenant.collection;
    const tenantIndexes = await tenantCollection.indexes();
    const legacyTenantKeyIndex = tenantIndexes.find((index) => {
      const keyEntries = Object.entries(index.key || {});
      return (
        index.unique === true &&
        keyEntries.length === 1 &&
        keyEntries[0][0] === "key"
      );
    });
    if (legacyTenantKeyIndex) {
      await tenantCollection.dropIndex(legacyTenantKeyIndex.name);
      logger.info(`Dropped legacy Tenant index: ${legacyTenantKeyIndex.name}`);
    }

    await AppSetting.syncIndexes();
    await Tenant.syncIndexes();
  } catch (error) {
    logger.error("Failed to reconcile model indexes:", error.message);
  }
};
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not configured");
    }
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    await reconcileIndexes();
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error("MongoDB connection failed:", error.message);
    throw error;
  }
};
module.exports = connectDB;
