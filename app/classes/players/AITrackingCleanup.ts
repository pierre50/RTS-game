import type { AIPlayerBehaviorHost } from './AIPlayerBehavior'
export function cleanupAITrackingSets(ai: AIPlayerBehaviorHost) {
  for (const resources of Object.values(ai.foundedResources)) {
    for (const resource of resources) {
      if ((resource.quantity ?? 0) <= 0 || resource.isDead) resources.delete(resource)
    }
  }
  for (const animal of ai.foundedAnimals) {
    if (animal.isDead || animal.isDestroyed || (animal.hitPoints ?? 0) <= 0) ai.foundedAnimals.delete(animal)
  }
  for (const animal of ai.foundedDeadAnimals) {
    if (animal.isDestroyed || (animal.quantity ?? 0) <= 0) ai.foundedDeadAnimals.delete(animal)
  }
  for (const building of ai.foundedEnemyBuildings) {
    if (building.isDead || building.isDestroyed || !ai.isEnemy(building.owner))
      ai.foundedEnemyBuildings.delete(building)
  }
  for (const unit of ai.foundedEnemyUnits) {
    if (unit.isDead || unit.isDestroyed || (unit.hitPoints ?? 0) <= 0 || !ai.isEnemy(unit.owner)) {
      ai.foundedEnemyUnits.delete(unit)
    }
  }
  ai._refreshEnemyMemory(ai.enemyBuildingMemory)
  ai._refreshEnemyMemory(ai.enemyUnitMemory)
}
