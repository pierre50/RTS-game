import type { SavedGameData } from '../../classes/map/MapGeneration'
import { getEnvironmentForCiv } from '../../config/environments'
import { civilizationAssetSlug } from '../../lib/civilizationAlias'
import { DEFAULT_MAP_TYPE } from '../../config/mapTypes'
import { CELL_HEIGHT, CELL_WIDTH, ENVIRONMENT_IDS, type EnvironmentId } from '../../constants'
import { pickCampaignPortalFaction } from '../../lib/campaign/playerRoster'
import type { CampaignSave, FactionSave, GameConfig, PortalEncounterKind, SaveEntityState, SerializedSave } from '../../types/save'
import type { PlayerLike } from '../../types/player'
import type { UnitEntity } from '../../types/entities'
import type { RuntimeMap } from '../../types/map'
import type { Application, Container } from 'pixi.js'
import {
  normalizeHeroAppearance,
  normalizeHeroAppearanceGender,
  type HeroHairColor,
} from '../../lib/lpc/heroAppearance'

export function saveConfig(config: SerializedSave['config'] | SerializedSave['world'] | undefined): GameConfig {
  return config || {}
}

export function hasSerializedGrid(save: SerializedSave): boolean {
  return Array.isArray(save.map)
}

export function savedRuntimeState(save: SerializedSave): SavedGameData {
  return save as SavedGameData
}

export function withFogEnabledState(state: SerializedSave): SerializedSave {
  return {
    ...state,
    config: state.config ? { ...state.config, revealEverything: false } : state.config,
  }
}

export type PortalPartyState = {
  followers: SaveEntityState[]
  hero: SaveEntityState | null
}

export type PortalWorldConfig = {
  config: GameConfig
  faction: FactionSave
  factionId: string
}

export { ensureCampaignPlayerRoster } from '../../lib/campaign/playerRoster'

function assignDefined(target: Record<string, unknown>, values: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) target[key] = value
  }
}

function cloneRecord<T>(record: T | undefined): T | undefined {
  return record ? { ...record } : record
}

function cloneHeroInventory(inventory: SaveEntityState['inventory']): SaveEntityState['inventory'] {
  if (!inventory) return inventory
  return {
    resources: cloneRecord(inventory.resources),
    equipment: inventory.equipment ? [...inventory.equipment] : inventory.equipment,
    equipped: cloneRecord(inventory.equipped),
    equippedCounts: cloneRecord(inventory.equippedCounts),
    activeWeapons: cloneRecord(inventory.activeWeapons),
  }
}

export const PORTAL_RESOURCE_TYPE = 'Portal'

export type PortalTravelSpriteSources = {
  body: string
  bodyAtlas: string
  hairBack?: string | null
  hairBackAtlas?: string | null
  hairColor: HeroHairColor
  hairFront: string
  hairFrontAtlas: string
}

export function heroTravelSpriteSources(player: PlayerLike | null | undefined): PortalTravelSpriteSources {
  const civ = civilizationAssetSlug(player?.civ)
  const gender = normalizeHeroAppearanceGender(player?.gender)
  const appearance = normalizeHeroAppearance(player?.heroAppearance, player?.civ, gender)
  return {
    body: `assets/graphics/units/hero/${civ}/${gender}/texture.png`,
    bodyAtlas: `assets/graphics/units/hero/${civ}/${gender}/texture.json`,
    hairBack: null,
    hairBackAtlas: null,
    hairColor: appearance.hairColor,
    hairFront: `assets/graphics/hero/hair/${appearance.hairStyle}/${gender}/texture.png`,
    hairFrontAtlas: `assets/graphics/hero/hair/${appearance.hairStyle}/${gender}/texture.json`,
  }
}

function randomPortalEnvironment(currentEnvironment?: string | null): EnvironmentId {
  const choices = ENVIRONMENT_IDS.filter(environment => environment !== currentEnvironment)
  const pool = choices.length ? choices : ENVIRONMENT_IDS
  return pool[Math.floor(Math.random() * pool.length)] || 'Temperate'
}

function portalEncounterKindForColor(color: 'blue' | 'yellow' | 'red'): PortalEncounterKind {
  return color === 'yellow' ? 'bandit' : 'village'
}

export function extractPortalParty(state: SerializedSave): PortalPartyState {
  const played = state.players.find(player => player.isPlayed)
  const hero = played?.units?.find(unit => unit.controlMode === 'hero' || unit.type === 'Hero' || unit.isChief) ?? null
  return {
    hero,
    followers: (played?.units || []).filter(unit => unit !== hero && unit.followingHero === true),
  }
}

