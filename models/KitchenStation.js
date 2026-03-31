const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");

const kitchenStationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a station name"],
    trim: true,
  },
  stationType: {
    type: String,
    enum: [
      "grill",
      "fryer",
      "salad",
      "dessert",
      "beverage",
      "expediter",
      "fast food",
      "main course",
    ],
    required: true,
  },
  assignedStaff: [
    {
      staff: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
      shiftStart: Date,
      shiftEnd: Date,
      isActive: Boolean,
    },
  ],
  capacity: {
    type: Number,
    default: 1,
    min: 1,
    max: 50,
  },
  currentLoad: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["active", "maintenance", "closed"],
    default: "active",
  },
  preparationTimes: {
    min: Number, // in minutes
    max: Number, // in minutes
    average: Number, // in minutes
  },
  // menuItems: [
  //   {
  //     type: mongoose.Schema.ObjectId,
  //     ref: "MenuItem",
  //   },
  // ],
  colorCode: {
    type: String,
    default: "#4CAF50",
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

kitchenStationSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

kitchenStationSchema.index({ tenantId: 1, name: 1 }, { unique: true });
kitchenStationSchema.plugin(tenantScoped);

module.exports = mongoose.model("KitchenStation", kitchenStationSchema);
