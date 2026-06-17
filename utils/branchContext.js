const { AsyncLocalStorage } = require("async_hooks");

const branchStorage = new AsyncLocalStorage();

const runWithBranch = (context, callback) => branchStorage.run(context || null, callback);

const getCurrentBranchContext = () => branchStorage.getStore() || null;

const getCurrentBranchId = () => {
  const context = getCurrentBranchContext();
  if (!context || context.isAllBranches) return null;
  return context.branchId || null;
};

module.exports = {
  runWithBranch,
  getCurrentBranchContext,
  getCurrentBranchId,
};
