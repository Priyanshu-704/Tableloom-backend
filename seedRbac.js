const mongoose = require("mongoose");
const { logger } = require("./utils/logger");
const { ensureDefaultRbacSeedData } = require("./utils/permissionSettings");

require("dotenv").config({
  quiet: true,
});

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }
  return mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
};

const seedRbac = async () => {
  logger.info("Seeding RBAC permissions and system roles...");
  await connectDB();
  await ensureDefaultRbacSeedData({ force: true });
  logger.info("RBAC seed completed successfully.");
};

if (require.main === module) {
  seedRbac()
    .then(async () => {
      await mongoose.connection.close();
    })
    .catch(async (error) => {
      logger.error("RBAC seed failed:", error);
      await mongoose.connection.close();
      process.exit(1);
    });
}

module.exports = {
  seedRbac,
};
