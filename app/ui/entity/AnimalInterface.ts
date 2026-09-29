import { getEntityDescription } from './EntityDescription'
import { appendBaseEntityInfo } from './BaseEntityInterface'
import { getEntityDisplayName } from '../utils/entityDisplayName'
import type { AnimalEntity, EntityInfoRenderOptions } from '../../types/entities'
import type { AnimalConfig } from '../../types/config'

export class AnimalInterface {
  animal: AnimalEntity

  constructor(animal: AnimalEntity) {
    this.animal = animal
  }

  setDefaultInterface(element: HTMLElement, _data: AnimalConfig, options?: EntityInfoRenderOptions): void {
    const animal = this.animal
    const current = animal.isDead ? 0 : animal.hitPoints
    const total = animal.totalHitPoints

    appendBaseEntityInfo(element, '', getEntityDisplayName(animal), current, total, {
      hideType: options?.hideIdentity,
      description: getEntityDescription(animal),
    })
  }
}
