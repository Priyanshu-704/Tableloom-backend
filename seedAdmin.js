const { logger } = require("./utils/logger.js");
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config({ quiet: true });

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error('Database connection error:', error);
    process.exit(1);
  }
};

const createAdminUser = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      $or: [
        { email: 'admin@restaurant.com' },
        { role: 'admin' }
      ]
    });

    if (existingAdmin) {
      logger.info('✅ Admin user already exists:');
      logger.info({
        id: existingAdmin._id,
        name: existingAdmin.name,
        email: existingAdmin.email,
        role: existingAdmin.role
      });
      return existingAdmin;
    }

    // Create admin user
    const adminUser = await User.create({
      name: 'System Administrator',
      email: 'admin2@restaurant.com',
      password: 'AdminTest123@$', 
      role: 'admin',
      isActive: true
    });

    logger.info('✅ Admin user created successfully!');
    logger.info({
      id: adminUser._id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      password: 'AdminTest123@$' // Show the plain password for initial login
    });

    logger.info('\n📋 Login Credentials:');
    logger.info('Email: admin2@restaurant.com');
    logger.info('Password: AdminTest123@$');
    logger.info('\n⚠️  Please change the password after first login!');

    return adminUser;
  } catch (error) {
    logger.error('❌ Error creating admin user:', error);
    
    // More detailed error information
    if (error.code === 11000) {
      logger.info('Duplicate key error - Admin might already exist');
    }
    
    throw error;
  }
};

const seedAdmin = async () => {
  try {
    logger.info('🚀 Starting admin seed...');
    
    // Connect to database
    await connectDB();
    
    // Create admin user
    await createAdminUser();
    
    logger.info('✅ Admin seed completed successfully!');
    logger.info('\n🎯 You can now:');
    logger.info('1. Login with admin credentials');
    logger.info('2. Create other staff members');
    logger.info('3. Set up tables and menu items');
    logger.info('4. Test all features');
    
    // Close connection
    mongoose.connection.close();
    logger.info('📦 Database connection closed.');
    
  } catch (error) {
    logger.error('❌ Seed failed:', error);
    process.exit(1);
  }
};

// Run the seed if this file is executed directly
if (require.main === module) {
  seedAdmin();
}

module.exports = { seedAdmin, createAdminUser };
