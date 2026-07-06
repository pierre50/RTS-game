import { Assets } from 'pixi.js'
import {
  canAfford,
  drawInstanceBlinkingSelection,
  payCost,
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
import { ACTION_TYPES, FAMILY_TYPES, PLAYER_TYPES, POPULATION_MAX, SOUND_CUES, UNIT_TYPES } from '../../constants'
import { createPlayerData } from '../../config/playerConfig'
import { playUiSound } from '../../lib/uiSound'
import { VisionGrid } from '../../services/VisionGrid'
import { refreshOwnerWalls } from '../../lib/buildings/walls'
import { updateWallAndNeighbours } from '../../lib/buildings/walls'
import { refreshOwnerTowers } from '../../lib/buildings/towers'
import type { GameContextLike } from '../../types/context'
import type { ConfigOperation, TechnologyConfig } from '../../types/config'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeMap } from '../../types/map'
import type { PlayerConfigLike, PlayerLike, VisionGridLike } from '../../types/player'
import type { SerializedVisionGrid } from '../../types/vision'
import type { Condition } from '../../lib/combat'
import type { ResourceAmount } from '../../types/common'

const AGE_TECHNOLOGIES = new Set(['ToolAge', 'BronzeAge', 'IronAge'])

type PlayerDynamicState = ResourceAmount &
  Record<string, unknown> & {
    age: number
    technologies: string[]
  }

export type PlayerOptions = Omit<Partial<PlayerLike>, 'views'> & {
  difficulty?: string
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
    this.cellViewed = 0
    this.age = 0
    this.lastUnderAttackAlertAt = 0
    Object.assign(this, options)
    const rawTeam = this.team as unknown
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
      let hasSentVillager = false
      let hasSentOther = false

      for (let i = 0; i < this.selectedUnits.length; i++) {
        const unit = this.selectedUnits[i]
        if (unit.type === UNIT_TYPES.villager) {
          if (getActionCondition(unit, building, ACTION_TYPES.build)) {
            hasSentVillager = true
            unit.sendToBuilding(building)
          }
        } else {
          unit.sendTo(building)
          hasSentOther = true
        }
      }
      if (hasSentVillager) {
        drawInstanceBlinkingSelection(building)
      }
      if (hasSentOther) {
        playSoundCue(SOUND_CUES.unit.militaryCommand)
        return
      } else if (hasSentVillager) {
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

    return (config.conditions || []).every((condition: Condition) =>
      isValidCondition(condition, this as PlayerDynamicState)
    )
  }

  unlockTechnology(type: string) {
    if (this.technologies.includes(type)) return false

    const config = this.techs?.[type]
    if (!config) return false

    const dynamicPlayer = this as PlayerDynamicState
    const key = config.key || type
    if (Array.isArray(dynamicPlayer[key])) {
      dynamicPlayer[key].push(config.value || type)
    } else {
      dynamicPlayer[key] = config.value || type
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
              ;(building as BuildingEntity & { upgrade?: (target: string) => void }).upgrade?.(action.target)
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
    const handlerFn = dynamicPlayer[handler]
    typeof handlerFn === 'function' && (handlerFn as (value: unknown) => void)(config.value)
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
      menu.setBottombar(selection)
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
    menu.setBottombar()
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
      const types = Array.isArray(operation.type) ? operation.type : [operation.type]
      for (let j = 0; j < types.length; j++) {
        const type = types[j] as string
        if (Object.keys(this.config.buildings).includes(type)) {
          this.config.buildings[type] &&
            updateObject(this.config.buildings[type], operation as unknown as Parameters<typeof updateObject>[1])
        } else if (Object.keys(this.config.units).includes(type)) {
          this.config.units[type] &&
            updateObject(this.config.units[type], operation as unknown as Parameters<typeof updateObject>[1])
        }
      }
    }
  }

  isBuildingEligible(type: string) {
    const config = this.config.buildings[type]
    if (!config) return false

    return (config.conditions || []).every(
      (condition: Condition) =>
        (this.autoTechnologyByAge && condition.key !== 'age') || isValidCondition(condition, this as PlayerDynamicState)
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

  createUnit(options: UnitSpawnOptions) {
    const { context } = this
    let unit = context.map.addChild(new Unit({ ...options, owner: this }, context))
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
