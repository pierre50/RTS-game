import type { RuntimeCell } from './map'
import type { AnimalEntity, RuntimeEntity, UnitCreationExtra, UnitEntity, BuildingEntity } from './entities'
import type { SaveDestination, SaveGridPoint, SaveReference } from './save'
import type {
  AnimalConfig,
  BuildingConfig,
  EquipmentStats,
  ProjectileConfig,
  TechnologyConfig,
  UnitConfig,
} from './config'
import type { AssetAge } from './pixi'
import type { SerializedVisionGrid, VisionViewer, VisionViewerRef } from './vision'

export interface VisionGridLike {
  length: number
  size: number
  onViewed?: ((i: number, j: number) => void) | null
  index(i: number, j: number): number
  coordinates(index: number): [number, number]
  addViewer(i: number, j: number, viewer: VisionViewer): void
  removeViewer(i: number, j: number, viewer: VisionViewer): void
  removeViewerEverywhere(viewer: VisionViewer): number[]
  clearVisibility(): void
  clearExploration(): void
  getViewers(i: number, j: number): ReadonlySet<VisionViewerRef>
  hasViewer(i: number, j: number, viewer: VisionViewer): boolean
  isViewed(i: number, j: number): boolean
  isVisible(i: number, j: number): boolean
  setViewed(i: number, j: number): boolean
  getKnownOccupant(i: number, j: number): RuntimeEntity | null
  setKnownOccupant(i: number, j: number, occupant: RuntimeEntity): void
  restoreViewers(resolve: (label: string) => VisionViewer | null): void
  toJSON(): SerializedVisionGrid
}

export interface PlayerConfigLike {
  units: Record<string, UnitConfig>
  buildings: Record<string, BuildingConfig>
  animals?: Record<string, AnimalConfig>
  projectiles?: Record<string, ProjectileConfig>
  equipment?: Record<string, EquipmentStats>
}

export type UnitRestoreReferences = {
  assetAge?: AssetAge
  dest?: RuntimeEntity | RuntimeCell | SaveReference | SaveDestination | null
  previousDest?: RuntimeEntity | RuntimeCell | SaveReference | SaveDestination | null
  realDest?: UnitEntity['realDest'] | SaveDestination | null
  path?: RuntimeCell[] | SaveGridPoint[]
  buildQueue?: BuildingEntity[] | string[]
  blockedGatherApproach?: UnitEntity['blockedGatherApproach'] | { target: SaveReference; action: string } | null
}

export type PlayerUnitCreationOptions = Omit<Partial<UnitEntity>, keyof UnitRestoreReferences> &
  UnitRestoreReferences & { i: number; j: number; type: string; owner?: PlayerLike; suppressCreateSound?: boolean }

type PlayerDiplomacy = 'neutral'

export interface PlayerLike {
  label: string
  i: number
  j: number
  type: string
  civ?: string
  color?: string
  gender?: 'male' | 'female'
  colorHex: string
  name?: string
  factionId?: string | null
  team?: number | null
  diplomacy?: PlayerDiplomacy | null
  age: number
  cellViewed: number
  wood: number
  food: number
  stone: number
  gold: number
  copper: number
  iron: number
  population: number
  populationMax: number
  isPlayed?: boolean
  views: VisionGridLike
  config: PlayerConfigLike
  technologies: string[]
  researchTechnology?: { type?: string; config?: TechnologyConfig } | null
  researchLoading?: number | null
  techs: Record<string, TechnologyConfig>
  selectedUnits: UnitEntity[]
  selectedUnit?: UnitEntity | null
  selectedBuilding?: BuildingEntity | null
  selectedOther?: RuntimeEntity | null
  units: UnitEntity[]
  animals?: AnimalEntity[]
  buildings: BuildingEntity[]
  corpses: UnitEntity[]
  enemyPlayers?: () => PlayerLike[]
  isEnemy?: (other?: PlayerLike | null) => boolean
  buyBuilding?: (i: number, j: number, type: string) => boolean
  plantWheatField?: (i: number, j: number) => boolean
  createBuilding: (
    options: Partial<BuildingConfig> & {
      i: number
      j: number
      type: string
      isBuilt?: boolean
      skipBuiltEffects?: boolean
    }
  ) => BuildingEntity
  createUnit?: (options: PlayerUnitCreationOptions, creationOptions?: { preserveType?: boolean }) => UnitEntity
  createAnimal?: (options: { i: number; j: number; type: string; horseColor?: string }) => RuntimeEntity
  getUnitExtraOptions?: (type: string) => UnitCreationExtra
  unlockTechnology?: (type: string) => void
  buyTechnology?: (type: string, alreadyPaid?: boolean, force?: boolean) => boolean
  cancelTechnology?: () => boolean
  isTechnologyEligible?: (type: string) => boolean
  spawnBuilding?: (
    options: Partial<BuildingConfig> & { i: number; j: number; type: string; isBuilt?: boolean }
  ) => BuildingEntity | undefined
  isBuildingEligible?: (type: string) => boolean
  unselectAll(): void
  unselectUnit?: (unit: UnitEntity) => void
  foundedTrees?: Set<RuntimeEntity>
  foundedBerrybushs?: Set<RuntimeEntity>
  foundedWheats?: Set<RuntimeEntity>
  foundedStones?: Set<RuntimeEntity>
  foundedGolds?: Set<RuntimeEntity>
  foundedCoppers?: Set<RuntimeEntity>
  foundedIrons?: Set<RuntimeEntity>
  foundedResources?: Record<string, Set<RuntimeEntity>>
  foundedAnimals?: Set<RuntimeEntity>
  foundedDeadAnimals?: Set<RuntimeEntity>
  foundedEnemyBuildings?: Set<RuntimeEntity>
  foundedEnemyUnits?: Set<RuntimeEntity>
  rememberEnemy?: (entity: RuntimeEntity) => void
  reportThreat?: (target: RuntimeEntity, attacker: RuntimeEntity) => void
  hasBuilt?: string[]
  autoTechnologyByAge?: boolean
  applyEligibleTechnologies?: () => string[]
  civilizationLevel?: number
}

export type PlacementOwner = PlayerLike
