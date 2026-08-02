import { POPULATION_MAX } from '../../constants'
import { capitalizeFirstLetter, isValidCondition } from '../../lib'
import { GAME_SPEED_USAGE, isGameSpeedPreset } from '../../lib/settings'
import type { CommandResult } from '../DevCommandRegistry'
import type { DevConsoleContext, DevEntity, DevPlayer } from '../types'
import { RESOURCE_NAMES, findKey } from './shared'
import { refreshOwnerTowers } from '../../lib/buildings/towers'
import { preloadBakedLpcUnitsForPlayers } from '../../lib/lpc'
import type { ResourceAmount } from '../../types/common'
import type { ConfigOperation, ConfigValue, TechnologyConfig as BaseTechnologyConfig } from '../../types/config'

const AGE_TECHNOLOGIES = new Set(['ToolAge', 'BronzeAge', 'IronAge'])

type TechnologyAction =
  | { type: 'upgradeUnit'; source: string; target: string }
  | { type: 'upgradeBuilding'; source: string; target: string }
  | { type: 'refreshTowers' }
  | { type: 'improve'; operations: ConfigOperation[] }

type DevTechnologyConfig = BaseTechnologyConfig & {
  key: string
  action?: TechnologyAction
}

type DevTechnologyCallback = (value?: ConfigValue) => void

type DevTechnologyPlayer = DevPlayer & {
  [key: string]: ConfigValue | object | DevTechnologyCallback | undefined
  autoTechnologyByAge?: boolean
  enemyPlayers?: () => DevTechnologyPlayer[]
  onAgeChange?: () => void
  populationMax?: number
  updateConfig?: (operations: Array<ConfigOperation & { value: number }>) => void
}

type ResourceName = (typeof RESOURCE_NAMES)[number]

function isResourceName(value: string): value is ResourceName {
  return (RESOURCE_NAMES as readonly string[]).includes(value)
}

function getTechConfig(player: DevTechnologyPlayer, type: string): DevTechnologyConfig | null {
  return (player.techs[type] as DevTechnologyConfig | undefined) ?? null
}

function isTechnologyEligible(player: DevTechnologyPlayer, type: string): boolean {
  if (AGE_TECHNOLOGIES.has(type)) return false
  if (player.technologies.includes(type)) return false
  const config = getTechConfig(player, type)
  if (!config) return false
  return (config.conditions || []).every(condition => isValidCondition(condition, player))
}

function applyEligibleTechnologies(context: DevConsoleContext): string[] {
  const player = context.player as DevTechnologyPlayer
  const unlocked: string[] = []
  let appliedInPass = true

  while (appliedInPass) {
    appliedInPass = false
    for (const type of Object.keys(player?.techs || {})) {
      if (!isTechnologyEligible(player, type)) continue
      const result = applyTechnology(context, type)
      if (result.ok && result.message !== `${type} already unlocked`) {
        unlocked.push(type)
        appliedInPass = true
      }
    }
  }

  return unlocked
}

export function addResources(player: DevPlayer, resourceName: string, amount: number): string {
  const ledger: ResourceAmount = player
  if (resourceName === 'all') {
    RESOURCE_NAMES.forEach(name => {
      ledger[name] = Number(ledger[name] ?? 0) + amount
    })
    return `Added ${amount} to all resources`
  }
  if (!isResourceName(resourceName)) {
    return `Unknown resource: ${resourceName}`
  }
  ledger[resourceName] = Number(ledger[resourceName] ?? 0) + amount
  return `Added ${amount} ${resourceName}`
}

export function applyAllTechnologies(context: DevConsoleContext): CommandResult {
  const player = context.player as DevTechnologyPlayer
  player.autoTechnologyByAge = true
  const unlocked = applyEligibleTechnologies(context)
  return { ok: true, message: `Unlocked ${unlocked.length} technologies` }
}

