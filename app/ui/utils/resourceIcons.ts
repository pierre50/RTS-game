import { RESOURCE_ICON_IDS, RESOURCE_NAMES } from '../../constants'
import { getIconPath } from '../../lib'

type ResourceName = (typeof RESOURCE_NAMES)[number]
type ResourceIconMap = Record<ResourceName, string>

export function createResourceIconMaps(): { icons: ResourceIconMap; infoIcons: ResourceIconMap } {
  const icons = {} as ResourceIconMap
  const infoIcons = {} as ResourceIconMap
  for (const resource of RESOURCE_NAMES) {
    icons[resource] = getIconPath(RESOURCE_ICON_IDS[resource].commodity)
    infoIcons[resource] = getIconPath(RESOURCE_ICON_IDS[resource].attribute)
  }
  return { icons, infoIcons }
}
