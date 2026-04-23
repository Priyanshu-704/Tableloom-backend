const { logger } = require("./utils/logger.js");
const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config({
  quiet: true,
});
const {
  passwordPolicyMessage,
  validatePasswordStrength,
} = require("./utils/passwordPolicy");
const {
  assignRolesToUser,
  ensureDefaultRbacSeedData,
} = require("./utils/permissionSettings");

const DEFAULT_SUPER_ADMIN = {
  name: "Platform Super Admin",
  email: String(process.env.SUPER_ADMIN_EMAIL || "")
    .trim()
    .toLowerCase(),
  password: String(process.env.SUPER_ADMIN_PASSWORD || ""),
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
const createSuperAdminUser = async () => {
  try {
    if (!DEFAULT_SUPER_ADMIN.email || !DEFAULT_SUPER_ADMIN.password) {
      throw new Error(
        "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be configured to seed the super admin user.",
      );
    }
    if (!validatePasswordStrength(DEFAULT_SUPER_ADMIN.password).isValid) {
      throw new Error(passwordPolicyMessage);
    }
    const existingSuperAdmin = await User.findOne({
      $or: [
        {
          email: DEFAULT_SUPER_ADMIN.email.toLowerCase(),
          tenantId: null,
        },
        {
          role: "super_admin",
        },
      ],
    });
    if (existingSuperAdmin) {
      await ensureDefaultRbacSeedData();
      await assignRolesToUser(existingSuperAdmin, ["super_admin"], {
        assignedBy: existingSuperAdmin._id,
      });
      logger.info("super admin already exists:");
      logger.info({
        id: existingSuperAdmin._id,
        name: existingSuperAdmin.name,
        email: existingSuperAdmin.email,
        role: existingSuperAdmin.role,
      });
      return existingSuperAdmin;
    }
    const superAdmin = await User.create({
      name: DEFAULT_SUPER_ADMIN.name,
      email: DEFAULT_SUPER_ADMIN.email.toLowerCase(),
      password: DEFAULT_SUPER_ADMIN.password,
      role: "super_admin",
      tenantId: null,
      isActive: true,
      forcePasswordChange: false,
    });
    await ensureDefaultRbacSeedData();
    await assignRolesToUser(superAdmin, ["super_admin"], {
      assignedBy: superAdmin._id,
    });
    logger.info("Super admin created successfully.");
    logger.info({
      id: superAdmin._id,
      name: superAdmin.name,
      email: superAdmin.email,
      role: superAdmin.role,
    });
    logger.info("\nSuper Admin Login Credentials:");
    logger.info(`Email: ${DEFAULT_SUPER_ADMIN.email}`);
    logger.info(
      "Password was loaded from SUPER_ADMIN_PASSWORD and is not printed to logs.",
    );
    logger.info("\nLogin URL:");
    logger.info("Frontend: /super-admin/login");
    return superAdmin;
  } catch (error) {
    logger.error("Error creating super admin user:", error);
    if (error.code === 11000) {
      logger.info("Duplicate key error - Super admin might already exist");
    }
    throw error;
  }
};
const seedSuperAdmin = async () => {
  try {
    logger.info("Starting super admin seed...");
    await connectDB();
    await createSuperAdminUser();
    logger.info("Super admin seed completed successfully.");
    mongoose.connection.close();
    logger.info("Database connection closed.");
  } catch (error) {
    logger.error("Super admin seed failed:", error);
    process.exit(1);
  }
};
if (require.main === module) {
  seedSuperAdmin();
}
module.exports = {
  seedSuperAdmin,
  createSuperAdminUser,
};
