import { FAMILY_TYPES } from '../../constants'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'

export function updateAIKnowledge(globalCell: RuntimeCell, viewer: PlayerLike, { staticOnly = false } = {}): void {
  const owner = viewer
  const known = viewer.views.getKnownOccupant(globalCell.i, globalCell.j)

  if (globalCell.has && (!known || known.label !== globalCell.has.label)) {
    viewer.views.setKnownOccupant(globalCell.i, globalCell.j, globalCell.has)
    const { has } = globalCell

    if ((has.quantity ?? 0) > 0) {
      owner.foundedResources?.[has.type]?.add(has)
    }

    if (!staticOnly && has.family === FAMILY_TYPES.animal && !has.isDead && owner.foundedAnimals) {
      owner.foundedAnimals.add(has)
    }

    if (!staticOnly && has.family === FAMILY_TYPES.building && (has.hitPoints ?? 0) > 0 && owner.isEnemy?.(has.owner)) {
      owner.foundedEnemyBuildings?.add(has)
      owner.rememberEnemy?.(has)
    }

    if (!staticOnly && has.family === FAMILY_TYPES.unit && (has.hitPoints ?? 0) > 0 && owner.isEnemy?.(has.owner)) {
      owner.foundedEnemyUnits?.add(has)
      owner.rememberEnemy?.(has)
    }
  }
}
