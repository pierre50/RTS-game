function isOperationalBuilding(building) {
  if (!building || building.isDead || building.hitPoints <= 0 || !building.isBuilt) {
    return false
  }

  if (building.range > 0) {
    return true
  }

  return Array.isArray(building.units) && building.units.length > 0
}

export function hasLivingUnits(player) {
  return !!player?.units?.some(unit => unit && !unit.isDead && unit.hitPoints > 0)
}

export function hasOperationalBuildings(player) {
  return !!player?.buildings?.some(isOperationalBuilding)
}

export function canPlayerStillAct(player) {
  return hasLivingUnits(player) || hasOperationalBuildings(player)
}

export function isPlayerEliminated(player) {
  return !canPlayerStillAct(player)
}
