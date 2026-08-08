import { Assets } from 'pixi.js'
import {
  canAfford,
  drawInstanceBlinkingSelection,
  payCost,
  refundCost,
  uuidv4,
  capitalizeFirstLetter,
  getHexColor,
  updateObject,
  getActionCondition,
  canUpdateMinimap,
  isValidCondition,
  canPlaceBuildingAt,
  playSoundCue,
} from '../../lib'
import { Building } from '../building'
import type { BuildingOptions } from '../building'
import { Unit } from '../unit'
import type { UnitSpawnOptions } from '../unit'
import {
  ACTION_TYPES,
  AGE_GATE_MAX_UNLOCKABLE_VALUE,
  AGE_UP_ENABLED,
  FAMILY_TYPES,
  PLAYER_TYPES,
  POPULATION_MAX,
  SOUND_CUES,
  UNIT_TYPES,
} from '../../constants'
import { createPlayerData } from '../../config/playerConfig'
import { getRandomUnitName } from '../../config/name'
import { playUiSound } from '../../lib/uiSound'
import { hasLivingChief, playerNeedsChiefForCommand } from '../../lib/chief'
import { VisionGrid } from '../../services/VisionGrid'
import { refreshOwnerWalls } from '../../lib/buildings/walls'
import { updateWallAndNeighbours } from '../../lib/buildings/walls'
import { refreshOwnerTowers } from '../../lib/buildings/towers'
import type { GameContextLike } from '../../types/context'
import type { ConfigOperation, ConfigValue, TechnologyConfig } from '../../types/config'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeMap } from '../../types/map'
import type { PlayerConfigLike, PlayerLike, VisionGridLike } from '../../types/player'
import type { SerializedVisionGrid } from '../../types/vision'
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

function isNumericConfigOperation(operation: ConfigOperation): operation is NumericConfigOperation {
  return (
    typeof operation.key === 'string' &&
    (operation.op === '*' || operation.op === '+') &&
    typeof operation.value === 'number'
  )
}

export type PlayerOptions = Omit<Partial<PlayerLike>, 'team' | 'views'> & {
  difficulty?: string
  team?: number | string | null
  views?: VisionGridLike | SerializedVisionGrid
}

export class Player implements PlayerLike {
  family: string
  context: GameContextLike
  label: string
  parent: RuntimeMap
  i!: number
  j!: number
  type!: string
  wood: number
  food: number
  stone: number
  gold: number
  corpses: UnitEntity[]
  units: UnitEntity[]
  selectedUnits!: UnitEntity[]
  selectedUnit!: UnitEntity | null
  selectedBuilding!: BuildingEntity | null
  selectedOther!: RuntimeEntity | null
  buildings: BuildingEntity[]
  population: number
  technologies: string[]
  researchTechnology: QueuedTechnology | null
  researchLoading: number | null
  researchIntervalId: number | null
  cellViewed: number
  age: number
  lastUnderAttackAlertAt: number
  team!: number | null
  populationMax!: number
  colorHex: string
  config: PlayerConfigLike
  techs: Record<string, TechnologyConfig>
  hasBuilt!: string[]
  views!: VisionGridLike
  isPlayed?: boolean
  color?: string
  civ?: string
  gender?: 'male' | 'female'
  name?: string
  autoTechnologyByAge?: boolean

  constructor(options: PlayerOptions, context: GameContextLike) {
    this.family = FAMILY_TYPES.player
    this.context = context

    const { map } = context
    this.label = uuidv4()
    this.parent = map

    const res = map.startingResources
    this.wood = res.wood ?? 0
    this.food = res.food ?? 0
    this.stone = res.stone ?? 0
    this.gold = res.gold ?? 0
    this.corpses = []
    this.units = []
    this.buildings = []
    this.population = 0
    this.technologies = []
    this.researchTechnology = null
    this.researchLoading = null
    this.researchIntervalId = null
    this.cellViewed = 0
    this.age = 0
    this.lastUnderAttackAlertAt = 0
    Object.assign(this, options)
    const rawTeam = options.team
    this.team = rawTeam == null || rawTeam === '' ? null : Number(rawTeam)
    if (!Number.isFinite(this.team)) this.team = null

    this.populationMax = this.populationMax || (map.instantMode ? POPULATION_MAX : 0)

    this.colorHex = getHexColor(this.color ?? '')
    const { config, techs } = createPlayerData(
      Assets.cache.get('config'),
      Assets.cache.get('technology'),
      this.civ ?? ''
    )
    this.config = config
    this.techs = techs
    const restoredResearch = options.researchTechnology
    if (restoredResearch?.type) {
      this.researchLoading = options.researchLoading ?? 0
      this.buyTechnology(restoredResearch.type, true, true)
    }
    this.hasBuilt = this.hasBuilt || (map.instantMode ? Object.keys(this.config.buildings).map(key => key) : [])
    this.views = new VisionGrid(
      map.size,
      Array.isArray(options.views) ? options.views : [],
      (i, j) => {
        if (this.isPlayed && !map.revealEverything) {
          this.context.menu.updateTerrainMiniMap?.(i, j)
        }
      },
      this.isPlayed && this.type === PLAYER_TYPES.human && map.revealTerrain
    )
  }