export function applyTechnology(context: DevConsoleContext, typeName: string): CommandResult {
  const player = context.player as DevTechnologyPlayer
  const { menu } = context
  const type = findKey(player.techs, typeName)
  if (!type) return { ok: false, message: `Unknown technology: ${typeName}` }
  if (player.technologies.includes(type)) return { ok: true, message: `${type} already unlocked` }

  const config = getTechConfig(player, type)
  if (!config) return { ok: false, message: `Unknown technology: ${typeName}` }
  const dynamicPlayer: Record<string, ConfigValue | object | DevTechnologyCallback | undefined> = player
  const currentValue = dynamicPlayer[config.key]
  if (Array.isArray(currentValue)) {
    currentValue.push(config.value || type)
  } else {
    dynamicPlayer[config.key] = config.value || type
  }

  const { action } = config
  if (action) {
    switch (action.type) {
      case 'upgradeUnit':
        player.units.forEach(unit => {
          if (unit.type === action.source)
            (unit as DevEntity & { upgrade?: (target: string) => void }).upgrade?.(action.target)
        })
        break
      case 'upgradeBuilding':
        player.buildings.forEach(building => {
          if (building.type === action.source)
            (building as DevEntity & { upgrade?: (target: string) => void }).upgrade?.(action.target)
        })
        break
      case 'refreshTowers':
        refreshOwnerTowers(player)
        break
      case 'improve':
        player.updateConfig?.(
          action.operations.map(operation => ({
            ...operation,
            value: Number(operation.value),
          }))
        )
        break
    }
  }

  const handler = `on${capitalizeFirstLetter(config.key)}Change`
  const changeHandler = dynamicPlayer[handler]
  if (typeof changeHandler === 'function') {
    ;(changeHandler as (value: ConfigValue) => void)(config.value)
  }
  if (config.key === 'age' && player.autoTechnologyByAge) {
    applyEligibleTechnologies(context)
  }
  menu.updateActionTarget?.()
  menu.updateTopbar()
  return { ok: true, message: `Unlocked ${type}` }
}

export function setAge(context: DevConsoleContext, value: string): CommandResult {
  const age = Number(value)
  if (!Number.isInteger(age) || age < 0 || age > 1) return { ok: false, message: 'Age must be between 0 and 1' }
  context.player.age = age
  const player = context.player as DevTechnologyPlayer
  player.age = age
  player.onAgeChange?.()
  if (player.autoTechnologyByAge) {
    applyEligibleTechnologies(context)
  }
  context.menu.updateActionTarget?.()
  context.menu.updateTopbar()
  return { ok: true, message: `Age set to ${age}` }
}

export function setCiv(context: DevConsoleContext, value: string): CommandResult {
  const civ = value ? capitalizeFirstLetter(value.toLowerCase()) : ''
  if (!civ) return { ok: false, message: 'Usage: civ <name>' }
  context.player.civ = civ
  void preloadBakedLpcUnitsForPlayers([context.player])
  ;(context.player as DevTechnologyPlayer).onAgeChange?.()
  context.menu.updateActionTarget?.()
  return { ok: true, message: `Civilization set to ${civ}` }
}

export function killEntities(context: DevConsoleContext, target = 'enemies'): CommandResult {
  const player = context.player as DevTechnologyPlayer

  if (target === 'enemies') {
    const enemies = player.enemyPlayers?.() ?? []
    let count = 0
    enemies.forEach(enemy => {
      count += enemy.units.length + enemy.buildings.length
      ;[...enemy.units].forEach(u => u.die?.())
      ;[...enemy.buildings].forEach(b => b.die?.())
    })
    if (!count) return { ok: false, message: 'No enemies found' }
    return { ok: true, message: `Killed ${count} enemy entities` }
  }

  if (target === 'all') {
    const count = player.units.length + player.buildings.length
    ;[...player.units].forEach(u => u.die?.())
    ;[...player.buildings].forEach(b => b.die?.())
    return { ok: true, message: `Killed ${count} of your entities` }
  }

  return { ok: false, message: 'Usage: kill [enemies|all]' }
}

export function healAll(context: DevConsoleContext): CommandResult {
  const { player } = context
  ;[...player.units].forEach(u => {
    u.hitPoints = u.totalHitPoints
  })
  ;[...player.buildings].forEach(b => {
    b.hitPoints = b.totalHitPoints
  })
  const count = player.units.length + player.buildings.length
  return { ok: true, message: `Healed ${count} entities to full HP` }
}

export function setGameSpeed(context: DevConsoleContext, value: number | string = 1): CommandResult {
  const speed = Number(value)
  if (!Number.isFinite(speed) || !isGameSpeedPreset(speed)) {
    return { ok: false, message: `Usage: ${GAME_SPEED_USAGE}` }
  }
  if (context.app?.ticker) context.app.ticker.speed = speed
  if (context.scheduler) {
    context.scheduler.timeScale = speed
  }
  return { ok: true, message: `Speed: ${speed}x` }
}

export function toggleInstantMode(context: DevConsoleContext, value: string): CommandResult {
  const { map } = context
  const enabled = value === 'on' ? true : value === 'off' ? false : !map.instantMode
  map.instantMode = enabled
  return { ok: true, message: `Instant build/train/tech: ${enabled ? 'on' : 'off'}` }
}

export function setPopMax(context: DevConsoleContext, value: string): CommandResult {
  const { player, menu } = context
  const amount = value != null ? parseInt(value) : POPULATION_MAX
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, message: 'Usage: popmax [amount]' }
  ;(player as DevTechnologyPlayer).populationMax = amount
  menu.updateTopbar()
  return { ok: true, message: `Population max: ${amount}` }
}
