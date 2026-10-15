import type { Container } from 'pixi.js'
import type { BuildingEntity } from '../../types/entities'

/** Building is a simulation object; its Pixi view owns the display container. */
export function getPixiBuildingContainer(building: BuildingEntity): Container {
  return (building as BuildingEntity & { displayObject?: Container }).displayObject ??
    (building as unknown as Container)
}
