import { FAMILY_TYPES, RESOURCE_TYPES } from '../../constants'
import { t } from '../../lib/lang'
import type { AnimatedSprite } from 'pixi.js'
import type { ResourceEntity, RuntimeEntity } from '../../types/entities'

function translatedDescription(key: string): string {
  const text = t(key)
  return text === key ? '' : text
}

export function getEntityDescription(entity: RuntimeEntity): string {
  if (entity.family === FAMILY_TYPES.animal) {
    return (
      translatedDescription(`inspect${entity.type}${entity.isDead ? 'Corpse' : ''}`) ||
      t(entity.isDead ? 'inspectAnimalCorpse' : 'inspectAnimal')
    )
  }
  if (entity.family === FAMILY_TYPES.building) {
    return translatedDescription(`${entity.type}Description`)
  }
  if (entity.family !== FAMILY_TYPES.resource) return ''

  const resource = entity as ResourceEntity
  if (resource.type === RESOURCE_TYPES.tree) {
    if (resource.isCutOrFallenTree?.() || resource.hitPoints === 0) return t('inspectTreeFallen')
    const texture = resource.textureName ?? ''
    if (texture.includes('resources/tree/palm')) return t('inspectTreePalm')
    if (texture.includes('resources/tree/dark-forest')) return t('inspectTreeDarkForest')
    return t('inspectTree')
  }
  if (resource.type === RESOURCE_TYPES.berrybush && resource.quantity !== undefined && resource.quantity <= 0) {
    return t('inspectBerrybushEmpty')
  }
  if (resource.type === RESOURCE_TYPES.wheat) {
    const sprite = resource.sprite as AnimatedSprite | undefined
    if (sprite?.textures?.length && typeof sprite.currentFrame === 'number') {
      return t(sprite.currentFrame >= sprite.textures.length - 1 ? 'inspectWheatMature' : 'inspectWheatGrowing')
    }
  }
  return translatedDescription(`inspect${resource.type}`)
}

export function appendEntityDescription(element: HTMLElement, description: string): void {
  if (!description) return
  const paragraph = document.createElement('p')
  paragraph.className = 'entity-description'
  paragraph.textContent = description
  element.appendChild(paragraph)
}