  reportThreat(target: RuntimeEntity, attacker: RuntimeEntity) {
    if (!target || target.owner?.label !== this.label || !attacker || attacker.isDead || attacker.isDestroyed) return
    if (!this.isPlayed || this.type !== PLAYER_TYPES.human) return

    const isWindowFocused = document.visibilityState === 'visible' && document.hasFocus()
    const isTargetInCamera = this.context.controls?.instanceInCamera(target) ?? true
    if (isWindowFocused && isTargetInCamera) return

    const now = Date.now()
    if (now - this.lastUnderAttackAlertAt < 5000) return

    this.lastUnderAttackAlertAt = now
    playUiSound(SOUND_CUES.ui.underAttack)
  }

  spawnBuilding(options: BuildingOptions) {
    const building = this.createBuilding(options)
    if (this.isPlayed) {
      let hasSentWorker = false
      let hasSentOther = false

      for (let i = 0; i < this.selectedUnits.length; i++) {
        const unit = this.selectedUnits[i]
        if (unit.type === UNIT_TYPES.villager) {
          if (getActionCondition(unit, building, ACTION_TYPES.build)) {
            hasSentWorker = true
            unit.sendToBuilding(building)
          }
        } else {
          unit.sendTo(building)
          hasSentOther = true
        }
      }
      if (hasSentWorker) {
        drawInstanceBlinkingSelection(building)
      }
      if (hasSentOther) {
        playSoundCue(SOUND_CUES.unit.militaryCommand)
        return
      } else if (hasSentWorker) {
        const voice = this.config.units.Villager?.sounds?.buildCommand
        playSoundCue(voice)
        return
      }
    }

    return building
  }

  isTechnologyEligible(type: string) {
    if (AGE_TECHNOLOGIES.has(type)) return false
    if (this.technologies.includes(type)) return false

    const config = this.techs?.[type]
    if (!config) return false

    return (config.conditions || []).every((condition: Condition) => isValidCondition(condition, this))
  }

  canResearchAgeTechnology(type: string): boolean {
    const config = this.techs?.[type]
    if (!config || !AGE_UP_ENABLED || !AGE_TECHNOLOGIES.has(type)) return false
    return (config.conditions || []).every((condition: Condition) => isValidCondition(condition, this))
  }

  isTechnologyInProgress(_type: string): boolean {
    return false
  }

  startResearchInterval(config: TechnologyConfig): void {
    this.stopResearchInterval()
    const interval = Math.max(1, ((config.researchTime ?? 0) * 1000) / 100)
    this.researchIntervalId = this.context.scheduler.add(
      () => {
        const technology = this.researchTechnology
        if (!technology) return
        const { type } = technology
        if ((this.researchLoading ?? 0) >= 100 || this.context.map.instantMode) {
          this.stopResearchInterval()
          this.researchLoading = null
          this.researchTechnology = null
          this.unlockTechnology(type)
          if (this.isPlayed) {
            this.context.menu.updateActionTarget()
            this.context.menu.updateTopbar()
            this.context.menu.syncTechnologyProgress?.()
          }
        } else {
          this.researchLoading = (this.researchLoading ?? 0) + 1
          if (this.isPlayed) this.context.menu.syncTechnologyProgress?.()
        }
      },
      interval,
      'player.research'
    )
  }

  stopResearchInterval(): void {
    if (this.researchIntervalId != null) {
      this.context.scheduler.remove(this.researchIntervalId)
      this.researchIntervalId = null
    }
  }

