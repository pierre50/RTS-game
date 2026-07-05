import { BOAT_CORPSE_TIME, CORPSE_TIME, MENU_INFO_IDS, POPULATION_MAX, SHEET_TYPES } from '../../constants'
import { canUpdateMinimap, getTransportCargo, isPlayerEliminated, playAudibleSoundCue, updateInstanceVisibility } from '../../lib'
import type { UnitEntity } from '../../types/entities'

const BOAT_CATEGORY = 'Boat'

export class UnitLifecycle {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  decompose() {
    const unit = this.unit
    const map = unit.context?.map
    unit.setTextures?.(SHEET_TYPES.corpse)
    if (unit.sailSprite) unit.sailSprite.visible = false
    const sprite = unit.sprite as unknown as { loop: boolean; textures: unknown[]; animationSpeed: number; onComplete: (() => void) | null }
    sprite.loop = false
    const corpseTime = unit.category === BOAT_CATEGORY ? BOAT_CORPSE_TIME : CORPSE_TIME
    sprite.animationSpeed = sprite.textures.length / (corpseTime * 60)
    sprite.onComplete = () => unit.clear?.()
    if (map) {
      const cell = map.grid[unit.i][unit.j]
      if (cell.has === unit) {
        cell.has = null
        cell.corpses.add(unit)
        cell.solid = false
      }
    }
  }

  death() {
    const unit = this.unit
    if (unit.category === BOAT_CATEGORY) {
      const corpses = unit.owner?.corpses
      const index = corpses?.indexOf(unit) ?? -1
      if (index < 0) {
        corpses?.push(unit)
      }
      this.decompose()
      return
    }

    unit.setTextures?.(SHEET_TYPES.dying)
    if (unit.sailSprite) unit.sailSprite.visible = false
    unit.zIndex = (unit.zIndex ?? 0) - 1
    const sprite = unit.sprite as unknown as { loop: boolean; onComplete: (() => void) | null }
    sprite.loop = false
    sprite.onComplete = () => {
      updateInstanceVisibility(unit as unknown as Parameters<typeof updateInstanceVisibility>[0])
      const corpses = unit.owner?.corpses
      const index = corpses?.indexOf(unit) ?? -1
      if (index < 0) {
        corpses?.push(unit)
      }
      this.decompose()
    }
  }

  die() {
    const unit = this.unit
    if (unit.isDead) {
      return
    }
    const player = unit.owner
    const menu = unit.context?.menu

    playAudibleSoundCue(unit as unknown as Parameters<typeof playAudibleSoundCue>[0], unit.sounds?.die)

    unit.stopInterval?.()
    clearTimeout(unit.visibilityTimeout as number | undefined)
    if (unit.selected && unit.owner?.isPlayed) {
      ;(player as unknown as { unselectUnit?: (unit: UnitEntity) => void }).unselectUnit?.(unit)
    }
    const dest = unit.dest as unknown as { isUsedBy?: unknown } | null | undefined
    if (dest && dest.isUsedBy === unit) {
      dest.isUsedBy = null
    }
    unit.hitPoints = 0
    unit.path = []
    unit.action = null
    if (unit.transportCapacity) {
      const cargo = getTransportCargo(unit as unknown as Parameters<typeof getTransportCargo>[0]) as unknown as UnitEntity[]
      for (const cargoUnit of [...cargo]) {
        cargoUnit.loadedInTransport = null
        cargoUnit.die?.()
      }
      unit.transportedUnits = []
    }
    unit.eventMode = 'none'
    unit.isDead = true
    unit.context?.map.removeFromInstanceBucket(unit)
    unit.unselect?.()
    if (unit.owner) {
      unit.owner.population--
      if (unit.owner.isPlayed && unit.owner.selectedBuilding && unit.owner.selectedBuilding.displayPopulation) {
        menu?.updateInfo?.(
          MENU_INFO_IDS.populationText,
          unit.owner.population + '/' + Math.min(POPULATION_MAX, unit.owner.populationMax)
        )
      }
      const index = unit.owner.units.indexOf(unit)
      if (index >= 0) {
        unit.owner.units.splice(index, 1)
        if (isPlayerEliminated(unit.owner)) {
          menu?.updatePlayerStats?.()
        }
      }
      if (unit.owner.selectedUnit === unit) {
        menu?.updateInfo?.(MENU_INFO_IDS.hitPoints, unit.hitPoints + '/' + unit.totalHitPoints)
      }
    }
    this.death()
    canUpdateMinimap(unit as unknown as Parameters<typeof canUpdateMinimap>[0], player) && menu?.updatePlayerMiniMapEvt?.(unit.owner!)
    unit.context?.checkVictory?.()
    unit.context?.checkDefeat?.()
  }

  clear() {
    const unit = this.unit
    const map = unit.context?.map
    unit.isDestroyed = true
    const corpses = unit.owner?.corpses
    const index = corpses?.indexOf(unit) ?? -1
    if (index >= 0) {
      corpses?.splice(index, 1)
    }
    if (map) {
      map.grid[unit.i][unit.j].corpses.delete(unit)
      map.removeChild(unit as unknown as Parameters<typeof map.removeChild>[0])
    }
    ;(unit as unknown as { destroy: (options: { children: boolean; texture: boolean }) => void }).destroy({
      children: true,
      texture: false,
    })
  }
}
