import { Assets } from 'pixi.js'
import { getBuildingAsset, getBuildingAssetOwner } from '../../lib'
import type { BuildingConfig } from '../../types/config'
import type { EntityInfoRenderOptions, EntityInterfaceLike } from '../../types/entities'
import type { BuildingControllerHost } from './BuildingTypes'

type BuildingInterfaceRenderer = {
  renderInfo(element: HTMLElement, data: BuildingConfig, options?: EntityInfoRenderOptions): void
}

type BuildingInterfaceHost = BuildingControllerHost & {
  assetType?: string
  buildingInterface: BuildingInterfaceRenderer
}

export function createBuildingEntityInterface(building: BuildingInterfaceHost): EntityInterfaceLike {
  const {
    context: { editor, map, menu },
  } = building
  const units = editor
    ? []
    : (building.units || []).map((key: string) => menu.getBuildingTrainingStatusButton(key, building))

  return {
    info: (element: HTMLElement, options?: EntityInfoRenderOptions) => {
      const displayType = building.assetType || building.type
      const assets = getBuildingAsset(displayType, getBuildingAssetOwner(building), Assets)
      building.buildingInterface.renderInfo(element, assets as BuildingConfig, options)
    },
    menu:
      building.owner.isPlayed || map.instantMode
        ? [...units, ...(units.length ? [menu.getCancelUnitTrainingButton(building), menu.getActionRallyPointButton()] : [])]
        : [],
  }
}
