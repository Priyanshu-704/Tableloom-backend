const { logger } = require("./utils/logger.js");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
require("dotenv").config({
  quiet: true,
});
const {
  passwordPolicyMessage,
  validatePasswordStrength,
} = require("./utils/passwordPolicy");

const DEFAULT_ADMIN = {
  name: process.env.SEED_ADMIN_NAME || "System Administrator",
  email: String(process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase(),
  password: String(process.env.SEED_ADMIN_PASSWORD || ""),
};
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error("Database connection error:", error);
    process.exit(1);
  }
};
const createAdminUser = async () => {
  try {
    if (!DEFAULT_ADMIN.email || !DEFAULT_ADMIN.password) {
      throw new Error(
        "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be provided to seed an admin user.",
      );
    }
    if (!validatePasswordStrength(DEFAULT_ADMIN.password).isValid) {
      throw new Error(passwordPolicyMessage);
    }
    const existingAdmin = await User.findOne({
      $or: [
        {
          email: DEFAULT_ADMIN.email,
        },
        {
          role: "admin",
        },
      ],
    });
    if (existingAdmin) {
      logger.info("Admin user already exists:");
      logger.info({
        id: existingAdmin._id,
        name: existingAdmin.name,
        email: existingAdmin.email,
        role: existingAdmin.role,
      });
      return existingAdmin;
    }
    const adminUser = await User.create({
      name: DEFAULT_ADMIN.name,
      email: DEFAULT_ADMIN.email,
      password: DEFAULT_ADMIN.password,
      role: "admin",
      isActive: true,
      forcePasswordChange: true,
    });
    logger.info("Admin user created successfully.");
    logger.info({
      id: adminUser._id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
    });
    logger.info("\nLogin Credentials:");
    logger.info(`Email: ${DEFAULT_ADMIN.email}`);
    logger.info(
      "Password was loaded from SEED_ADMIN_PASSWORD and is not printed to logs.",
    );
    logger.info("\nForce password change is enabled for the seeded admin.");
    return adminUser;
  } catch (error) {
    logger.error("Error creating admin user:", error);
    if (error.code === 11000) {
      logger.info("Duplicate key error - Admin might already exist");
    }
    throw error;
  }
};
const seedAdmin = async () => {
  try {
    logger.info("Starting admin seed...");
    await connectDB();
    await createAdminUser();
    logger.info("Admin seed completed successfully.");
    logger.info("\nYou can now:");
    logger.info("1. Login with admin credentials");
    logger.info("2. Create other staff members");
    logger.info("3. Set up tables and menu items");
    logger.info("4. Test all features");
    mongoose.connection.close();
    logger.info("Database connection closed.");
  } catch (error) {
    logger.error("Seed failed:", error);
    process.exit(1);
  }
};
if (require.main === module) {
  seedAdmin();
}
module.exports = {
  seedAdmin,
  createAdminUser,
};
