import { Assets } from 'pixi.js'
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
getActionCondition,
getHexColor,
playSoundCue,
updateInstanceVisibility,
uuidv4,
} from '../../lib'
import { playUiSound } from '../../lib/audio/uiSound'
import { updateWallAndNeighbours } from '../../lib/buildings/walls'
import { factionIdForCivilization } from '../../lib/campaign/playerRoster'
import { heroCanCommand } from '../../lib/chief'
import { fadeIn } from '../../lib/entities/entityFade'
import { playableColor } from '../../lib/graphics/playableColor'
import type { HeroAppearanceConfig } from '../../lib/lpc/heroAppearance'
import { addEntityToMapSpaceContainer } from '../../lib/mapSpaces'
import { updatePopulationObjectives } from '../../lib/objectives/ageObjectives'
import { isNeutralPlayer } from '../../lib/playerState'
import { VisionGrid } from '../../services/VisionGrid'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity,RuntimeEntity,UnitEntity } from '../../types/entities'
import type { RuntimeMap } from '../../types/map'
import type { PlayerConfigLike,PlayerLike,VisionGridLike } from '../../types/player'
import type { SerializedVisionGrid } from '../../types/vision'
import type { BuildingOptions } from '../building/Building'
import { Building } from '../building/Building'
import type { UnitSpawnOptions } from '../unit/Unit'
import { buyPlayerBuilding,plantPlayerWheatField } from './PlayerBuildingPlacement'
import { initializePlayerRelations,initializePlayerResources } from './PlayerInitialization'
import { isBuildingEligible,onAgeChange } from './PlayerProgression'
import { createPlayerUnit } from './PlayerUnitCreation'

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
  completedObjectives: string[]
  cellViewed: number
  age: number
  lastUnderAttackAlertAt: number
  team!: number | null
  diplomacy!: Exclude<PlayerLike['diplomacy'], undefined>
  factionId!: string | null
  populationMax!: number
  colorHex: string
  config: PlayerConfigLike
  hasBuilt!: string[]
  views!: VisionGridLike
  isPlayed?: boolean
  color?: string
  civ?: string
  gender?: 'male' | 'female'
  heroAppearance?: HeroAppearanceConfig
  name?: string

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
    this.completedObjectives = []
    this.cellViewed = 0
    this.age = 0
    this.lastUnderAttackAlertAt = 0
    Object.assign(this, options)
    this.completedObjectives = this.completedObjectives || []
    initializePlayerRelations(this, options)

    this.populationMax = this.populationMax || (map.instantMode ? POPULATION_MAX : 0)

    if (this.type === PLAYER_TYPES.ai || this.type === PLAYER_TYPES.human) {
      const factions = context.getCampaignFactions?.()
      const faction =
        (this.factionId ? factions?.[this.factionId] : null) ??
        (this.civ ? factions?.[factionIdForCivilization(this.civ)] : null)
      this.color = playableColor(this.type === PLAYER_TYPES.ai ? (faction?.color ?? this.color) : this.color)
    }
    this.colorHex = getHexColor(this.color ?? '')
    this.config = createPlayerData(Assets.cache.get('config'), this.civ ?? '')
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
    if (!heroCanCommand(this.context.controls?.heroUnit)) {
      if (target === this.context.controls?.heroUnit) {
        for (const owner of this.context.players) {
          if (owner.type === PLAYER_TYPES.ai && owner.factionId && owner.factionId === this.factionId)
            owner.reportThreat?.(target, attacker)
        }
      }
      return
    }

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

  updatePopulationObjectives(): void {
    updatePopulationObjectives(this)
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
    if (isNeutralPlayer(this) || isNeutralPlayer(player)) return false

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

  isBuildingEligible(type: string) {
    return isBuildingEligible(this, type)
  }

  plantWheatField(
    i: number,
    j: number,
    options: { alreadyPaid?: boolean; spaceId?: string; buildingAge?: number } = {}
  ) {
    return plantPlayerWheatField(this, i, j, options)
  }

  buyBuilding(
    i: number,
    j: number,
    type: string,
    options: { alreadyPaid?: boolean; spaceId?: string; buildingAge?: number } = {}
  ) {
    return buyPlayerBuilding(this, i, j, type, options)
  }

  createUnit(options: UnitSpawnOptions, creationOptions: { preserveType?: boolean } = {}) {
    return createPlayerUnit.call(this, options, creationOptions)
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
