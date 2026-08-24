import {
  canAfford,
  capitalizeFirstLetter,
  isValidCondition,
  payCost,
  refundCost,
  updateObject,
} from '../../lib'
import {
  AGE_GATE_MAX_UNLOCKABLE_VALUE,
  AGE_UP_ENABLED,
  PLAYER_TYPES,
  SOUND_CUES,
} from '../../constants'
import { playSoundCue } from '../../lib'
import { hasLivingChief, playerNeedsChiefForCommand } from '../../lib/chief'
import { refreshOwnerWalls } from '../../lib/buildings/walls'
import type { GameContextLike } from '../../types/context'
import type { ConfigOperation, ConfigValue, TechnologyConfig } from '../../types/config'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { PlayerConfigLike, PlayerLike } from '../../types/player'
import type { Condition } from '../../lib/combat'

const AGE_TECHNOLOGIES = new Set(['ToolAge', 'BronzeAge', 'IronAge'])

type NumericConfigOperation = ConfigOperation & {
  key: string
  op: '*' | '+'
  value: number
}

type PlayerTechnologyValue = ConfigValue | ConfigValue[]
type PlayerTechnologyHandler = (value?: ConfigValue) => void
type QueuedTechnology = { type: string; config: TechnologyConfig }

type PlayerTechnologyOwner = Omit<
  PlayerLike,
  'canResearchAgeTechnology' | 'isTechnologyEligible' | 'stopResearchInterval' | 'unlockTechnology'
> & {
  age: number
  autoTechnologyByAge?: boolean
  buildings: BuildingEntity[]
  config: PlayerConfigLike
  context: GameContextLike
  isPlayed?: boolean
  researchIntervalId: number | null
  researchLoading: number | null
  researchTechnology: QueuedTechnology | null
  techs: Record<string, TechnologyConfig>
  technologies: string[]
  units: UnitEntity[]
  updateConfig(operations: ConfigOperation[]): void
  unlockTechnology(type: string): boolean
  isTechnologyEligible(type: string): boolean
  canResearchAgeTechnology(type: string): boolean
  stopResearchInterval(): void
}

function isNumericConfigOperation(operation: ConfigOperation): operation is NumericConfigOperation {
  return (
    typeof operation.key === 'string' &&
    (operation.op === '*' || operation.op === '+') &&
    typeof operation.value === 'number'
  )
}

export function isTechnologyEligible(player: PlayerTechnologyOwner, type: string): boolean {
  if (AGE_TECHNOLOGIES.has(type)) return false
  if (player.technologies.includes(type)) return false

  const config = player.techs?.[type]
  if (!config) return false

  return (config.conditions || []).every((condition: Condition) => isValidCondition(condition, player))
}

export function canResearchAgeTechnology(player: PlayerTechnologyOwner, type: string): boolean {
  const config = player.techs?.[type]
  if (!config || !AGE_UP_ENABLED || !AGE_TECHNOLOGIES.has(type)) return false
  return (config.conditions || []).every((condition: Condition) => isValidCondition(condition, player))
}

export function startResearchInterval(player: PlayerTechnologyOwner, config: TechnologyConfig): void {
  player.stopResearchInterval()
  const interval = Math.max(1, ((config.researchTime ?? 0) * 1000) / 100)
  player.researchIntervalId = player.context.scheduler.add(
    () => {
      const technology = player.researchTechnology
      if (!technology) return
      const { type } = technology
      if ((player.researchLoading ?? 0) >= 100 || player.context.map.instantMode) {
        player.stopResearchInterval()
        player.researchLoading = null
        player.researchTechnology = null
        player.unlockTechnology(type)
        if (player.isPlayed) {
          player.context.menu.updateActionTarget()
          player.context.menu.updateTopbar()
          player.context.menu.syncTechnologyProgress?.()
        }
      } else {
        player.researchLoading = (player.researchLoading ?? 0) + 1
        if (player.isPlayed) player.context.menu.syncTechnologyProgress?.()
      }
    },
    interval,
    'player.research'
  )
}

export function stopResearchInterval(player: PlayerTechnologyOwner): void {
  if (player.researchIntervalId != null) {
    player.context.scheduler.remove(player.researchIntervalId)
    player.researchIntervalId = null
  }
}

export function buyTechnology(
  player: PlayerTechnologyOwner,
  type: string,
  alreadyPaid?: boolean,
  force?: boolean
): boolean {
  const {
    context: { menu },
  } = player
  const config = player.techs[type]
  if (!config) return false
  if (!force && playerNeedsChiefForCommand(player) && !hasLivingChief(player)) return false
  if (player.technologies.includes(type)) return false
  if (!force && !player.canResearchAgeTechnology(type) && !player.isTechnologyEligible(type)) return false
  if (!alreadyPaid && !canAfford(player, config.cost)) return false

  if (!alreadyPaid) payCost(player, config.cost)
  player.stopResearchInterval()
  player.researchLoading = null
  player.researchTechnology = null
  player.unlockTechnology(type)
  if (player.isPlayed) {
    menu.updateTopbar()
    menu.updateActionTarget()
    menu.syncTechnologyProgress?.()
  }
  return true
}

