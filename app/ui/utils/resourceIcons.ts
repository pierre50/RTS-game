import { RESOURCE_ICON_IDS } from '../../constants'
import { getIconPath } from '../../lib'

type ResourceIconName = keyof typeof RESOURCE_ICON_IDS
type ResourceIconMap = Record<ResourceIconName, string>

export function createResourceIconMaps(): { icons: ResourceIconMap; infoIcons: ResourceIconMap } {
  const icons = {} as ResourceIconMap
  const infoIcons = {} as ResourceIconMap
  for (const resource of Object.keys(RESOURCE_ICON_IDS) as ResourceIconName[]) {
    icons[resource] = getIconPath(RESOURCE_ICON_IDS[resource].commodity)
    infoIcons[resource] = getIconPath(RESOURCE_ICON_IDS[resource].attribute)
  }
  return { icons, infoIcons }
}
