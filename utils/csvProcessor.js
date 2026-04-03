const csv = require("csv-parser");
const { Readable } = require("stream");

exports.parseCSV = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const readableStream = Readable.from(fileBuffer.toString());

    readableStream
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
};

exports.validateMenuItemData = (data) => {
  const errors = [];

  data.forEach((row, index) => {
    const rowNumber = index + 2;

    // Required fields validation
    if (!row.name) {
      errors.push(`Row ${rowNumber}: Name is required`);
    }

    if (!row.price || isNaN(parseFloat(row.price))) {
      errors.push(`Row ${rowNumber}: Valid price is required`);
    }

    if (!row.category) {
      errors.push(`Row ${rowNumber}: Category is required`);
    }

  
    if (row.price && parseFloat(row.price) < 0) {
      errors.push(`Row ${rowNumber}: Price cannot be negative`);
    }

   
    if (
      row.isVegetarian &&
      !["true", "false", "0", "1"].includes(row.isVegetarian.toLowerCase())
    ) {
      errors.push(`Row ${rowNumber}: isVegetarian must be true/false`);
    }

    if (
      row.isNonVegetarian &&
      !["true", "false", "0", "1"].includes(row.isNonVegetarian.toLowerCase())
    ) {
      errors.push(`Row ${rowNumber}: isNonVegetarian must be true/false`);
    }
    if (
      row.isVegan &&
      !["true", "false", "0", "1"].includes(row.isVegan.toLowerCase())
    ) {
      errors.push(`Row ${rowNumber}: isVegan must be true/false`);
    }

    if (
      row.isGlutenFree &&
      !["true", "false", "0", "1"].includes(row.isGlutenFree.toLowerCase())
    ) {
      errors.push(`Row ${rowNumber}: isGlutenFree must be true/false`);
    }

    
    if (
      row.spiceLevel &&
      (isNaN(parseInt(row.spiceLevel)) ||
        parseInt(row.spiceLevel) < 0 ||
        parseInt(row.spiceLevel) > 5)
    ) {
      errors.push(`Row ${rowNumber}: Spice level must be between 0-5`);
    }
  });

  return errors;
};

