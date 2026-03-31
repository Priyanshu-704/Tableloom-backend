const Permissions = Object.freeze({
  USER_VIEW_ALL: "user_view_all",
  USER_CREATE: "user_create",
  USER_EDIT: "user_edit",
  USER_DELETE: "user_delete",
  USER_CHANGE_STATUS: "user_change_status",
  USER_CHANGE_ROLE: "user_change_role",
  USER_MANAGE_PERMISSIONS: "user_manage_permissions",

  CATEGORY_TOGGLE_STATUS: "category_toggle_status",
  MENU_CREATE: "menu_create",
  MENU_EDIT: "menu_edit",
  MENU_DELETE: "menu_delete",
  MENU_TOGGLE_AVAILABILITY: "menu_toggle_availability",
  MENU_VIEW_ALL: "menu_view_all",
  MENU_BULK_OPERATIONS: "menu_bulk_operations",
  MENU_IMPORT_EXPORT: "menu_import_export",
  MENU_STATS: "menu_stats",
  PRICE_STATS: "price_stats",
  INVENTORY_VIEW_ALL: "inventory_view_all",
  INVENTORY_CREATE: "inventory_create",
  INVENTORY_EDIT: "inventory_edit",
  INVENTORY_DELETE: "inventory_delete",
  INVENTORY_ADJUST: "inventory_adjust",
  INVENTORY_STATISTICS: "inventory_statistics",

  // Order Management
  ORDER_CREATE: "order_create",
  ORDER_VIEW_ALL: "order_view_all",
  ORDER_VIEW_OWN: "order_view_own",
  ORDER_UPDATE: "order_update",
  ORDER_UPDATE_STATUS: "order_update_status",
  ORDER_UPDATE_ITEM_STATUS: "order_update_item_status",
  ORDER_PROCESS_PAYMENT: "order_process_payment",
  ORDER_DELETE: "order_delete",

  // Table Management
  TABLE_CREATE: "table_create",
  TABLE_EDIT: "table_edit",
  TABLE_DELETE: "table_delete",
  TABLE_VIEW_ALL: "table_view_all",
  TABLE_UPDATE_STATUS: "table_update_status",

  // Customer/Session Management
  SESSION_VIEW_ALL: "session_view_all",
  SESSION_UPDATE: "session_update",
  SESSION_COMPLETE_OFFLINE: "session_complete_offline",
  SESSION_CANCEL: "session_cancel",
  SESSION_STATISTICS: "session_statistics",

  // Kitchen Management
  KITCHEN_VIEW_DASHBOARD: "kitchen_view_dashboard",
  KITCHEN_ACCEPT_ORDER: "kitchen_accept_order",
  KITCHEN_START_PREPARING: "kitchen_start_preparing",
  KITCHEN_MARK_READY: "kitchen_mark_ready",
  KITCHEN_MARK_SERVED: "kitchen_mark_served",
  KITCHEN_MANAGE_STATIONS: "kitchen_manage_stations",

  // Cart Management
  CART_MANAGE: "cart_manage",
  CART_CHECKOUT: "cart_checkout",
  CART_APPLY_DISCOUNT: "cart_apply_discount",

  // Feedback Management
  FEEDBACK_VIEW_ALL: "feedback_view_all",
  FEEDBACK_RESPOND: "feedback_respond",
  FEEDBACK_STATISTICS: "feedback_statistics",

  // Notification Management
  NOTIFICATION_VIEW: "notification_view",
  NOTIFICATION_ANNOUNCE: "notification_announce",

  // Waiter Call Management
  WAITER_CALL_ACKNOWLEDGE: "waiter_call_acknowledge",
  WAITER_CALL_COMPLETE: "waiter_call_complete",
  WAITER_CALL_VIEW_ALL: "waiter_call_view_all",
  WAITER_CALL_STATISTICS: "waiter_call_statistics",

  // Reports & Analytics
  VIEW_REPORTS: "view_reports",
  VIEW_DASHBOARD: "view_dashboard",
  VIEW_STATISTICS: "view_statistics",

  // System
  SYSTEM_SETTINGS: "system_settings",
  BACKUP_RESTORE: "backup_restore",
});