  buyTechnology(type: string, alreadyPaid?: boolean, force?: boolean): boolean {
    const {
      context: { menu },
    } = this
    const config = this.techs[type]
    if (!config) return false
    if (!force && playerNeedsChiefForCommand(this) && !hasLivingChief(this)) return false
    if (this.technologies.includes(type)) return false
    if (!force && !this.canResearchAgeTechnology(type) && !this.isTechnologyEligible(type)) return false
    if (!alreadyPaid && !canAfford(this, config.cost)) return false

    if (!alreadyPaid) payCost(this, config.cost)
    this.stopResearchInterval()
    this.researchLoading = null
    this.researchTechnology = null
    this.unlockTechnology(type)
    if (this.isPlayed) {
      menu.updateTopbar()
      menu.updateActionTarget()
      menu.syncTechnologyProgress?.()
    }
    return true
  }

  cancelTechnology(): boolean {
    const technology = this.researchTechnology
    if (!technology) return false
    this.stopResearchInterval()
    refundCost(this, technology.config.cost)
    this.researchTechnology = null
    this.researchLoading = null
    if (this.isPlayed) {
      this.context.menu.updateTopbar()
      this.context.menu.syncTechnologyProgress?.()
    }
    return true
  }

  unlockTechnology(type: string) {
    if (this.technologies.includes(type)) return false

    const config = this.techs?.[type]
    if (!config) return false

    const key = config.key || type
    const currentValue = Reflect.get(this, key) as PlayerTechnologyValue | undefined
    if (Array.isArray(currentValue)) {
      currentValue.push(config.value || type)
    } else {
      Reflect.set(this, key, config.value || type)
    }

    const action = config.action
    if (action) {
      switch (action.type) {
        case 'upgradeUnit':
          this.units.forEach((unit: UnitEntity) => {
            if (unit.type === action.source && action.target) unit.upgrade?.(action.target)
          })
          break
        case 'upgradeBuilding':
          this.buildings.forEach((building: BuildingEntity) => {
            if (building.type === action.source && action.target) {
              building.upgrade?.(action.target)
            }
          })
          break
        case 'improve':
          this.updateConfig(
            (action.operations || []).map((operation: ConfigOperation) => ({
              ...operation,
              value: Number(operation.value),
            }))
          )
          break
        case 'refreshWalls':
          refreshOwnerWalls(this)
          break
        case 'refreshTowers':
          refreshOwnerTowers(this)
          break
      }
    }

    const handler = `on${capitalizeFirstLetter(config.key || '')}Change`
    const handlerFn = Reflect.get(this, handler) as PlayerTechnologyHandler | undefined
    typeof handlerFn === 'function' && handlerFn.call(this, config.value)
    return true
  }

  applyEligibleTechnologies() {
    const unlocked: string[] = []
    let appliedInPass = true

    while (appliedInPass) {
      appliedInPass = false
      for (const type of Object.keys(this.techs || {})) {
        if (!this.isTechnologyEligible(type)) continue
        if (this.unlockTechnology(type)) {
          unlocked.push(type)
          appliedInPass = true
        }
      }
    }

    return unlocked
  }