export function applyPortableUnitState(
  target: Partial<SaveEntityState>,
  source: SaveEntityState,
  { keepAlive = false }: { keepAlive?: boolean } = {}
): void {
  assignDefined(target, {
    assetAge: source.assetAge,
    assetCiv: source.assetCiv,
    appearanceVariants: cloneRecord((source as { appearanceVariants?: Record<string, string> }).appearanceVariants),
    controlMode: source.controlMode,
    energy: source.energy,
    experience: cloneRecord(source.experience),
    followingHero: source.followingHero,
    gender: (source as { gender?: unknown }).gender,
    healthRegenDelay: source.healthRegenDelay,
    healthRegenMultiplier: source.healthRegenMultiplier,
    healthRegenRate: source.healthRegenRate,
    hitPoints: source.hitPoints,
    horseColor: source.horseColor,
    companionHorseColor: source.companionHorseColor,
    inventory: cloneHeroInventory(source.inventory),
    isChief: source.isChief,
    lastEnergySpentAt: source.lastEnergySpentAt,
    lastHealthDamagedAt: source.lastHealthDamagedAt,
    lootEquipment: source.lootEquipment ? [...source.lootEquipment] : source.lootEquipment,
    mountedOnHorse: source.mountedOnHorse,
    name: source.name,
    totalEnergy: source.totalEnergy,
    totalHitPoints: source.totalHitPoints,
    work: source.work,
  })
  const totalHitPoints = Number((target as SaveEntityState).totalHitPoints)
  const hitPoints = Number((target as SaveEntityState).hitPoints)
  if (Number.isFinite(totalHitPoints) && totalHitPoints > 0) {
    const minimumHitPoints = keepAlive ? 1 : 0
    ;(target as SaveEntityState).hitPoints = Number.isFinite(hitPoints)
      ? Math.max(minimumHitPoints, Math.min(totalHitPoints, hitPoints))
      : totalHitPoints
  }
  const schedulerNow = (target as UnitEntity).context?.scheduler?.elapsedMs
  if (
    Number.isFinite(schedulerNow) &&
    Number.isFinite((target as SaveEntityState).lastHealthDamagedAt) &&
    ((target as SaveEntityState).lastHealthDamagedAt ?? 0) > (schedulerNow ?? 0)
  ) {
    ;(target as SaveEntityState).lastHealthDamagedAt = schedulerNow
  }
}

export function applyMapConfig(map: RuntimeMap, config: GameConfig = {}): void {
  if (config.size) map.size = config.size
  if (Number.isFinite(config.seed)) map.seed = config.seed
  map.mapType = config.mapType || DEFAULT_MAP_TYPE
  const humanCiv = config.players?.find(player => player.isHuman)?.civ ?? config.players?.[0]?.civ
  map.environment = (config.environment as EnvironmentId | undefined) || getEnvironmentForCiv(humanCiv)
  if (config.instantMode) map.instantMode = true
  map.humanStartsWithoutBase = Boolean(config.humanStartsWithoutBase)
  map.portalEncounter = config.portalEncounter ?? null
  if (config.startingAge != null) map.startingAge = Number(config.startingAge)
  if (config.allTechnologies !== undefined) map.allTechnologies = config.allTechnologies
  if (config.revealEverything !== undefined) map.revealEverything = config.revealEverything
  if (config.revealTerrain !== undefined) map.revealTerrain = config.revealTerrain
  if (config.startingResources) map.startingResources = config.startingResources
  if (config.resourceDensity) map.resourceDensity = config.resourceDensity
  if (config.difficulty) map.difficulty = config.difficulty
}

export function getGameScreenRect(
  view: Pick<Container, 'position' | 'scale'>,
  app: Application
): { x: number; y: number; width: number; height: number } {
  const scaleX = view.scale.x || 1
  const scaleY = view.scale.y || 1
  return {
    x: -view.position.x / scaleX,
    y: -view.position.y / scaleY,
    width: app.screen.width / scaleX,
    height: app.screen.height / scaleY,
  }
}

export function getMapWorldBounds(size: number): { x: number; y: number; width: number; height: number } {
  return {
    x: -(size * CELL_WIDTH) / 2,
    y: 0,
    width: size * CELL_WIDTH,
    height: size * CELL_HEIGHT,
  }
}

export function worldStateWithCampaignClock(
  state: SerializedSave,
  elapsedMs: number | null | undefined
): SerializedSave {
  if (!Number.isFinite(elapsedMs)) return state
  return {
    ...state,
    runtime: {
      ...(state.runtime ?? {}),
      dayNightElapsedMs: Math.max(0, elapsedMs ?? 0),
    },
  }
}

export function portalWorldId(
  currentWorldId: string | null | undefined,
  portal: { i: number; j: number; label?: string },
  color: string
): string {
  const worldId = currentWorldId || 'world'
  const portalId = portal.label || `${portal.i}-${portal.j}`
  return `${worldId}-${portalId}-${color}`.replace(/[^a-zA-Z0-9_-]/g, '-')
}

export function configForPortalWorld({
  campaign,
  color,
  map,
  now,
  player,
  worldId,
}: {
  campaign?: CampaignSave | null
  color: 'blue' | 'yellow' | 'red'
  map: RuntimeMap
  now: number
  player: PlayerLike
  worldId: string
}): PortalWorldConfig {
  const encounter = portalEncounterKindForColor(color)
  const playerTeam = player.team ?? null
  const aiTeam = null
  const playerColor = player.color || color
  const faction = pickCampaignPortalFaction({ campaign, encounter, now, player, portalColor: color, worldId })
  const aiCiv = faction.civilization || player.civ || 'Hellas'
  const factionId = faction.id
  const aiColor = faction.color || 'red'
  const aiDiplomacy = faction.relationState === 'neutral' ? 'neutral' : null
  return {
    config: {
      size: map.size,
      mapType: DEFAULT_MAP_TYPE,
      environment: randomPortalEnvironment(map.environment),
      seed: Math.random() * 9999,
      startingAge: map.startingAge,
      allTechnologies: map.allTechnologies,
      revealEverything: false,
      revealTerrain: map.revealTerrain,
      instantMode: map.instantMode,
      humanStartsWithoutBase: true,
      portalEncounter: encounter,
      startingResources: map.startingResources,
      resourceDensity: map.resourceDensity,
      difficulty: map.difficulty,
      players: [
        {
          civ: player.civ,
          color: playerColor,
          factionId: player.factionId ?? null,
          gender: player.gender,
          isHuman: true,
          name: player.name,
          team: playerTeam,
        },
        {
          civ: aiCiv,
          color: aiColor,
          diplomacy: aiDiplomacy,
          factionId,
          gender: 'male',
          isHuman: false,
          name: faction.name,
          team: aiTeam,
        },
      ],
    },
    faction,
    factionId,
  }
}
