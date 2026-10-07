import { isCampBuilding, isSowingPlacement, WHEAT_PLOT_SIZE } from '../lib/buildings/campConstruction'
import { getPlayerBuildingConfig } from '../lib/buildings/buildingLevel'
import { Assets } from 'pixi.js'
import { getBuildingAsset, getIconPath, getStableHorseAmount, storeStableHorse, STABLE_HORSE_CAPACITY } from '../lib'
import { renderUnitTypeAvatar } from '../lib/avatar'
import { HORSE_COLOR_PALETTES, type HorseColor } from '../lib/horses/horseColors'
import { t } from '../lib/lang'
import { BUILDING_TYPES, FAMILY_TYPES, SOUND_CUES } from '../constants'
import { hasLivingChief, heroCanCommand, playerNeedsChiefForCommand } from '../lib/chief'
import { playUiSound } from '../lib/audio/uiSound'
import { getUnitTrainingCost } from '../lib/training/unitTrainingCost'
import {
  formatActionCost,
  getBuildingDetails as buildBuildingDetails,
  getMissingResourceMessage,
  getUnitDetails as buildUnitDetails,
} from './ActionDetailsFactory'
import type { BuildingEntity, PlaceableBuildingConfig, RuntimeEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { MenuButtonSpec, MenuDetails } from '../types/ui'
import type { BuildingConfig, UnitConfig } from '../types/config'
import type { ResourceAmount } from '../types/common'
import type { MenuHost } from './MenuHost'

function isBuildingEntity(selection: unknown): selection is BuildingEntity {
  return (selection as RuntimeEntity | null | undefined)?.family === FAMILY_TYPES.building
}

function hasQueuedTrainingType(selection: BuildingEntity, type: string): boolean {
  return Boolean(
    selection.trainingQueue?.some(item => item.type === type) ||
      (selection.loading != null && selection.queue?.[0] === type) ||
      selection.queue?.some(item => item === type)
  )
}

function isOwnedByPlayer(building: BuildingEntity, player: PlayerLike): boolean {
  return building.owner === player || Boolean(building.owner?.label && building.owner.label === player.label)
}

export class ActionSpecFactory {
  menu: MenuHost

  constructor(menu: MenuHost) {
    this.menu = menu
  }

  playUiClick(): void {
    playUiSound(SOUND_CUES.ui.menuClick)
  }

  createActionIcon(src: string): HTMLImageElement {
    const img = document.createElement('img')
    img.src = src
    img.className = 'img'
    img.alt = ''
    return img
  }

  getMessage(cost: ResourceAmount): string {
    return getMissingResourceMessage(this.menu.context.player, cost)
  }

  formatCost(cost?: ResourceAmount): string {
    return formatActionCost(cost)
  }

  getBuildingDetails(type: string, config: BuildingConfig): MenuDetails {
    return buildBuildingDetails({
      commandBlocked: !isCampBuilding(type) && this.isChiefCommandBlocked(),
      config,
      type,
    })
  }

  getUnitDetails(type: string, config: UnitConfig, building?: BuildingEntity): MenuDetails {
    const cost = getUnitTrainingCost(this.menu.context.player, type)
    return buildUnitDetails(type, config, cost, this.isChiefCommandBlocked(), building)
  }

  isChiefCommandBlocked(): boolean {
    const { controls, player } = this.menu.context
    if (!playerNeedsChiefForCommand(player)) return false
    return !heroCanCommand(controls.heroUnit) || !hasLivingChief(player)
  }

  preloadIcons(): void {
    const preload = (src: string) => {
      new Image().src = src
    }
    preload(getIconPath('003_50721'))
    ;['stat/sword', 'stat/bow', 'stat/shield'].forEach(icon => preload(getIconPath(icon)))
  }

  getBuildingTrainingStatusButton(type: string, building: BuildingEntity): MenuButtonSpec {
    const { menu } = this
    const {
      context: { player },
    } = menu
    return {
      id: type,
      details: () => ({
        title: t(type),
      }),
      hide: () => !hasQueuedTrainingType(building, type),
      onCreate: (selection: RuntimeEntity, element: HTMLElement) => {
        if (!isBuildingEntity(selection)) return
        const unitSelection = selection
        const div = document.createElement('div')
        div.className = 'action-menu-column'
        const img = document.createElement('img')
        img.className = 'img'
        img.alt = ''
        const avatarCanvas = document.createElement('canvas')
        avatarCanvas.width = 92
        avatarCanvas.height = 92
        if (renderUnitTypeAvatar(menu.context.app, type, unitSelection.owner ?? player, avatarCanvas)) {
          img.src = avatarCanvas.toDataURL()
        }
        img.classList.add('is-passive')
        div.appendChild(img)
        element.appendChild(div)
      },
    }
  }

  getStableDebugAddHorseButton(building: BuildingEntity): MenuButtonSpec {
    const { menu } = this
    const horseColors = Object.keys(HORSE_COLOR_PALETTES) as HorseColor[]
    const nextHorseColor = (): HorseColor => horseColors[getStableHorseAmount(building) % horseColors.length] ?? 'brown'
    const isFull = () => getStableHorseAmount(building) >= STABLE_HORSE_CAPACITY
    return {
      id: 'stableDebugAddHorse',
      details: () => ({
        title: t('stableDebugAddHorse'),
        description: t('stableDebugAddHorseDescription'),
        meta: [isFull() ? t('stableFull') : null],
      }),
      disabled: isFull,
      onClick: () => {
        if (!storeStableHorse(building, { type: 'Horse', horseColor: nextHorseColor() })) {
          menu.showMessage(t('stableFull'), 'warning')
          return
        }
        menu.showMessage(t('stableDebugHorseAdded'), 'success')
        menu.syncHeroBuildingMenu?.()
      },
    }
  }

  getActionBuildingButton(type: string, ownerOverride: PlayerLike | null = null): MenuButtonSpec {
    const { menu } = this
    const {
      context: { controls, player },
    } = menu
    const owner = ownerOverride || player
    const buildingLevel = 0
    const config = getPlayerBuildingConfig(owner, type, buildingLevel)!
    return {
      id: type,
      details: () => this.getBuildingDetails(type, config),
      hide: () =>
        !owner.isBuildingEligible?.(type) ||
        (type === 'Chest' && (!controls.heroUnit?.spaceId || controls.heroUnit.spaceId === 'outside')),
      disabled: () => (!isCampBuilding(type) && this.isChiefCommandBlocked()) || !config,
      onClick: () => {
        controls.removeMouseBuilding()
        if (!isCampBuilding(type) && this.isChiefCommandBlocked()) {
          menu.showMessage(t('requiresChief'), 'warning')
          return
        }
        const assets = isSowingPlacement(type)
          ? { images: { final: { sheet: 'resources/wheat', frame: 0 } } }
          : getBuildingAsset(type, { ...owner, level: buildingLevel }, Assets)
        const placeableBuilding: PlaceableBuildingConfig = {
          ...config,
          ...assets,
          type,
          buildingLevel,
          ...(isSowingPlacement(type) ? { size: WHEAT_PLOT_SIZE } : {}),
        }
        controls.setMouseBuilding?.(placeableBuilding)
      },
    }
  }

  getActionMenuItems(selection: RuntimeEntity): MenuButtonSpec[] {
    if (!selection.interface) return []
    if (!isBuildingEntity(selection)) return selection.interface.menu || []
    if (!selection.isBuilt) return []
    const debugItems = selection.type === BUILDING_TYPES.stable ? [this.getStableDebugAddHorseButton(selection)] : []
    if (!isOwnedByPlayer(selection, this.menu.context.player)) return debugItems
    return [...debugItems, ...(selection.interface.menu || [])]
  }
}
