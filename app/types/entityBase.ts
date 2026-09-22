import type { ContactProfileOverride } from '../lib/contact/contactTypes'
import type { AnimatedSprite, Container, DestroyOptions, Sprite } from 'pixi.js'
import type { GameContextLike } from './context'
import type { GridPosition, Point } from './grid'
import type { RuntimeCell } from './map'
import type { MenuButtonSpec } from './ui'
import type { PlayerLike } from './player'
import type { RuntimeEntity } from './entityRuntime'

export type EntityLightSourceConfig = {
  color?: string
  flicker?: number
  intensity?: number
  offsetX?: number
  offsetY?: number
  radius?: number
  verticalScale?: number
}

export type EntityInfoRenderOptions = {
  // Character-sheet views (the hero's inventory "Infos" tab) want every XP category listed even
  // at level 1; the compact side-HUD/modal/NPC-orders views stay filtered to earned categories only.
  showAllXp?: boolean
  // Conversations hide numerical information until the hero becomes chief.
  hideStats?: boolean
  // Modal windows already carry the entity identity in their title; hide duplicate identity labels
  // inside the stat panel while keeping useful metadata such as civ/level/hit points.
  hideIdentity?: boolean
  actionsContainer?: HTMLElement
}

export interface EntityInterfaceLike {
  info?: (element: HTMLElement, options?: EntityInfoRenderOptions) => void
  menu?: MenuButtonSpec[]
}

export interface RuntimeEntityBase extends GridPosition, Point {
  contact?: ContactProfileOverride
  label: string
  spaceId?: string
  family: string
  type: string
  name?: string
  category?: string
  owner?: PlayerLike
  x: number
  y: number
  z?: number | null
  zIndex?: number
  size?: number
  interactionFootprintFactor?: number
  width: number
  height: number
  visible?: boolean
  alpha?: number
  occlusionFade?: boolean
  providesVision?: boolean
  requiresActiveSightInteraction?: boolean
  overheadIndicatorOffsetX?: number
  overheadIndicatorOffsetY?: number
  lightSource?: EntityLightSourceConfig | null
  selected?: boolean
  color?: string
  hitPoints?: number
  totalHitPoints?: number
  devInvincible?: boolean
  indestructible?: boolean
  sight?: number
  quantity?: number
  totalQuantity?: number
  /** Resolves when the death pose has finished, before corpse decomposition. */
  deathAnimationComplete?: Promise<void>
  isDead?: boolean
  isDestroyed?: boolean
  isNaturalResource?: boolean
  sprite?: Sprite | AnimatedSprite
  reliefLift?: number
  context?: GameContextLike
  interface?: EntityInterfaceLike
  select?: () => void
  unselect?: () => void
  die?: (immediate?: boolean) => void
  pause?: () => void
  resume?: () => void
  getChildByLabel?: (label: string) => Container | Sprite | AnimatedSprite | null
  addChild?: Container['addChild']
  addChildAt: Container['addChildAt']
  removeChild: Container['removeChild']
  updateTexture?: () => void
  drawHealthBar?: () => void
  removeHealthBar?: () => void
  drawEnergyBar?: () => void
  removeEnergyBar?: () => void
  drawHeroPowerBar?: (ratio: number) => void
  removeHeroPowerBar?: () => void
  shouldKeepHealthBarVisible?: () => boolean
  getMountedRiderY?: () => number
  isAttacked?: (attacker: RuntimeEntity, hitDirection?: Point) => void
  detect?: (instance: RuntimeEntity) => void
  stopAttackInterval?: () => void
  interval?: number | null
  stopInterval?: () => void
  stopTimeout?: () => void
  destroy?: (options?: DestroyOptions) => void
  animalBehavior?: { stop?: () => void }
  clear?: () => void
  setTextures?: (sheet: string) => void
  currentCell?: RuntimeCell | null
}