  onAgeChange() {
    const {
      context: { players, menu },
    } = this
    const refreshSelection = (selection: RuntimeEntity | null | undefined) => {
      if (!selection?.interface) return false
      if (selection.owner?.label !== this.label) return false
      menu.setActionTarget(selection)
      return true
    }

    if (this.autoTechnologyByAge) {
      this.applyEligibleTechnologies()
    }

    if (this.isPlayed) {
      playSoundCue(SOUND_CUES.player.ageAdvance)
    }
    for (let i = 0; i < this.buildings.length; i++) {
      const building = this.buildings[i]
      if (building.isBuilt && !building.isDead) {
        if (building.assetCiv) building.assetAge = this.age
        building.finalTexture?.()
      }
    }
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      if (player.type === PLAYER_TYPES.human) {
        refreshSelection(player.selectedUnit) ||
          refreshSelection(player.selectedBuilding) ||
          refreshSelection(player.selectedOther)
      }
    }
  }

  otherPlayers() {
    const {
      context: { players },
    } = this
    const others = [...players]
    others.splice(players.indexOf(this), 1)
    return others
  }

  isAlliedWith(player: PlayerLike | null | undefined) {
    return !!player && player.label !== this.label && this.team !== null && this.team === player.team
  }

  isEnemy(player: PlayerLike | null | undefined) {
    return !!player && player.label !== this.label && !this.isAlliedWith(player)
  }

  enemyPlayers() {
    return this.otherPlayers().filter(player => this.isEnemy(player))
  }

  visiblePlayers() {
    return [this, ...this.otherPlayers().filter(player => this.isAlliedWith(player))]
  }

  unselectAllUnits() {
    const {
      context: { menu },
    } = this
    for (let i = 0; i < this.selectedUnits.length; i++) {
      this.selectedUnits[i].unselect?.()
    }
    this.selectedUnit = null
    this.selectedUnits = []
    menu.setActionTarget()
  }

  unselectAll() {
    if (this.selectedBuilding) {
      this.selectedBuilding.unselect?.()
      this.selectedBuilding = null
    }
    if (this.selectedOther) {
      this.selectedOther.unselect?.()
      this.selectedOther = null
    }
    this.unselectAllUnits()
  }

  updateConfig(operations: ConfigOperation[]) {
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i]
      if (!isNumericConfigOperation(operation)) continue
      const types = Array.isArray(operation.type) ? operation.type : [operation.type]
      for (let j = 0; j < types.length; j++) {
        const type = types[j] as string
        if (Object.keys(this.config.buildings).includes(type)) {
          this.config.buildings[type] && updateObject(this.config.buildings[type], operation)
        } else if (Object.keys(this.config.units).includes(type)) {
          this.config.units[type] && updateObject(this.config.units[type], operation)
        } else if (this.config.equipment && Object.keys(this.config.equipment).includes(type)) {
          this.config.equipment[type] && updateObject(this.config.equipment[type], operation)
        }
      }
    }
  }

  isBuildingEligible(type: string) {
    const config = this.config.buildings[type]
    if (!config) return false

    // Tant que le passage d'âge est désactivé, l'IA reste bloquée à l'âge 0 : on ne lui ferme pas
    // définitivement l'accès aux bâtiments dont la condition d'âge est atteignable (<=
    // AGE_GATE_MAX_UNLOCKABLE_VALUE). Les conditions sentinelles (ex: "age > 99") restent bloquantes.
    const isUnlockableAiAgeGate = (condition: Condition) =>
      this.type === PLAYER_TYPES.ai &&
      !AGE_UP_ENABLED &&
      condition.key === 'age' &&
      Number(condition.value) <= AGE_GATE_MAX_UNLOCKABLE_VALUE

    return (config.conditions || []).every(
      (condition: Condition) =>
        (this.autoTechnologyByAge && condition.key !== 'age') ||
        isUnlockableAiAgeGate(condition) ||
        isValidCondition(condition, this)
    )
  }

  buyBuilding(i: number, j: number, type: string) {
    const {
      context: { menu, map },
    } = this
    const config = this.config.buildings[type]
    const placementConfig = { ...config, type }
    if (
      canAfford(this, config.cost) &&
      this.isBuildingEligible(type) &&
      canPlaceBuildingAt(map.grid, i, j, placementConfig)
    ) {
      this.spawnBuilding({ i, j, type, isBuilt: map.instantMode })
      payCost(this, config.cost)
      this.isPlayed && menu.updateTopbar()
      return true
    }
    return false
  }

  createUnit(options: UnitSpawnOptions, creationOptions: { preserveType?: boolean } = {}) {
    const { context } = this
    const isHeroUnit = !creationOptions.preserveType && this.isPlayed && !this.units.length
    const name = options.name || (isHeroUnit ? this.name : getRandomUnitName(this.civ, () => context.map.random()))
    const type = isHeroUnit ? UNIT_TYPES.hero : options.type
    let unit = context.map.addChild(
      new Unit(
        {
          ...options,
          type,
          name,
          controlMode: isHeroUnit ? 'hero' : options.controlMode,
          isChief: options.isChief ?? isHeroUnit,
          owner: this,
        },
        context
      )
    )
    canUpdateMinimap(unit, context.player) && context.menu.updatePlayerMiniMapEvt(this)
    return unit
  }

  createBuilding(options: BuildingOptions) {
    const { context } = this
    const building = context.map.addChild(new Building({ ...options, owner: this }, context))
    this.buildings.push(building)
    updateWallAndNeighbours(building)
    canUpdateMinimap(building, context.player) && context.menu.updatePlayerMiniMapEvt(this)
    return building
  }
}
