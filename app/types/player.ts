import type { ResourceAmount, UnknownRecord } from './common'
import type { RuntimeCell } from './map'
import type { RuntimeEntity, UnitEntity, BuildingEntity } from './entities'
import type { AnimalConfig, BuildingConfig, ProjectileConfig, TechnologyConfig, UnitConfig } from './config'

export interface VisionGridLike {
  size: number
  onViewed?: ((i: number, j: number) => void) | null
  index(i: number, j: number): number
  coordinates(index: number): [number, number]
  addViewer(i: number, j: number, viewer: unknown): void
  removeViewer(i: number, j: number, viewer: unknown): void
  getViewers(i: number, j: number): ReadonlySet<unknown>
  hasViewer(i: number, j: number, viewer: unknown): boolean
  isViewed(i: number, j: number): boolean
  isVisible(i: number, j: number): boolean
  setViewed(i: number, j: number): boolean
  getKnownOccupant(i: number, j: number): RuntimeEntity | null
  setKnownOccupant(i: number, j: number, occupant: RuntimeEntity): void
  restoreViewers(resolve: (label: string) => unknown): void
  toJSON(): unknown
}

export interface PlayerConfigLike {
  units: Record<string, UnitConfig>
  buildings: Record<string, BuildingConfig>
  animals?: Record<string, AnimalConfig>
  projectiles?: Record<string, ProjectileConfig>
}

export interface PlayerLike {
  label: string
  i: number
  j: number
  type: string
  civ?: string
  color?: string
  colorHex: string
  name?: string
  team?: number | null
  age: number
  cellViewed: number
  wood: number
  food: number
  stone: number
  gold: number
  population: number
  population_max: number
  isPlayed?: boolean
  views: VisionGridLike
  config: PlayerConfigLike
  technologies: string[]
  techs: Record<string, TechnologyConfig>
  selectedUnits: UnitEntity[]
  selectedUnit?: UnitEntity | null
  selectedBuilding?: BuildingEntity | null
  selectedOther?: RuntimeEntity | null
  units: UnitEntity[]
  buildings: BuildingEntity[]
  corpses: UnitEntity[]
  visiblePlayers?: () => PlayerLike[]
  enemyPlayers?: () => PlayerLike[]
  isEnemy?: (other?: PlayerLike | null) => boolean
  buyBuilding?: (i: number, j: number, type: string) => boolean
  createBuilding: (
    options: UnknownRecord & { i: number; j: number; type: string; isBuilt?: boolean; skipBuiltEffects?: boolean }
  ) => BuildingEntity
  createUnit?: (options: UnknownRecord) => UnitEntity
  spawnBuilding?: (
    options: UnknownRecord & { i: number; j: number; type: string; isBuilt?: boolean }
  ) => BuildingEntity | undefined
  isBuildingEligible?: (type: string) => boolean
  unselectAll(): void
  foundedTrees?: Set<RuntimeEntity>
  foundedBerrybushs?: Set<RuntimeEntity>
  foundedStones?: Set<RuntimeEntity>
  foundedGolds?: Set<RuntimeEntity>
  foundedFish?: Set<RuntimeEntity>
  foundedAnimals?: Set<RuntimeEntity>
  foundedDeadAnimals?: Set<RuntimeEntity>
  foundedEnemyBuildings?: Set<RuntimeEntity>
  foundedEnemyUnits?: Set<RuntimeEntity>
  rememberEnemy?: (entity: RuntimeEntity) => void
  reportThreat?: (target: RuntimeEntity, attacker: RuntimeEntity) => void
  hasBuilt?: string[]
  autoTechnologyByAge?: boolean
  applyEligibleTechnologies?: () => string[]
}

export type PlacementOwner = PlayerLike

