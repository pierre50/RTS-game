import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES } from '../../constants'
import {
  canUpdateMinimap,
  isBanditOwner,
  playAudibleSoundCue,
  showConversionFeedback,
  syncMovedActionTarget,
  updateInstanceVisibility,
} from '../../lib'
import { grantUnitXp, XP_CATEGORIES, XP_CONVERT_SUCCESS } from '../../lib/unitExperience'
import { spendOrWaitForEnergy } from '../../lib/unitEnergy'
import { syncEntityHealthDisplay } from '../../lib/entityHealthDisplay'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

const BASE_CONVERSION_MIN_CHANTS = 3
const BASE_CONVERSION_CHANCE = 0.3
const ASTROLOGY_CONVERSION_CHANCE = 0.39

type OwnerListKey = 'units' | 'buildings'
type ConvertibleEntity = (UnitEntity | BuildingEntity) & Partial<UnitEntity & BuildingEntity>

function isRuntimeEntity(value: UnitEntity['dest'] | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

function isUnitEntity(value: UnitEntity['dest'] | null | undefined): value is UnitEntity {
  return isRuntimeEntity(value) && value.family === FAMILY_TYPES.unit
}

function isBuildingEntity(value: UnitEntity['dest'] | null | undefined): value is BuildingEntity {
  return isRuntimeEntity(value) && value.family === FAMILY_TYPES.building
}

const ownerList = (owner: PlayerLike | null | undefined, key: OwnerListKey): RuntimeEntity[] | undefined => {
  if (!owner) return undefined
  return key === 'units' ? owner.units : owner.buildings
}

function removeFromOwnerList(
  owner: PlayerLike | null | undefined,
  key: 'units' | 'buildings',
  instance: RuntimeEntity
) {
  const list = ownerList(owner, key)
  if (!Array.isArray(list)) return
  const index = list.indexOf(instance)
  if (index >= 0) list.splice(index, 1)
}

function addToOwnerList(owner: PlayerLike | null | undefined, key: 'units' | 'buildings', instance: RuntimeEntity) {
  const list = ownerList(owner, key)
  if (!Array.isArray(list) || list.includes(instance)) return
  list.push(instance)
}

function isConvertibleEntity(target: RuntimeEntity): target is ConvertibleEntity {
  return isUnitEntity(target) || isBuildingEntity(target)
}

const lastConversionDebugAt = new Map<string, number>()

function debugConversionFailure(
  converter: UnitEntity,
  target: RuntimeEntity,
  reason: string,
  details: Record<string, unknown> = {}
): void {
  if (!converter.owner?.isPlayed) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const key = `${converter.label ?? 'converter'}:${target.label ?? 'target'}:${reason}`
  const last = lastConversionDebugAt.get(key) ?? 0
  if (now - last < 600) return
  lastConversionDebugAt.set(key, now)
  console.warn('[conversion]', reason, {
    converter: {
      label: converter.label,
      type: converter.type,
      owner: converter.owner?.label,
      action: converter.action,
    },
    target: {
      label: target.label,
      type: target.type,
      family: target.family,
      owner: target.owner?.label,
      hitPoints: target.hitPoints,
      isDead: target.isDead,
      isDestroyed: target.isDestroyed,
    },
    ...details,
  })
}

function clearConvertedUnitRuntimeState(target: ConvertibleEntity): void {
  target.stopInterval?.()
  if (target.energyWaitTaskId != null) {
    target.context?.scheduler?.remove(target.energyWaitTaskId)
    target.energyWaitTaskId = null
  }
  if (target.sprite) {
    target.sprite.onLoop = undefined
    target.sprite.onFrameChange = undefined
    target.sprite.onComplete = undefined
  }
  target.path = []
  target.action = null
  target.dest = null
  target.realDest = null
  target.previousDest = null
  target.previousWork = null
  target.waitingForEnergyAction = null
  target.waitingForEnergyTarget = null
  target.combatMode = null
  target.lastCombatRecoveryMoveAt = null
  target.actionLocked = false
  target.pendingOrder = null
  target.blockedGatherApproach = null
  target.inactif = true
}

export class UnitConversionAction {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  playConversionSound(): void {
    const unit = this.unit
    if (!unit.sounds?.convert) return
    playAudibleSoundCue(unit, unit.sounds.convert, { profile: 'voice' })
  }

  getConversionRules() {
    const technologies = this.unit.owner?.technologies || []
    return technologies.includes('Astrology')
      ? { minChants: BASE_CONVERSION_MIN_CHANTS, chance: ASTROLOGY_CONVERSION_CHANCE }
      : { minChants: BASE_CONVERSION_MIN_CHANTS, chance: BASE_CONVERSION_CHANCE }
  }

  convertTarget(target: RuntimeEntity, options: { grantXp?: boolean; stopConverter?: boolean } = {}): boolean {
    const unit = this.unit
    const grantXpOnSuccess = options.grantXp ?? true
    const stopConverter = options.stopConverter ?? true
    const menu = unit.context?.menu
    const player = unit.owner
    if (!isConvertibleEntity(target)) {
      debugConversionFailure(unit, target, 'target-not-convertible')
      return false
    }
    const t = target
    const oldOwner = t.owner
    const newOwner = unit.owner
    if (!oldOwner || !newOwner || oldOwner.label === newOwner.label) {
      debugConversionFailure(unit, target, 'invalid-owner', {
        oldOwner: oldOwner?.label,
        newOwner: newOwner?.label,
      })
      return false
    }
    if (isBanditOwner(newOwner)) {
      debugConversionFailure(unit, target, 'bandit-owner-cannot-convert', {
        newOwner: newOwner.label,
      })
      return false
    }

    if (t.selected) {
      t.select?.()
      if (player?.selectedOther === target) player.selectedOther = null
    }

    clearConvertedUnitRuntimeState(t)
    t.assetCiv = t.assetCiv || oldOwner.civ
    t.assetAge = t.assetAge ?? oldOwner.age
    t.owner = newOwner

    if (t.family === FAMILY_TYPES.unit) {
      removeFromOwnerList(oldOwner, 'units', t)
      addToOwnerList(newOwner, 'units', t)
      oldOwner.population = Math.max(0, oldOwner.population - 1)
      newOwner.population += 1
      t.setTextures?.(SHEET_TYPES.standing)
    } else if (t.family === FAMILY_TYPES.building) {
      t.assetType = t.assetType || t.type
      removeFromOwnerList(oldOwner, 'buildings', t)
      addToOwnerList(newOwner, 'buildings', t)
      if (t.increasePopulation && t.populationCapacityApplied) {
        oldOwner.populationMax = Math.max(0, oldOwner.populationMax - t.increasePopulation)
        newOwner.populationMax += t.increasePopulation
      }
      t.clearRallyPoint?.()
      t.queue = []
      t.technology = null
      t.loading = null
      t.finalTexture?.()
      if (t.interface) {
        const units = newOwner.isPlayed && menu ? (t.units || []).map(key => menu.getActionUnitButton?.(key, t)) : []
        t.interface.menu = newOwner.isPlayed
          ? [...units, ...(units.length && menu ? [menu.getActionRallyPointButton?.()] : [])].filter(
              (item): item is NonNullable<typeof item> => Boolean(item)
            )
          : []
      }
      if (t.isBuilt && !newOwner.hasBuilt?.includes(t.type)) {
        newOwner.hasBuilt?.push(t.type)
      }
    } else {
      return false
    }

    updateInstanceVisibility(t)
    showConversionFeedback?.(t, newOwner.color ?? newOwner.colorHex)
    if (t.selected || t.shouldKeepHealthBarVisible?.()) {
      syncEntityHealthDisplay(t, { menu, player: newOwner })
    } else {
      t.removeHealthBar?.()
    }
    canUpdateMinimap(t, player) && menu?.updatePlayerMiniMapEvt?.(oldOwner)
    canUpdateMinimap(t, player) && menu?.updatePlayerMiniMapEvt?.(newOwner)
    if (newOwner.isPlayed) menu?.updateTopbar()
    if (grantXpOnSuccess) grantUnitXp(unit, XP_CATEGORIES.healing, XP_CONVERT_SUCCESS)
    if (stopConverter) unit.stop?.()
    return true
  }

  handleConvertAction() {
    const unit = this.unit
    const map = unit.context?.map
    const sprite = unit.sprite
    if (!sprite) return
    if (!unit.getActionCondition?.(unit.dest)) {
      const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
      if (dest) debugConversionFailure(unit, dest, 'action-condition-failed', { stage: 'start' })
      unit.affectNewDest?.()
      return
    }
    unit.conversionChants = 0
    unit.setTextures?.(SHEET_TYPES.action)
    sprite.onLoop = () => {
      const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
      if (!unit.getActionCondition?.(dest)) {
        if (dest) debugConversionFailure(unit, dest, 'action-condition-failed', { stage: 'loop' })
        unit.affectNewDest?.()
        return
      }
      syncMovedActionTarget(unit, dest)
      if (!unit.isUnitAtDest?.(unit.action, dest)) {
        unit.sendToEvt?.(dest ?? null, ACTION_TYPES.convert, { forceRepath: true })
        return
      }

      if (!spendOrWaitForEnergy(unit, unit.action, dest)) return
      this.playConversionSound()
      unit.conversionChants = (unit.conversionChants || 0) + 1
      const { minChants, chance } = this.getConversionRules()
      if (unit.conversionChants >= minChants && map && map.random() < chance && dest) {
        this.convertTarget(dest)
      }
    }
  }
}
