import { Assets } from 'pixi.js'
import { getRandomUnitName } from '../../config/name'
import { createPlayerData } from '../../config/playerConfig'
import {
  ACTION_TYPES,
  FADE_DURATION_MS,
  FAMILY_TYPES,
  PLAYER_TYPES,
  POPULATION_MAX,
  SOUND_CUES,
  UNIT_TYPES,
} from '../../constants'
import {
  canUpdateMinimap,
  drawInstanceBlinkingSelection,
  getActionCondition,
  getHexColor,
  playSoundCue,
  updateInstanceVisibility,
  uuidv4,
} from '../../lib'
import { playUiSound } from '../../lib/audio/uiSound'
import { updateWallAndNeighbours } from '../../lib/buildings/walls'
import { definedProperties } from '../../lib/definedProperties'
import { fadeIn } from '../../lib/entities/entityFade'
import type { HeroAppearanceConfig } from '../../lib/lpc/heroAppearance'
import { addEntityToMapSpaceContainer } from '../../lib/mapSpaces'
import { VisionGrid } from '../../services/VisionGrid'
import type { ConfigOperation, TechnologyConfig } from '../../types/config'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeMap } from '../../types/map'
import type { PlayerConfigLike, PlayerLike, VisionGridLike } from '../../types/player'
import type { SerializedVisionGrid } from '../../types/vision'
import type { BuildingOptions } from '../building/Building'
import { Building } from '../building/Building'
import type { UnitSpawnOptions } from '../unit/Unit'
import { Unit } from '../unit/Unit'
import { buyPlayerBuilding, plantPlayerWheatField } from './PlayerBuildingPlacement'
import { initializePlayerRelations, initializePlayerResources } from './PlayerInitialization'
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
  unlockVillagerPopulationMilestoneTechnologies,
  updatePlayerConfig,
} from './PlayerTechnologies'

const DEBUG_STARTING_TECHNOLOGIES = ['Pickaxe', 'HorseTaming']

type QueuedTechnology = { type: string; config: TechnologyConfig }
export type PlayerOptions = Omit<Partial<PlayerLike>, 'team' | 'views'> & {
  difficulty?: string
  isHuman?: boolean
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
  berry!: number
  meat!: number
  wheat!: number
  herb!: number
  toxicHerb!: number
  fiber!: number
  feather!: number
  leather!: number
  sinew!: number
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
  discoveredEquipment: string[]
  discoveredResources: string[]
  researchTechnology: QueuedTechnology | null
  researchLoading: number | null
  researchIntervalId: number | null
  cellViewed: number
  age: number
  lastUnderAttackAlertAt: number
  team!: number | null
  diplomacy!: Exclude<PlayerLike['diplomacy'], undefined>
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
  heroAppearance?: HeroAppearanceConfig
  name?: string
  autoTechnologyByAge?: boolean

  constructor(options: PlayerOptions, context: GameContextLike) {
    this.family = FAMILY_TYPES.player
    this.context = context

    const { map } = context
    this.label = uuidv4()
    this.parent = map

    initializePlayerResources(this, map.startingResources)
    this.corpses = []
    this.units = []
    this.buildings = []
    this.population = 0
    this.technologies = []
    this.discoveredEquipment = []
    this.discoveredResources = []
    this.researchTechnology = null
    this.researchLoading = null
    this.researchIntervalId = null
    this.cellViewed = 0
    this.age = 0
    this.lastUnderAttackAlertAt = 0
    Object.assign(this, options)
    this.discoveredEquipment = this.discoveredEquipment || []
    this.discoveredResources = this.discoveredResources || []
    initializePlayerRelations(this, options)

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
        if (this.isPlayed && !map.revealEverything && this.context.menu.isMiniMapActive?.() !== false) {
          this.context.menu.updateTerrainMiniMap?.(i, j)
        }
      },
      this.isPlayed && this.type === PLAYER_TYPES.human && map.revealTerrain,
      (i, j) => this.context.notifyVisionChange?.({ i, j, player: this })
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

      for (const unit of this.selectedUnits) {
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

  unlockVillagerPopulationMilestoneTechnologies() {
    return unlockVillagerPopulationMilestoneTechnologies(this)
  }

  get villagerPopulation() {
    return this.units.filter(unit => unit.type === UNIT_TYPES.villager && !unit.isDead && !unit.isDestroyed).length
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
    for (const unit of this.selectedUnits) {
      unit.unselect?.()
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

  plantWheatField(i: number, j: number, options: { alreadyPaid?: boolean; spaceId?: string } = {}) {
    return plantPlayerWheatField(this, i, j, options)
  }

  buyBuilding(i: number, j: number, type: string, options: { alreadyPaid?: boolean; spaceId?: string } = {}) {
    return buyPlayerBuilding(this, i, j, type, options)
  }

  createUnit(options: UnitSpawnOptions, creationOptions: { preserveType?: boolean } = {}) {
    const { context } = this
    const isHeroUnit = !creationOptions.preserveType && this.isPlayed && !this.units.length
    const unitGender = options.gender ?? this.gender
    const name =
      options.name || (isHeroUnit ? this.name : getRandomUnitName(this.civ, unitGender, () => context.map.random()))
    const type = isHeroUnit ? UNIT_TYPES.hero : options.type
    let unit = new Unit(
      definedProperties({
        ...options,
        type,
        name,
        controlMode: isHeroUnit ? 'hero' : options.controlMode,
        isChief: options.isChief ?? isHeroUnit,
        owner: this,
      }),
      context
    )
    addEntityToMapSpaceContainer(context.map, unit)
    canUpdateMinimap(unit, context.player) &&
      context.menu.isMiniMapActive?.() !== false &&
      context.menu.updatePlayerMiniMapEvt(this)
    if (!options.suppressCreateSound) {
      updateInstanceVisibility(unit)
      fadeIn(unit, FADE_DURATION_MS)
    }
    if (unit.type === UNIT_TYPES.villager) this.unlockVillagerPopulationMilestoneTechnologies()
    return unit
  }

  createBuilding(options: BuildingOptions) {
    const { context } = this
    const building = new Building({ ...options, owner: this }, context)
    addEntityToMapSpaceContainer(context.map, building)
    this.buildings.push(building)
    updateWallAndNeighbours(building)
    canUpdateMinimap(building, context.player) &&
      context.menu.isMiniMapActive?.() !== false &&
      context.menu.updatePlayerMiniMapEvt(this)
    return building
  }
}
