import { Assets } from 'pixi.js'
import {
  ACTION_TYPES,
  BUILDING_TYPES,
  FAMILY_TYPES,
  LOADING_FOOD_TYPES,
  LOADING_TYPES,
  MENU_INFO_IDS,
  SHEET_TYPES,
  SOUND_CUES,
  TYPE_ACTION,
} from '../../constants'
import {
  degreeToDirection,
  canUpdateMinimap,
  changeSpriteColor,
  getInstanceDegree,
  onSpriteLoopAtFrame,
  updateInstanceVisibility,
  playSoundCue,
  playerCanSeeInstance,
  boardTransport,
  SHOOT_RELEASE_FRAME,
  THRUST_RELEASE_FRAME,
  SLASH_IMPACT_FRAME,
} from '../../lib'
import { Projectile } from '../Projectile'
import { getTowerType, isTower } from '../../lib/buildings/towers'
import { applyBakedLpcUnitAssets } from '../../lib/lpc'
import type { BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { CommandSound } from '../../types/entities'
const BASE_CONVERSION_MIN_CHANTS = 3
const BASE_CONVERSION_CHANCE = 0.3
const ASTROLOGY_CONVERSION_CHANCE = 0.39

const RESOURCE_SEND_TO_BY_TYPE: Record<keyof typeof TYPE_ACTION, (unit: UnitEntity, dest: RuntimeEntity) => boolean> = {
  Stone: (unit, dest) => (unit.sendToStone ? (unit.sendToStone(dest, true), true) : false),
  Gold: (unit, dest) => (unit.sendToGold ? (unit.sendToGold(dest, true), true) : false),
  Berrybush: (unit, dest) => (unit.sendToBerrybush ? (unit.sendToBerrybush(dest, true), true) : false),
  Tree: (unit, dest) => (unit.sendToTree ? (unit.sendToTree(dest, true), true) : false),
  Fish: (unit, dest) => (unit.sendToFish ? (unit.sendToFish(dest, true), true) : false),
}

type OwnerListKey = 'units' | 'buildings'
type PlayerResourceKey = 'food' | 'wood' | 'stone' | 'gold'
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

function isResourceEntity(value: UnitEntity['dest'] | null | undefined): value is ResourceEntity {
  return isRuntimeEntity(value) && value.family === FAMILY_TYPES.resource
}

const ownerList = (owner: PlayerLike | null | undefined, key: OwnerListKey): RuntimeEntity[] | undefined => {
  if (!owner) return undefined
  return key === 'units' ? owner.units : owner.buildings
}

function getPlayerResourceKey(loadingType: string | null | undefined): PlayerResourceKey | null {
  if (!loadingType) return null
  if (LOADING_FOOD_TYPES.includes(loadingType)) return 'food'
  if (loadingType === LOADING_TYPES.wood) return 'wood'
  if (loadingType === LOADING_TYPES.stone) return 'stone'
  if (loadingType === LOADING_TYPES.gold) return 'gold'
  return null
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

// Resources gained per swing (chop/farm/mine/forage/...), separate from
// `gatheringRate` which is now only an AI food-source scoring heuristic
// (app/ai/AIEconomy.ts) — technologies bump this flat amount instead of
// speeding up the animation.
function getGatherAmount(unit: UnitEntity): number {
  return Math.max(1, Math.round(unit.gatherAmount?.[unit.work ?? ''] ?? 1))
}

export class UnitActions {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  restorePreviousWork() {
    const unit = this.unit
    if (!unit.previousWork || unit.work === unit.previousWork) return
    unit.work = unit.previousWork
    unit.previousWork = null
  }

  clearInvalidPreviousTask(): boolean {
    const unit = this.unit
    const previousDest = isRuntimeEntity(unit.previousDest) ? unit.previousDest : null
    if (!previousDest) return false
    if (previousDest.family === FAMILY_TYPES.animal) return false

    if (previousDest.family === FAMILY_TYPES.building) {
      if (
        unit.getActionCondition?.(previousDest, ACTION_TYPES.build) ||
        unit.getActionCondition?.(previousDest, ACTION_TYPES.farm)
      ) {
        return false
      }
      unit.previousDest = null
      return true
    }

    const type = previousDest.category || previousDest.type
    const action = TYPE_ACTION[type as keyof typeof TYPE_ACTION]
    if (!action || !unit.getActionCondition?.(previousDest, action)) {
      unit.previousDest = null
      return true
    }
    return false
  }

  playSound(soundId: CommandSound) {
    const unit = this.unit
    const controls = unit.context?.controls
    if (!soundId || !controls?.instanceIsAudible?.(unit)) return
    playSoundCue(soundId)
  }

  getWorkSound(key: string, fallback: CommandSound = null): CommandSound {
    return this.unit.sounds?.work?.[key] ?? fallback
  }

  getAudibleWorkSound(key: string, fallback: CommandSound = null): CommandSound {
    if (this.unit.silentWorkSounds?.includes(key)) return null
    return this.getWorkSound(key, fallback)
  }

  getConversionRules() {
    const technologies = this.unit.owner?.technologies || []
    return technologies.includes('Astrology')
      ? { minChants: BASE_CONVERSION_MIN_CHANTS, chance: ASTROLOGY_CONVERSION_CHANCE }
      : { minChants: BASE_CONVERSION_MIN_CHANTS, chance: BASE_CONVERSION_CHANCE }
  }

  convertTarget(target: RuntimeEntity): boolean {
    const unit = this.unit
    const menu = unit.context?.menu
    const player = unit.owner
    if (!isConvertibleEntity(target)) return false
    const t = target
    const oldOwner = t.owner
    const newOwner = unit.owner
    if (!oldOwner || !newOwner || oldOwner.label === newOwner.label) return false

    if (t.selected) {
      t.select?.()
      if (player?.selectedOther === target) player.selectedOther = null
    }

    t.stopInterval?.()
    if (t.sprite) {
      t.sprite.onLoop = undefined
      t.sprite.onFrameChange = undefined
      t.sprite.onComplete = undefined
    }
    t.path = []
    t.action = null
    t.dest = null
    t.realDest = null
    t.previousDest = null
    t.previousWork = null
    t.actionLocked = false
    t.pendingOrder = null
    t.blockedGatherApproach = null
    t.inactif = true
    t.assetCiv = t.assetCiv || oldOwner.civ
    t.assetAge = t.assetAge ?? oldOwner.age
    t.owner = newOwner

    if (t.family === FAMILY_TYPES.unit) {
      removeFromOwnerList(oldOwner, 'units', t)
      addToOwnerList(newOwner, 'units', t)
      oldOwner.population = Math.max(0, oldOwner.population - 1)
      newOwner.population += 1
      t.setTextures?.(SHEET_TYPES.standing)
      changeSpriteColor(t.sprite!, newOwner.color ?? '')
    } else if (t.family === FAMILY_TYPES.building) {
      t.assetType = t.assetType || (isTower(t) ? getTowerType(oldOwner) : t.type)
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
        const units = newOwner.isPlayed && menu ? (t.units || []).map(key => menu.getUnitButton?.(key)) : []
        const technologies =
          newOwner.isPlayed && menu ? (t.technologies || []).map(key => menu.getTechnologyButton?.(key)) : []
        t.interface.menu = newOwner.isPlayed
          ? [...units, ...technologies, ...(units.length && menu ? [menu.getRallyPointButton?.()] : [])].filter(
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
    canUpdateMinimap(t, player) && menu?.updatePlayerMiniMapEvt?.(oldOwner)
    canUpdateMinimap(t, player) && menu?.updatePlayerMiniMapEvt?.(newOwner)
    if (newOwner.isPlayed) menu?.updateTopbar()
    unit.stop?.()
    return true
  }

  goBackToPrevious() {
    const unit = this.unit
    const map = unit.context?.map
    this.clearInvalidPreviousTask()
    if (!unit.previousDest) {
      this.restorePreviousWork()
      unit.stop?.()
      return
    }
    const dest = isRuntimeEntity(unit.previousDest) ? unit.previousDest : null
    if (!dest) {
      unit.previousDest = null
      this.restorePreviousWork()
      unit.stop?.()
      return true
    }
    const type = dest.category || dest.type
    unit.previousDest = null
    this.restorePreviousWork()
    if (dest.family === FAMILY_TYPES.animal) {
      if (unit.getActionCondition?.(dest, ACTION_TYPES.takemeat)) {
        unit.sendToTakeMeat?.(dest, true)
      } else if (map) {
        unit.sendToEvt?.(map.grid[dest.i][dest.j], ACTION_TYPES.hunt)
      }
    } else if (dest.family === FAMILY_TYPES.building) {
      if (unit.getActionCondition?.(dest, ACTION_TYPES.build)) {
        if (isBuildingEntity(dest)) unit.sendToBuilding?.(dest)
      } else if (unit.getActionCondition?.(dest, ACTION_TYPES.farm)) {
        unit.sendToFarm?.(dest, true)
      } else if (map) {
        unit.sendToEvt?.(map.grid[dest.i][dest.j], ACTION_TYPES.build)
      }
    } else if (TYPE_ACTION[type as keyof typeof TYPE_ACTION]) {
      const action = TYPE_ACTION[type as keyof typeof TYPE_ACTION]
      if (unit.getActionCondition?.(dest, action)) {
        const sendTo = RESOURCE_SEND_TO_BY_TYPE[type as keyof typeof TYPE_ACTION]
        if (!sendTo(unit, dest)) unit.stop?.()
      } else if (map) {
        unit.sendToEvt?.(map.grid[dest.i][dest.j], action)
      }
    } else if (map) {
      unit.sendToEvt?.(map.grid[dest.i][dest.j])
    }
  }

  startGathering(
    loadingType: string,
    soundId: CommandSound,
    {
      dieOnEmpty = false,
      checkOwner = false,
      updateTexture = false,
      releaseFrame = SLASH_IMPACT_FRAME,
      onRelease,
    }: {
      dieOnEmpty?: boolean
      checkOwner?: boolean
      updateTexture?: boolean
      releaseFrame?: number
      onRelease?: () => void
    } = {}
  ) {
    const unit = this.unit
    const menu = unit.context?.menu
    if (!unit.getActionCondition?.(unit.dest)) {
      unit.affectNewDest?.()
      return
    }
    unit.setTextures?.(SHEET_TYPES.action)
    if (!unit.sprite) return
    onSpriteLoopAtFrame(unit.sprite, releaseFrame, () => {
      onRelease?.()
      const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
      if (!unit.getActionCondition?.(dest)) {
        if (dieOnEmpty && dest && (dest.quantity ?? 0) <= 0) {
          dest.die?.()
        }
        unit.affectNewDest?.()
        return
      }
      const maxLoad = unit.loadingMax?.[loadingType] ?? Infinity
      const wasEmpty = (unit.loading ?? 0) === 0
      const gain = Math.min(getGatherAmount(unit), Math.max(maxLoad - (unit.loading ?? 0), 0))
      if (!dest || gain <= 0) {
        unit.sendToDelivery?.()
        return
      }
      unit.loading = (unit.loading ?? 0) + gain
      unit.loadingType = loadingType
      unit.updateInterfaceLoading?.()
      this.playSound(soundId)
      if (updateTexture) dest.updateTexture?.()
      dest.quantity = Math.max((dest.quantity ?? 0) - gain, 0)
      if (dest.selected && (!checkOwner || unit.owner?.isPlayed)) {
        menu?.updateInfo?.(MENU_INFO_IDS.quantityText, dest.quantity)
      }
      if ((dest.quantity ?? 0) <= 0) {
        if (dieOnEmpty) dest.die?.()
        unit.affectNewDest?.()
      }
      if (wasEmpty) {
        const workAssets = unit.work ? unit.allAssets?.[unit.work] : undefined
        if (workAssets) {
          unit.walkingSheet = Assets.cache.get(workAssets.loadedSheet)
          unit.standingSheet = Assets.cache.get(workAssets.standingSheet)
        }
      }
    })
  }

  upgrade(type: string) {
    const unit = this.unit
    const menu = unit.context?.menu
    const data = unit.owner?.config.units[type]
    if (!data) return
    unit.type = type
    unit.hitPoints = (data.totalHitPoints as number) - ((unit.totalHitPoints ?? 0) - (unit.hitPoints ?? 0))
    Object.assign(unit, data)
    applyBakedLpcUnitAssets(unit)
    Object.assign(
      unit,
      Object.fromEntries(Object.entries(unit.assets ?? {}).map(([key, value]) => [key, Assets.cache.get(value)]))
    )
    if (unit.action && !unit.path?.length) {
      unit.getAction?.(unit.action)
    } else {
      unit.setTextures?.(unit.currentSheet ?? SHEET_TYPES.standing)
    }
    if (unit.owner?.isPlayed && unit.owner.selectedUnit === unit) {
      menu?.setBottombar(unit)
    }
  }

  getAction(name: string) {
    const unit = this.unit
    const menu = unit.context?.menu
    const player = unit.owner
    const map = unit.context?.map
    const sprite = unit.sprite
    if (!sprite) return
    sprite.onLoop = undefined
    sprite.onFrameChange = undefined
    switch (name) {
      case ACTION_TYPES.delivery: {
        if (!unit.getActionCondition?.(unit.dest, unit.action ?? undefined)) {
          unit.stop?.()
          return
        }
        const resourceKey = getPlayerResourceKey(unit.loadingType)
        if (resourceKey && unit.owner) {
          unit.owner[resourceKey] = (unit.owner[resourceKey] ?? 0) + (unit.loading ?? 0)
        }
        unit.owner?.isPlayed && menu?.updateTopbar()
        unit.loading = 0
        unit.updateInterfaceLoading?.()
        const workAssets = unit.work ? unit.allAssets?.[unit.work] : undefined
        if (workAssets) {
          unit.standingSheet = Assets.cache.get(workAssets.standingSheet)
          unit.walkingSheet = Assets.cache.get(workAssets.walkingSheet)
        }
        unit.setTextures?.(SHEET_TYPES.standing)
        if (unit.previousDest) {
          unit.goBackToPrevious?.()
        } else {
          unit.stop?.()
        }
        break
      }
      case ACTION_TYPES.farm: {
        if (!unit.getActionCondition?.(unit.dest)) {
          unit.affectNewDest?.()
          return
        }
        const dest = isBuildingEntity(unit.dest) ? unit.dest : null
        if (!dest) return
        dest.isUsedBy = unit
        unit.setTextures?.(SHEET_TYPES.action)
        if (!unit.sprite) return
        onSpriteLoopAtFrame(unit.sprite, SLASH_IMPACT_FRAME, () => {
          const d = isBuildingEntity(unit.dest) ? unit.dest : null
          if (!unit.getActionCondition?.(d)) {
            if ((d?.quantity ?? 0) <= 0) {
              d?.die?.()
            }
            unit.affectNewDest?.()
            return
          }
          if (d) d.isUsedBy = unit
          const maxLoad = unit.loadingMax?.[LOADING_TYPES.wheat] ?? Infinity
          const wasEmpty = (unit.loading ?? 0) === 0
          const gain = Math.min(getGatherAmount(unit), Math.max(maxLoad - (unit.loading ?? 0), 0))
          if (!d || gain <= 0) {
            unit.sendToDelivery?.()
            if (d) d.isUsedBy = null
            return
          }
          unit.loading = (unit.loading ?? 0) + gain
          unit.loadingType = LOADING_TYPES.wheat
          unit.updateInterfaceLoading?.()
          this.playSound(this.getWorkSound('gatherFood', SOUND_CUES.villager.gatherFood))
          d.quantity = Math.max((d.quantity ?? 0) - gain, 0)
          if (d.selected) {
            menu?.updateInfo?.(MENU_INFO_IDS.quantityText, d.quantity)
          }
          if ((d.quantity ?? 0) <= 0) {
            d.die?.()
            unit.affectNewDest?.()
          }
          if (wasEmpty) {
            const workAssets2 = unit.work ? unit.allAssets?.[unit.work] : undefined
            if (workAssets2) {
              unit.walkingSheet = Assets.cache.get(workAssets2.loadedSheet)
            }
            unit.standingSheet = null
          }
        })
        break
      }
      case ACTION_TYPES.chopwood: {
        if (!unit.getActionCondition?.(unit.dest)) {
          unit.affectNewDest?.()
          return
        }
        unit.setTextures?.(SHEET_TYPES.action)
        if (!unit.sprite) return
        onSpriteLoopAtFrame(unit.sprite, SLASH_IMPACT_FRAME, () => {
          const dest = isResourceEntity(unit.dest) ? unit.dest : null
          if (!unit.getActionCondition?.(dest)) {
            if ((dest?.quantity ?? 0) <= 0) {
              dest?.die?.()
            }
            unit.affectNewDest?.()
            return
          }
          if (!dest) return
          const maxLoad = unit.loadingMax?.[LOADING_TYPES.wood] ?? Infinity
          if ((unit.loading ?? 0) >= maxLoad) {
            unit.sendToDelivery?.()
            return
          }
          this.playSound(this.getWorkSound('chopWood', SOUND_CUES.villager.chopWood))
          if ((dest.hitPoints ?? 0) > 0) {
            dest.hitPoints = Math.max((dest.hitPoints ?? 0) - 1, 0)
            if (dest.selected) {
              dest.drawHealthBar?.()
              menu?.updateInfo?.(
                MENU_INFO_IDS.hitPoints,
                (dest.hitPoints ?? 0) > 0 ? dest.hitPoints + '/' + dest.totalHitPoints : ''
              )
            }
            if ((dest.hitPoints ?? 0) <= 0) {
              dest.hitPoints = 0
              dest.setCuttedTreeTexture?.()
            }
          } else {
            const wasEmpty = (unit.loading ?? 0) === 0
            const gain = Math.min(getGatherAmount(unit), maxLoad - (unit.loading ?? 0))
            unit.loading = (unit.loading ?? 0) + gain
            unit.loadingType = LOADING_TYPES.wood
            unit.updateInterfaceLoading?.()
            dest.quantity = Math.max((dest.quantity ?? 0) - gain, 0)
            if (dest.selected) {
              menu?.updateInfo?.(MENU_INFO_IDS.quantityText, dest.quantity)
            }
            if ((dest.quantity ?? 0) <= 0) {
              dest.die?.()
              unit.affectNewDest?.()
            }
            if (wasEmpty) {
              const workAssets3 = unit.work ? unit.allAssets?.[unit.work] : undefined
              if (workAssets3) {
                unit.walkingSheet = Assets.cache.get(workAssets3.loadedSheet)
              }
              unit.standingSheet = null
            }
          }
        })
        break
      }
      case ACTION_TYPES.forageberry:
        this.startGathering(LOADING_TYPES.berry, this.getWorkSound('forageBerry', SOUND_CUES.villager.forageBerry), {
          dieOnEmpty: true,
        })
        break
      case ACTION_TYPES.minestone:
        this.startGathering(LOADING_TYPES.stone, this.getWorkSound('mineStone', SOUND_CUES.villager.mineOre), {
          dieOnEmpty: true,
        })
        break
      case ACTION_TYPES.minegold:
        this.startGathering(LOADING_TYPES.gold, this.getWorkSound('mineGold', SOUND_CUES.villager.mineOre))
        break
      case ACTION_TYPES.build: {
        if (!unit.getActionCondition?.(unit.dest)) {
          unit.affectNewDest?.()
          return
        }
        unit.setTextures?.(SHEET_TYPES.action)
        if (!unit.sprite) return
        onSpriteLoopAtFrame(unit.sprite, SLASH_IMPACT_FRAME, () => {
          const dest = isBuildingEntity(unit.dest) ? unit.dest : null
          if (!unit.getActionCondition?.(dest)) {
            if (dest?.isBuilt && unit.continueBuildingQueue?.()) return
            if (dest?.type === BUILDING_TYPES.farm && !dest.isUsedBy) {
              unit.sendToFarm?.(dest, true)
              return
            }
            unit.affectNewDest?.()
            return
          }
          if (!dest) return
          if ((dest.hitPoints ?? 0) < (dest.totalHitPoints ?? 0)) {
            this.playSound(this.getWorkSound('build', SOUND_CUES.villager.buildLoop))
            dest.hitPoints = Math.min(
              Math.round((dest.hitPoints ?? 0) + (dest.totalHitPoints ?? 0) / (dest.constructionTime ?? 1)),
              dest.totalHitPoints ?? 0
            )
            if (dest.selected) {
              dest.drawHealthBar?.()
              if (unit.owner?.isPlayed) {
                menu?.updateInfo?.(MENU_INFO_IDS.hitPoints, dest.hitPoints + '/' + dest.totalHitPoints)
              }
            }
            dest.updateHitPoints?.(unit.action ?? '')
          } else {
            if (!dest.isBuilt) {
              dest.updateHitPoints?.(unit.action ?? '')
              dest.isBuilt = true
              if (dest.type === BUILDING_TYPES.farm && !dest.isUsedBy) {
                unit.sendToFarm?.(dest, true)
                return
              }
            }
            if (unit.continueBuildingQueue?.()) return
            unit.affectNewDest?.()
          }
        })
        break
      }
      case ACTION_TYPES.attack:
        unit.unitCombat?.handleAttackAction()
        break
      case ACTION_TYPES.heal:
        if (!unit.getActionCondition?.(unit.dest)) {
          unit.affectNewDest?.()
          return
        }
        unit.setTextures?.(SHEET_TYPES.action)
        sprite.onLoop = () => {
          const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
          if (!unit.getActionCondition?.(dest)) {
            unit.affectNewDest?.()
            return
          }
          if (unit.destHasMoved?.() && dest && unit.realDest) {
            unit.realDest.i = dest.i
            unit.realDest.j = dest.j
            unit.realDest.x = dest.x
            unit.realDest.y = dest.y
            const oldDeg = unit.degree
            unit.degree = getInstanceDegree(unit, dest.x, dest.y)
            if (degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
              unit.setTextures?.(SHEET_TYPES.action)
            }
          }
          if (!unit.isUnitAtDest?.(unit.action, dest)) {
            unit.sendToEvt?.(dest ?? null, ACTION_TYPES.heal, { forceRepath: true })
            return
          }
          if (dest && (dest.hitPoints ?? 0) < (dest.totalHitPoints ?? 0)) {
            this.playSound(unit.sounds?.heal)
            dest.hitPoints = Math.min((dest.hitPoints ?? 0) + (unit.healing ?? 0), dest.totalHitPoints ?? 0)
            if (dest.selected) {
              dest.drawHealthBar?.()
              if (player?.selectedUnit === dest) {
                menu?.updateInfo?.(MENU_INFO_IDS.hitPoints, dest.hitPoints + '/' + dest.totalHitPoints)
              }
            }
          }
        }
        break
      case ACTION_TYPES.convert:
        if (!unit.getActionCondition?.(unit.dest)) {
          unit.affectNewDest?.()
          return
        }
        unit.conversionChants = 0
        unit.setTextures?.(SHEET_TYPES.action)
        sprite.onLoop = () => {
          const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
          if (!unit.getActionCondition?.(dest)) {
            unit.affectNewDest?.()
            return
          }
          if (unit.destHasMoved?.() && dest && unit.realDest) {
            unit.realDest.i = dest.i
            unit.realDest.j = dest.j
            unit.realDest.x = dest.x
            unit.realDest.y = dest.y
            const oldDeg = unit.degree
            unit.degree = getInstanceDegree(unit, dest.x, dest.y)
            if (degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
              unit.setTextures?.(SHEET_TYPES.action)
            }
          }
          if (!unit.isUnitAtDest?.(unit.action, dest)) {
            unit.sendToEvt?.(dest ?? null, ACTION_TYPES.convert, { forceRepath: true })
            return
          }

          this.playSound(unit.sounds?.convert)
          unit.conversionChants = (unit.conversionChants || 0) + 1
          const { minChants, chance } = this.getConversionRules()
          if (unit.conversionChants >= minChants && map && map.random() < chance && dest) {
            this.convertTarget(dest)
          }
        }
        break
      case ACTION_TYPES.loadTransport:
        if (!unit.getActionCondition?.(unit.dest, ACTION_TYPES.loadTransport)) {
          unit.affectNewDest?.()
          return
        }
        {
          const transport = isUnitEntity(unit.dest) ? unit.dest : null
          if (!transport) return
          boardTransport(unit, transport)
          if (transport.owner?.isPlayed && transport.selected) {
            menu?.setBottombar(transport)
          }
        }
        break
      case ACTION_TYPES.takemeat:
        this.startGathering(LOADING_TYPES.meat, this.getWorkSound('takeMeat', null), {
          checkOwner: true,
          updateTexture: true,
        })
        break
      case ACTION_TYPES.fishing:
        this.startGathering(LOADING_TYPES.fish, this.getAudibleWorkSound('fishing'), {
          checkOwner: true,
          dieOnEmpty: true,
          releaseFrame: THRUST_RELEASE_FRAME,
          onRelease:
            unit.category !== 'Boat'
              ? () => this.playSound(this.getWorkSound('throwSpear', SOUND_CUES.villager.throwSpear))
              : undefined,
        })
        break
      case ACTION_TYPES.hunt: {
        if (!unit.getActionCondition?.(unit.dest)) {
          unit.affectNewDest?.()
          return
        }
        const huntDest = isRuntimeEntity(unit.dest) ? unit.dest : null
        if (!huntDest) {
          unit.affectNewDest?.()
          return
        }
        if (huntDest.isDead) {
          unit.previousDest ? unit.goBackToPrevious?.() : unit.sendToTakeMeat?.(huntDest)
          return
        }
        unit.setTextures?.(SHEET_TYPES.action)
        sprite.onLoop = () => {
          const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
          if (!unit.getActionCondition?.(dest)) {
            if (dest && (dest.hitPoints ?? 0) <= 0) {
              dest.die?.()
              unit.previousDest ? unit.goBackToPrevious?.() : unit.sendToTakeMeat?.(dest)
              return
            }
            unit.affectNewDest?.()
            return
          }
          if (!unit.isUnitAtDest?.(unit.action, dest)) {
            if (unit.context?.map?.revealEverything || (dest && playerCanSeeInstance(dest, unit.owner))) {
              unit.sendToEvt?.(dest ?? null, ACTION_TYPES.hunt, { forceRepath: true })
            } else {
              unit.stop?.()
            }
            return
          }
          if (unit.destHasMoved?.() && dest && unit.realDest) {
            unit.realDest.i = dest.i
            unit.realDest.j = dest.j
            unit.realDest.x = dest.x
            unit.realDest.y = dest.y
            const oldDeg = unit.degree
            unit.degree = getInstanceDegree(unit, dest.x, dest.y)
            if (degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
              unit.setTextures?.(SHEET_TYPES.action)
            }
          }
        }
        if (unit.sprite) {
          onSpriteLoopAtFrame(unit.sprite, SHOOT_RELEASE_FRAME, () => {
            const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
            if (!dest || !unit.getActionCondition?.(dest) || !unit.realDest || !map) return
            const projectile = new Projectile(
              {
                owner: unit,
                target: dest,
                type: 'Spear',
                destination: unit.realDest,
                damage: 4,
              },
              unit.context!
            )
            map.addChild(projectile)
          })
        }
        break
      }
      default:
        unit.stop?.()
    }
  }
}
