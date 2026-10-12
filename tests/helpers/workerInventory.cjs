// Explicit carried tools for scenarios testing work planning rather than tool acquisition.
function workerInventory(tool = 'axe_ceramic') {
  return {
    toolsInitialized: true,
    activeWeapons: { tool },
    equipment: ['axe_ceramic', 'pickaxe_ceramic', 'hammer_ceramic', 'scythe_ceramic'].filter(item => item !== tool),
  }
}
module.exports = { workerInventory }