export function cancelTechnology(player: PlayerTechnologyOwner): boolean {
  const technology = player.researchTechnology
  if (!technology) return false
  player.stopResearchInterval()
  refundCost(player, technology.config.cost)
  player.researchTechnology = null
  player.researchLoading = null
  if (player.isPlayed) {
    player.context.menu.updateTopbar()
    player.context.menu.syncTechnologyProgress?.()
  }
  return true
}

export function unlockTechnology(player: PlayerTechnologyOwner, type: string): boolean {
  if (player.technologies.includes(type)) return false

  const config = player.techs?.[type]
  if (!config) return false

  const key = config.key || type
  const currentValue = Reflect.get(player, key) as PlayerTechnologyValue | undefined
  if (Array.isArray(currentValue)) {
    currentValue.push(config.value || type)
  } else {
    Reflect.set(player, key, config.value || type)
  }

  const action = config.action
  if (action) {
    switch (action.type) {
      case 'upgradeUnit':
        player.units.forEach((unit: UnitEntity) => {
          if (unit.type === action.source && action.target) unit.upgrade?.(action.target)
        })
        break
      case 'upgradeBuilding':
        player.buildings.forEach((building: BuildingEntity) => {
          if (building.type === action.source && action.target) {
            building.upgrade?.(action.target)
          }
        })
        break
      case 'improve':
        player.updateConfig(
          (action.operations || []).map((operation: ConfigOperation) => ({
            ...operation,
            value: Number(operation.value),
          }))
        )
        break
      case 'refreshWalls':
        refreshOwnerWalls(player)
        break
    }
  }

  const handler = `on${capitalizeFirstLetter(config.key || '')}Change`
  const handlerFn = Reflect.get(player, handler) as PlayerTechnologyHandler | undefined
  typeof handlerFn === 'function' && handlerFn.call(player, config.value)
  return true
}

export function applyEligibleTechnologies(player: PlayerTechnologyOwner): string[] {
  const unlocked: string[] = []
  let appliedInPass = true

  while (appliedInPass) {
    appliedInPass = false
    for (const type of Object.keys(player.techs || {})) {
      if (!player.isTechnologyEligible(type)) continue
      if (player.unlockTechnology(type)) {
        unlocked.push(type)
        appliedInPass = true
      }
    }
  }

  return unlocked
}

export function onAgeChange(player: PlayerTechnologyOwner): void {
  const {
    context: { players, menu },
  } = player
  const refreshSelection = (selection: RuntimeEntity | null | undefined) => {
    if (!selection?.interface) return false
    if (selection.owner?.label !== player.label) return false
    menu.setActionTarget(selection)
    return true
  }

  if (player.autoTechnologyByAge) {
    applyEligibleTechnologies(player)
  }

  if (player.isPlayed) {
    playSoundCue(SOUND_CUES.player.ageAdvance)
  }
  for (let i = 0; i < player.buildings.length; i++) {
    const building = player.buildings[i]
    if (building.isBuilt && !building.isDead) {
      if (building.assetCiv) building.assetAge = player.age
      building.finalTexture?.()
    }
  }
  for (let i = 0; i < players.length; i++) {
    const selectedPlayer = players[i]
    if (selectedPlayer.type === PLAYER_TYPES.human) {
      refreshSelection(selectedPlayer.selectedUnit) ||
        refreshSelection(selectedPlayer.selectedBuilding) ||
        refreshSelection(selectedPlayer.selectedOther)
    }
  }
}

export function updatePlayerConfig(player: PlayerTechnologyOwner, operations: ConfigOperation[]): void {
  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]
    if (!isNumericConfigOperation(operation)) continue
    const types = Array.isArray(operation.type) ? operation.type : [operation.type]
    for (let j = 0; j < types.length; j++) {
      const type = types[j] as string
      if (Object.keys(player.config.buildings).includes(type)) {
        player.config.buildings[type] && updateObject(player.config.buildings[type], operation)
      } else if (Object.keys(player.config.units).includes(type)) {
        player.config.units[type] && updateObject(player.config.units[type], operation)
      } else if (player.config.equipment && Object.keys(player.config.equipment).includes(type)) {
        player.config.equipment[type] && updateObject(player.config.equipment[type], operation)
      }
    }
  }
}

export function isBuildingEligible(player: PlayerTechnologyOwner, type: string): boolean {
  const config = player.config.buildings[type]
  if (!config) return false

  const isUnlockableAiAgeGate = (condition: Condition) =>
    player.type === PLAYER_TYPES.ai &&
    !AGE_UP_ENABLED &&
    condition.key === 'age' &&
    Number(condition.value) <= AGE_GATE_MAX_UNLOCKABLE_VALUE

  return (config.conditions || []).every(
    (condition: Condition) =>
      (player.autoTechnologyByAge && condition.key !== 'age') ||
      isUnlockableAiAgeGate(condition) ||
      isValidCondition(condition, player)
  )
}
