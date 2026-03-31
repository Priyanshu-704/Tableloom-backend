const { logger } = require("./../utils/logger.js");
const mongoose = require('mongoose');
require("dotenv").config({ quiet: true });

const reconcileIndexes = async () => {
  const AppSetting = require("../models/AppSetting");

  try {
    const collection = AppSetting.collection;
    const existingIndexes = await collection.indexes();
    const legacyKeyIndex = existingIndexes.find((index) => {
      const keyEntries = Object.entries(index.key || {});
      return (
        index.unique === true &&
        keyEntries.length === 1 &&
        keyEntries[0][0] === "key"
      );
    });

    if (legacyKeyIndex) {
      await collection.dropIndex(legacyKeyIndex.name);
      logger.info(`Dropped legacy AppSetting index: ${legacyKeyIndex.name}`);
    }

    await AppSetting.syncIndexes();
  } catch (error) {
    logger.error("Failed to reconcile AppSetting indexes:", error.message);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    await reconcileIndexes();

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
};

module.exports = connectDB;