exports.generateCSVTemplate = () => {
  const headers = [
    "name",
    "description",
    "category",
    "size",
    "price",
    "costPrice",
    "ingredients",
    "allergens",
    "spiceLevel",
    "preparationTime",
    "isVegetarian",
    "isNonVegetarian",
    "isVegan",
    "isGlutenFree",
    "isAvailable",
    "isActive",
    "tags",
    "calories",
    "protein",
    "carbs",
    "fat",
    "displayOrder",
    "isSeasonal",
    "startDate",
    "endDate",
    "seasonName",
  ];

  const exampleRows = [
    {
      name: "Margherita Pizza",
      description: "Classic cheese pizza",
      category: "Pizzas",
      size: "REG",
      price: "199",
      costPrice: "120",
      ingredients: JSON.stringify(["Pizza Dough", "Mozzarella", "Tomato Sauce"]),
      allergens: JSON.stringify(["Milk", "Gluten"]),
      spiceLevel: "0",
      preparationTime: "15",
      isVegetarian: "true",
      isNonVegetarian: "false",
      isVegan: "false",
      isGlutenFree: "false",
      isAvailable: "true",
      isActive: "true",
      tags: JSON.stringify(["popular", "classic"]),
      calories: "320",
      protein: "12",
      carbs: "38",
      fat: "14",
      displayOrder: "1",
      isSeasonal: "false",
      startDate: "",
      endDate: "",
      seasonName: "",
    },
    {
      name: "Mango Shake",
      description: "Seasonal mango shake",
      category: "Beverages",
      size: "L",
      price: "149",
      costPrice: "85",
      ingredients: JSON.stringify(["Milk", "Mango Pulp", "Sugar"]),
      allergens: JSON.stringify(["Milk"]),
      spiceLevel: "0",
      preparationTime: "5",
      isVegetarian: "true",
      isNonVegetarian: "false",
      isVegan: "false",
      isGlutenFree: "true",
      isAvailable: "true",
      isActive: "true",
      tags: JSON.stringify(["seasonal", "summer"]),
      calories: "240",
      protein: "6",
      carbs: "34",
      fat: "8",
      displayOrder: "2",
      isSeasonal: "true",
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      seasonName: "Summer Special",
    },
  ];

  const escapeCsvValue = (value = "") => {
    const stringValue = String(value ?? "");
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const rows = exampleRows.map((row) =>
    headers.map((header) => escapeCsvValue(row[header] || "")).join(","),
  );

  return `${headers.join(",")}\n${rows.join("\n")}\n`;
};


exports.generateExportData = (menuItems) => {
  const headers = [
    "ID",
    "Name",
    "Description",
    "Size",
    "Price",
    "Cost Price",
    "Category",
    "Ingredients",
    "Allergens",
    "Spice Level",
    "Preparation Time",
    "Vegetarian",
    "isNonVegetarian",
    "Vegan",
    "Gluten Free",
    "Tags",
    "Calories",
    "Protein (g)",
    "Carbs (g)",
    "Fat (g)",
    "Available",
    "Active",
    "Order Count",
    "Last Ordered",
    "Display Order",
    "Seasonal",
    "Season Start",
    "Season End",
    "Season Name",
    "Created At",
  ];

  const rows = [];

  menuItems.forEach((item) => {
    if (!item.prices || item.prices.length === 0) {
      rows.push([
        item._id,
        `"${item.name}"`,
        `"${item.description || ""}"`,
        "",
        "",
        "",
        item.category?.name || "",
        `"${item.ingredients?.join(", ") || ""}"`,
        `"${item.allergens?.join(", ") || ""}"`,
        item.spiceLevel,
        item.preparationTime,
        item.isVegetarian ? "Yes" : "No",
        item.isNonVegetarian ? "Yes" : "No",
        item.isVegan ? "Yes" : "No",
        item.isGlutenFree ? "Yes" : "No",
        `"${item.tags?.join(", ") || ""}"`,
        item.nutritionalInfo?.calories || "",
        item.nutritionalInfo?.protein || "",
        item.nutritionalInfo?.carbs || "",
        item.nutritionalInfo?.fat || "",
        item.isAvailable ? "Yes" : "No",
        item.isActive ? "Yes" : "No",
        item.orderCount || 0,
        item.lastOrdered || "",
        item.displayOrder || 0,
        item.seasonal?.isSeasonal ? "Yes" : "No",
        item.seasonal?.startDate || "",
        item.seasonal?.endDate || "",
        item.seasonal?.seasonName || "",
        formatDate(item.createdAt),
      ]);
      return;
    }

   
    item.prices.forEach((priceObj) => {
      rows.push([
        item._id,
        `"${item.name}"`,
        `"${item.description || ""}"`,
        priceObj.sizeId?.code || "", 
        priceObj.price || "", 
        priceObj.costPrice ?? "", 
        item.category?.name || "",
        `"${item.ingredients?.join(", ") || ""}"`,
        `"${item.allergens?.join(", ") || ""}"`,
        item.spiceLevel,
        item.preparationTime,
        item.isVegetarian ? "Yes" : "No",
        item.isNonVegetarian ? "Yes" : "No",
        item.isVegan ? "Yes" : "No",
        item.isGlutenFree ? "Yes" : "No",
        `"${item.tags?.join(", ") || ""}"`,
        item.nutritionalInfo?.calories || "",
        item.nutritionalInfo?.protein || "",
        item.nutritionalInfo?.carbs || "",
        item.nutritionalInfo?.fat || "",
        item.isAvailable ? "Yes" : "No",
        item.isActive ? "Yes" : "No",
        item.orderCount || 0,
        item.lastOrdered || "",
        item.displayOrder || 0,
        item.seasonal?.isSeasonal ? "Yes" : "No",
        item.seasonal?.startDate || "",
        item.seasonal?.endDate || "",
        item.seasonal?.seasonName || "",
        formatDate(item.createdAt),
      ]);
    });
  });

  const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");

  return csvContent;
};

const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
