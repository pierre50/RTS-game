import { AnimatedSprite } from 'pixi.js'
import type { ResourceEntity } from '../../types/entities'
import type { GameContextLike } from '../../types/context'

const reportedHarvests = new WeakSet<object>()

function isStartingWheat(resource: ResourceEntity): boolean {
  return resource.type === 'Wheat' && Boolean(resource.label?.startsWith('start:'))
}

export function logStartingWheat(resources: Iterable<ResourceEntity>): void {
  if (typeof window === 'undefined') return
  const fields = [...resources].filter(isStartingWheat)
  if (!fields.length) return
  console.debug(
    '[starting-wheat-created]',
    fields.map(resource => ({
      label: resource.label,
      i: resource.i,
      j: resource.j,
      quantity: resource.quantity,
      frame: resource.sprite instanceof AnimatedSprite ? resource.sprite.currentFrame : null,
      lastFrame: resource.sprite instanceof AnimatedSprite ? resource.sprite.textures.length - 1 : null,
    }))
  )
}

export function logStartingWheatHarvest(resource: ResourceEntity, context: GameContextLike): void {
  if (typeof window === 'undefined' || !isStartingWheat(resource) || reportedHarvests.has(context.map)) return
  reportedHarvests.add(context.map)
  console.debug('[starting-wheat-first-harvest]', {
    label: resource.label,
    frameBeforeReset: resource.sprite instanceof AnimatedSprite ? resource.sprite.currentFrame : null,
    quantity: resource.quantity,
    time: context.dayNight?.state,
    heroSpace: context.controls?.heroUnit?.spaceId ?? 'outside',
  })
}
