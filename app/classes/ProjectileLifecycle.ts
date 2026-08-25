import { ARROW_GROUND_TIME, FADE_DURATION_MS } from '../constants'
import { fadeOutThenClear } from '../lib/entityFade'
import { getReliefOffset, getTerrainSetZIndex, isometricToCartesian, randomRange } from '../lib/maths'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { ResourceEntity, RuntimeEntity } from '../types/entities'
import { TREE_STICK_HEIGHT, TREE_STICK_JITTER } from './ProjectileGeometry'
import type { EmbeddedMaskKind, ProjectileSprite } from './ProjectileVisuals'

type LifecycleProjectile = {
  context: GameContextLike
  embeddedMask?: unknown
  i: number
  interval: SchedulerTaskId | null
  isDead: boolean
  isDestroyed: boolean
  j: number
  parent?: { removeChild(child: unknown): unknown } | null
  position: { set(x: number, y: number): void }
  shadow?: ProjectileSprite
  sprite?: ProjectileSprite
  timeoutId: SchedulerTaskId | null
  treeAnchor?: ResourceEntity | null
  x: number
  y: number
  zIndex: number
  addChild(child: unknown): unknown
  applyEmbeddedMask(kind: EmbeddedMaskKind): void
  clear(): void
  createImpactEffect(x: number, y: number): void
  destroy(options?: { children?: boolean; texture?: boolean }): void
  once(event: string, callback: () => void): void
  stopTimeout(): void
}

function stopProjectileStep(projectile: LifecycleProjectile): void {
  if (projectile.interval != null) projectile.context.scheduler.remove(projectile.interval)
  projectile.interval = null
}

function scheduleProjectileFade(projectile: LifecycleProjectile, taskName: string): void {
  projectile.timeoutId = projectile.context.scheduler.addOneShot(
    () => fadeOutThenClear(projectile, FADE_DURATION_MS),
    ARROW_GROUND_TIME * 1000,
    taskName
  )
}

export function destroyProjectile(projectile: LifecycleProjectile): void {
  projectile.createImpactEffect(projectile.x, projectile.y)
  projectile.isDead = true
  stopProjectileStep(projectile)
  projectile.destroy({ children: true, texture: false })
}

export function landProjectileOnGround(projectile: LifecycleProjectile): void {
  projectile.isDead = true
  stopProjectileStep(projectile)

  const [i, j] = isometricToCartesian(projectile.x, projectile.y)
  projectile.i = i
  projectile.j = j
  const cell = projectile.context.map.grid[i]?.[j]
  if (!cell || cell.category === 'Water' || cell.waterBorder) {
    projectile.clear()
    return
  }

  projectile.createImpactEffect(projectile.x, projectile.y)
  projectile.sprite?.stop()
  if (projectile.shadow) projectile.shadow.visible = false
  projectile.applyEmbeddedMask('ground')
  projectile.zIndex = getTerrainSetZIndex({ i, j })
  cell.corpses.add(projectile as unknown as RuntimeEntity)
  scheduleProjectileFade(projectile, 'projectile.groundFade')
}

export function stickProjectileInTree(projectile: LifecycleProjectile, tree: ResourceEntity): void {
  projectile.createImpactEffect(projectile.x, projectile.y)
  projectile.isDead = true
  stopProjectileStep(projectile)
  projectile.sprite?.stop()
  if (projectile.shadow) projectile.shadow.visible = false
  projectile.applyEmbeddedMask('tree')

  projectile.treeAnchor = tree
  const jitterX = randomRange(-TREE_STICK_JITTER, TREE_STICK_JITTER)
  projectile.parent?.removeChild(projectile)
  projectile.position.set(projectile.x - tree.x + jitterX, projectile.y - tree.y + getReliefOffset(tree) - TREE_STICK_HEIGHT)
  tree.addChild?.(projectile as unknown as Parameters<NonNullable<ResourceEntity['addChild']>>[0])
  projectile.once('destroyed', () => {
    projectile.isDestroyed = true
    projectile.stopTimeout()
  })

  scheduleProjectileFade(projectile, 'projectile.treeFade')
}

export function stopProjectileTimeout(projectile: LifecycleProjectile): void {
  if (projectile.timeoutId != null) {
    projectile.context.scheduler.remove(projectile.timeoutId)
    projectile.timeoutId = null
  }
}

export function clearProjectile(projectile: LifecycleProjectile): void {
  if (projectile.isDestroyed) return
  projectile.isDestroyed = true
  projectile.stopTimeout()
  if (projectile.treeAnchor) {
    projectile.treeAnchor = null
  } else {
    const cell = projectile.context.map.grid[projectile.i]?.[projectile.j]
    cell?.corpses.delete(projectile as unknown as RuntimeEntity)
  }
  projectile.parent?.removeChild(projectile)
  projectile.destroy({ children: true, texture: false })
}
