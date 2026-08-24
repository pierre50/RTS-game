import { Assets } from 'pixi.js'
import {
  canAfford,
  drawInstanceBlinkingSelection,
  payCost,
  uuidv4,
  getHexColor,
  getActionCondition,
  canUpdateMinimap,
  canPlaceBuildingAt,
  playSoundCue,
  updateInstanceVisibility,
  isBuildingLimitReached,
  getBuildingFootprintCells,
} from '../../lib'
import { Building } from '../building'
import type { BuildingOptions } from '../building'
import { Resource } from '../Resource'
import { Unit } from '../unit'
import type { UnitSpawnOptions } from '../unit'
import {
  ACTION_TYPES,
  BUILDING_TYPES,
  FAMILY_TYPES,
  PLAYER_TYPES,
  POPULATION_MAX,
  RESOURCE_NAMES,
  RESOURCE_TYPES,
  SOUND_CUES,
  UNIT_TYPES,
  FADE_DURATION_MS,
} from '../../constants'
import { createPlayerData } from '../../config/playerConfig'
import { getRandomUnitName } from '../../config/name'
import { playUiSound } from '../../lib/uiSound'
import { fadeIn } from '../../lib/entityFade'
import { VisionGrid } from '../../services/VisionGrid'
import { updateWallAndNeighbours } from '../../lib/buildings/walls'
import {
  applyEligibleTechnologies,
  buyTechnology,
  cancelTechnology,
  canResearchAgeTechnology,
  isBuildingEligible,
  isTechnologyEligible,
  onAgeChange,
  startResearchInterval,
  stopResearchInterval,
  unlockTechnology,
  updatePlayerConfig,
} from './PlayerTechnologies'
import type { GameContextLike } from '../../types/context'
import type { ConfigOperation, TechnologyConfig } from '../../types/config'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeMap } from '../../types/map'
import type { PlayerConfigLike, PlayerLike, VisionGridLike } from '../../types/player'
import type { SerializedVisionGrid } from '../../types/vision'

const DEBUG_STARTING_TECHNOLOGIES = ['Pickaxe', 'Farming', 'HorseTaming']

type QueuedTechnology = { type: string; config: TechnologyConfig }
type PlayerResourceMemory = {
  foundedWheats?: Set<RuntimeEntity>
  foundedResources?: Record<string, Set<RuntimeEntity>>
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
  wood!: number
  food!: number
  stone!: number
  gold!: number
  copper!: number
  iron!: number
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
  diplomacy!: PlayerLike['diplomacy']
  factionId!: string | null
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
    for (const resource of RESOURCE_NAMES) {
      this[resource] = res[resource] ?? 0
    }
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
    this.diplomacy = options.diplomacy === 'neutral' ? 'neutral' : null
    this.factionId = typeof options.factionId === 'string' ? options.factionId : null

    this.populationMax = this.populationMax || (map.instantMode ? POPULATION_MAX : 0)

    this.colorHex = getHexColor(this.color ?? '')
    const { config, techs } = createPlayerData(
      Assets.cache.get('config'),
      Assets.cache.get('technology'),
      this.civ ?? ''
    )
    this.config = config
    this.techs = techs
    for (const technology of DEBUG_STARTING_TECHNOLOGIES) {
      if (this.techs[technology] && !this.technologies.includes(technology)) {
        this.technologies.push(technology)
      }
    }
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
    updateInstanceVisibility(building)
    fadeIn(building, FADE_DURATION_MS)
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
    return isTechnologyEligible(this, type)
  }

  canResearchAgeTechnology(type: string): boolean {
    return canResearchAgeTechnology(this, type)
  }

  isTechnologyInProgress(_type: string): boolean {
    return false
  }

  startResearchInterval(config: TechnologyConfig): void {
    startResearchInterval(this, config)
  }

  stopResearchInterval(): void {
    stopResearchInterval(this)
  }

  buyTechnology(type: string, alreadyPaid?: boolean, force?: boolean): boolean {
    return buyTechnology(this, type, alreadyPaid, force)
  }

  cancelTechnology(): boolean {
    return cancelTechnology(this)
  }

  unlockTechnology(type: string) {
    return unlockTechnology(this, type)
  }

  applyEligibleTechnologies() {
    return applyEligibleTechnologies(this)
  }

  onAgeChange() {
    onAgeChange(this)
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

  isNeutralWith(player: PlayerLike | null | undefined) {
    return !!player && player.label !== this.label && (this.diplomacy === 'neutral' || player.diplomacy === 'neutral')
  }

  isEnemy(player: PlayerLike | null | undefined) {
    if (!player || player.label === this.label) return false

    const factions = this.context.getCampaignFactions?.()
    const ownFaction = this.factionId ? factions?.[this.factionId] : null
    const otherFaction = player.factionId ? factions?.[player.factionId] : null
    if (this.factionId && player.factionId && this.factionId === player.factionId) return false
    if (ownFaction) return ownFaction.relationState === 'hostile'
    if (otherFaction) return otherFaction.relationState === 'hostile'

    return !this.isAlliedWith(player) && !this.isNeutralWith(player)
  }

  enemyPlayers() {
    return this.otherPlayers().filter(player => this.isEnemy(player))
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
    updatePlayerConfig(this, operations)
  }

  isBuildingEligible(type: string) {
    return isBuildingEligible(this, type)
  }

  plantWheatField(i: number, j: number) {
    const {
      context: { menu, map },
    } = this
    const config = this.config.buildings[BUILDING_TYPES.farm]
    const placementConfig = { ...config, type: BUILDING_TYPES.farm }
    if (
      canAfford(this, config.cost) &&
      this.isBuildingEligible(BUILDING_TYPES.farm) &&
      canPlaceBuildingAt(map.grid, i, j, placementConfig)
    ) {
      const planted: RuntimeEntity[] = []
      payCost(this, config.cost)
      const size = typeof config.size === 'number' ? config.size : 4
      for (const cell of getBuildingFootprintCells(i, j, map.grid, size)) {
        const wheat = map.addChild(new Resource({ i: cell.i, j: cell.j, type: RESOURCE_TYPES.wheat }, this.context))
        cell.updateVisible()
        fadeIn(wheat, FADE_DURATION_MS)
        map.resources.add(wheat)
        planted.push(wheat)
      }
      const memory = this as PlayerResourceMemory
      planted.forEach(wheat => memory.foundedWheats?.add(wheat))
      planted.forEach(wheat => memory.foundedResources?.[RESOURCE_TYPES.wheat]?.add(wheat))
      this.isPlayed && menu.updateTopbar()
      menu.updateResourcesMiniMap?.()
      return true
    }
    return false
  }

  buyBuilding(i: number, j: number, type: string) {
    if (type === BUILDING_TYPES.farm) return this.plantWheatField(i, j)
    const {
      context: { menu, map },
    } = this
    const config = this.config.buildings[type]
    const placementConfig = { ...config, type }
    if (
      canAfford(this, config.cost) &&
      this.isBuildingEligible(type) &&
      !isBuildingLimitReached(this, type) &&
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
    const unitGender = options.gender ?? this.gender
    const name =
      options.name || (isHeroUnit ? this.name : getRandomUnitName(this.civ, unitGender, () => context.map.random()))
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
    if (!options.suppressCreateSound) {
      updateInstanceVisibility(unit)
      fadeIn(unit, FADE_DURATION_MS)
    }
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
