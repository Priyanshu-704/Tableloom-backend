const mongoose = require("mongoose");
const { RolePermissions } = require("../config/permissions");
const tenantScoped = require("../plugins/tenantScoped");

const defaultStaffRoles = [
  {
    id: 1,
    key: "admin",
    name: "Admin",
    permissions: [...RolePermissions.admin],
  },
  {
    id: 2,
    key: "manager",
    name: "Manager",
    permissions: [...RolePermissions.manager],
  },
  {
    id: 3,
    key: "chef",
    name: "Chef",
    permissions: [...RolePermissions.chef],
  },
  {
    id: 4,
    key: "waiter",
    name: "Waiter",
    permissions: [...RolePermissions.waiter],
  },
  {
    id: 5,
    key: "customer",
    name: "Customer",
    permissions: [...RolePermissions.customer],
  },
];

const defaultBusinessHours = {
  Monday: { open: "11:00", close: "22:00", closed: false },
  Tuesday: { open: "11:00", close: "22:00", closed: false },
  Wednesday: { open: "11:00", close: "22:00", closed: false },
  Thursday: { open: "11:00", close: "23:00", closed: false },
  Friday: { open: "11:00", close: "23:00", closed: false },
  Saturday: { open: "10:00", close: "23:00", closed: false },
  Sunday: { open: "10:00", close: "21:00", closed: false },
};

const appSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "app-settings",
    },
    restaurant: {
      name: { type: String, default: "QuickBite Restaurant" },
      address: {
        type: String,
        default: "123 Food Street, Culinary District, 10001",
      },
      phone: { type: String, default: "+1 (555) 123-4567" },
      email: { type: String, default: "info@quickbite.com" },
      website: { type: String, default: "www.quickbite.com" },
      description: {
        type: String,
        default:
          "Experience the finest dining with our carefully crafted menu featuring local and international cuisine.",
      },
      logo: { type: String, default: "/logo.png" },
      theme: { type: String, default: "light" },
    },
    businessHours: {
      type: mongoose.Schema.Types.Mixed,
      default: defaultBusinessHours,
    },
    taxSettings: {
      taxRate: { type: Number, default: 9 },
      serviceCharge: { type: Number, default: 10 },
      taxInclusive: { type: Boolean, default: false },
      currency: { type: String, default: "USD" },
      currencySymbol: { type: String, default: "$" },
    },
    paymentMethods: {
      cash: { type: Boolean, default: true },
      card: { type: Boolean, default: true },
      upi: { type: Boolean, default: true },
      digitalWallet: { type: Boolean, default: false },
      splitBill: { type: Boolean, default: true },
    },
    notifications: {
      newOrders: { type: Boolean, default: true },
      orderUpdates: { type: Boolean, default: true },
      lowStock: { type: Boolean, default: true },
      tableCalls: { type: Boolean, default: true },
      reservationReminders: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: false },
    },
    staff: {
      roles: {
        type: [
          {
            id: Number,
            key: String,
            name: String,
            permissions: [String],
          },
        ],
        default: defaultStaffRoles,
      },
    },
    operations: {
      delayMonitor: {
        enabled: { type: Boolean, default: true },
        intervalMinutes: { type: Number, default: 5, min: 1, max: 59 },
        notifyOnDelay: { type: Boolean, default: true },
        criticalThresholdMinutes: {
          type: Number,
          default: 15,
          min: 1,
          max: 240,
        },
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

appSettingSchema.plugin(tenantScoped);
appSettingSchema.index({ tenantId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("AppSetting", appSettingSchema);