// Default permissions for each role
const RolePermissions = {
  super_admin: Object.values(Permissions),
  admin: Object.values(Permissions),

  manager: [
    Permissions.USER_VIEW_ALL,
    Permissions.USER_CREATE,
    Permissions.USER_EDIT,
    Permissions.USER_CHANGE_STATUS,

    Permissions.CATEGORY_TOGGLE_STATUS,
    Permissions.MENU_CREATE,
    Permissions.MENU_EDIT,
    Permissions.MENU_DELETE,
    Permissions.MENU_TOGGLE_AVAILABILITY,
    Permissions.MENU_VIEW_ALL,
    Permissions.MENU_BULK_OPERATIONS,
    Permissions.MENU_IMPORT_EXPORT,
    Permissions.MENU_STATS,
    Permissions.PRICE_STATS,
    Permissions.INVENTORY_VIEW_ALL,
    Permissions.INVENTORY_CREATE,
    Permissions.INVENTORY_EDIT,
    Permissions.INVENTORY_DELETE,
    Permissions.INVENTORY_ADJUST,
    Permissions.INVENTORY_STATISTICS,

    // Order Management
    Permissions.ORDER_VIEW_ALL,
    Permissions.ORDER_UPDATE_STATUS,
    Permissions.ORDER_UPDATE_ITEM_STATUS,
    Permissions.ORDER_UPDATE,
    Permissions.ORDER_PROCESS_PAYMENT,

    // Table Management
    Permissions.TABLE_CREATE,
    Permissions.TABLE_EDIT,
    Permissions.TABLE_VIEW_ALL,
    Permissions.TABLE_UPDATE_STATUS,

    // Customer/Session Management
    Permissions.SESSION_VIEW_ALL,
    Permissions.SESSION_UPDATE,
    Permissions.SESSION_COMPLETE_OFFLINE,
    Permissions.SESSION_CANCEL,
    Permissions.SESSION_STATISTICS,

    // Kitchen Management
    Permissions.KITCHEN_VIEW_DASHBOARD,
    Permissions.KITCHEN_MANAGE_STATIONS,
    Permissions.INVENTORY_VIEW_ALL,
    Permissions.INVENTORY_CREATE,
    Permissions.INVENTORY_EDIT,
    Permissions.INVENTORY_ADJUST,
    Permissions.INVENTORY_STATISTICS,

    // Feedback Management
    Permissions.FEEDBACK_VIEW_ALL,
    Permissions.FEEDBACK_RESPOND,
    Permissions.FEEDBACK_STATISTICS,

    // Notification Management
    Permissions.NOTIFICATION_VIEW,
    Permissions.NOTIFICATION_ANNOUNCE,

    // Waiter Call Management
    Permissions.WAITER_CALL_VIEW_ALL,
    Permissions.WAITER_CALL_STATISTICS,

    // Reports & Analytics
    Permissions.VIEW_REPORTS,
    Permissions.VIEW_DASHBOARD,
    Permissions.VIEW_STATISTICS,
  ],

  chef: [
    Permissions.KITCHEN_VIEW_DASHBOARD,
    Permissions.KITCHEN_ACCEPT_ORDER,
    Permissions.KITCHEN_START_PREPARING,
    Permissions.ORDER_UPDATE_STATUS,
    Permissions.KITCHEN_MARK_READY,
    Permissions.MENU_TOGGLE_AVAILABILITY,
    Permissions.INVENTORY_VIEW_ALL,
    Permissions.INVENTORY_ADJUST,
    Permissions.ORDER_VIEW_ALL,
    Permissions.ORDER_UPDATE_ITEM_STATUS,
    Permissions.TABLE_VIEW_ALL,
  ],

  waiter: [
    Permissions.ORDER_CREATE,
    Permissions.ORDER_VIEW_OWN,
    Permissions.ORDER_UPDATE,
    Permissions.ORDER_UPDATE_STATUS,
    Permissions.TABLE_VIEW_ALL,
    Permissions.TABLE_UPDATE_STATUS,
    Permissions.SESSION_UPDATE,
    Permissions.SESSION_COMPLETE_OFFLINE,
    Permissions.SESSION_CANCEL,
    Permissions.WAITER_CALL_ACKNOWLEDGE,
    Permissions.WAITER_CALL_COMPLETE,
    Permissions.NOTIFICATION_VIEW,
    Permissions.CART_MANAGE,
    Permissions.CART_CHECKOUT,
    Permissions.ORDER_PROCESS_PAYMENT,
  ],

  customer: [
    Permissions.ORDER_CREATE,
    Permissions.ORDER_VIEW_OWN,
    Permissions.CART_MANAGE,
    Permissions.CART_CHECKOUT,
  ],
};

module.exports = {
  Permissions,
  RolePermissions,
  AllPermissions: Object.values(Permissions),
};
