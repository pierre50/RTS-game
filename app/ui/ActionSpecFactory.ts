import { getPlayerBuildingConfig } from '../lib/buildings/buildingAge'
import { constructionTerritoryBlocker } from '../lib/campaign/mapTerritory'
import { Assets } from 'pixi.js'
import {
  canAfford,
  getBuildingAsset,
  getIconPath,
  getStableHorseAmount,
  isBuildingLimitReached,
  storeStableHorse,
  STABLE_HORSE_CAPACITY,
} from '../lib'
import { renderUnitTypeAvatar } from '../lib/avatar'
import { HORSE_COLOR_PALETTES, type HorseColor } from '../lib/horses/horseColors'
import { t } from '../lib/lang'
import { BUILDING_TYPES, FAMILY_TYPES, SOUND_CUES, UNIT_TYPES } from '../constants'
import { hasLivingChief, heroCanCommand, playerNeedsChiefForCommand } from '../lib/chief'
import { playUiSound } from '../lib/audio/uiSound'
import {
  canShowMountHorseAction,
  canShowVillagerTrainingMenu,
  findBestTrainingBuildingForUnit,
  sendUnitToTraining,
  VILLAGER_TRAINING_UNIT_TYPES,
} from '../lib/units/unitTrainingOrders'
import { getUnitTrainingCost } from '../lib/training/unitTrainingCost'
import {
  formatActionCost,
  getBuildingDetails as buildBuildingDetails,
  getMissingResourceMessage,
  getUnitDetails as buildUnitDetails,
} from './ActionDetailsFactory'
import type { BuildingEntity, PlaceableBuildingConfig, RuntimeEntity, UnitEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { MenuButtonSpec, MenuDetails } from '../types/ui'
import type { BuildingConfig, UnitConfig } from '../types/config'
import type { ResourceAmount } from '../types/common'
import type { MenuHost } from './MenuHost'

function isBuildingEntity(selection: unknown): selection is BuildingEntity {
  return (selection as RuntimeEntity | null | undefined)?.family === FAMILY_TYPES.building
}

function isUnitEntity(selection: unknown): selection is UnitEntity {
  return (selection as RuntimeEntity | null | undefined)?.family === FAMILY_TYPES.unit
}

function hasQueuedTrainingType(selection: BuildingEntity, type: string): boolean {
  return Boolean(
    selection.trainingQueue?.some(item => item.type === type) ||
      (selection.loading != null && selection.queue?.[0] === type) ||
      selection.queue?.some(item => item === type)
  )
}

function hasAnyUnitTraining(selection: BuildingEntity): boolean {
  return Boolean(selection.queue?.length || selection.trainingQueue?.length || selection.loading != null)
}

function isOwnedByPlayer(building: BuildingEntity, player: PlayerLike): boolean {
  return building.owner === player || Boolean(building.owner?.label && building.owner.label === player.label)
}

function canPayActionCost(player: PlayerLike, cost: ResourceAmount | null | undefined): boolean {
  return !cost || canAfford(player, cost)
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

  getBuildingDetails(type: string, owner: PlayerLike, config: BuildingConfig): MenuDetails {
    return buildBuildingDetails({
      commandBlocked: this.isChiefCommandBlocked(),
      config,
      isLimitReached: isBuildingLimitReached(owner, type),
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
    preload(getIconPath('010_50721'))
    preload(getIconPath('001_50721'))
    preload(getIconPath('003_50721'))
    preload(getIconPath('002_50721'))
    ;['006_50731', '007_50731', '008_50731', '010_50731', '004_50731', '009_50731'].forEach(icon =>
      preload(getIconPath(icon))
    )
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

  getCancelUnitTrainingButton(building: BuildingEntity): MenuButtonSpec {
    return {
      id: 'cancelUnitTraining',
      icon: getIconPath('003_50721'),
      details: () => ({
        title: t('cancelUnitTraining'),
        description: t('cancelUnitTrainingDescription'),
      }),
      hide: () => !hasAnyUnitTraining(building),
      onClick: selection => {
        if (selection?.family !== FAMILY_TYPES.building) return
        ;(selection as BuildingEntity).cancelAllUnitTraining?.()
      },
    }
  }

  getUnitTrainingMenuButton(unit: UnitEntity): MenuButtonSpec {
    return {
      id: 'unitTraining',
      icon: getIconPath('010_50721'),
      details: () => ({
        title: t('unitTrainingMenu'),
        description: t('unitTrainingMenuDescription'),
      }),
      hide: () => !canShowVillagerTrainingMenu(unit),
      children: VILLAGER_TRAINING_UNIT_TYPES.map(type => this.getUnitTrainingOrderButton(type)),
    }
  }

  getUnitTrainingOrderButton(type: string): MenuButtonSpec {
    const unitConfig = this.menu.context.player.config.units[type]
    return {
      id: `train-${type}`,
      details: () => this.getUnitDetails(type, unitConfig),
      disabled: selection => !isUnitEntity(selection) || !findBestTrainingBuildingForUnit(selection, type),
      onClick: selection => {
        if (!isUnitEntity(selection)) return
        sendUnitToTraining(selection, type)
      },
      onCreate: (selection, element) => {
        if (!isUnitEntity(selection)) return
        const img = document.createElement('img')
        img.className = 'img'
        img.alt = ''
        const avatarCanvas = document.createElement('canvas')
        avatarCanvas.width = 92
        avatarCanvas.height = 92
        if (
          renderUnitTypeAvatar(this.menu.context.app, type, selection.owner ?? this.menu.context.player, avatarCanvas)
        ) {
          img.src = avatarCanvas.toDataURL()
        }
        img.addEventListener('pointerup', () => {
          this.playUiClick()
          if (!findBestTrainingBuildingForUnit(selection, type)) return
          sendUnitToTraining(selection, type)
        })
        element.appendChild(img)
      },
    }
  }

  getMountHorseButton(unit: UnitEntity): MenuButtonSpec {
    return {
      id: 'mountHorse',
      icon: getIconPath('001_50721'),
      details: () => ({
        title: t('mountHorseTraining'),
        description: t('mountHorseTrainingDescription'),
      }),
      hide: () => !canShowMountHorseAction(unit),
      onClick: selection => {
        if (!isUnitEntity(selection)) return
        sendUnitToTraining(selection, selection.type)
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
    const buildingAge = owner.age
    const config = getPlayerBuildingConfig(owner, type, buildingAge)!
    return {
      id: type,
      details: () => this.getBuildingDetails(type, owner, config),
      hide: () => !owner.isBuildingEligible?.(type),
      disabled: () =>
        Boolean(constructionTerritoryBlocker(menu.context, owner)) ||
        this.isChiefCommandBlocked() ||
        isBuildingLimitReached(owner, type) ||
        !config ||
        !canPayActionCost(owner, config.cost),
      onClick: () => {
        controls.removeMouseBuilding()
        const territoryOwner = constructionTerritoryBlocker(menu.context, owner)
        if (territoryOwner) {
          menu.showMessage(
            t('constructionTerritoryOccupied', {
              player: territoryOwner.name || territoryOwner.civ || territoryOwner.label || '',
            }),
            'warning'
          )
          return
        }
        if (this.isChiefCommandBlocked()) {
          menu.showMessage(t('requiresChief'), 'warning')
          return
        }
        if (isBuildingLimitReached(owner, type)) {
          menu.showMessage(t('buildingLimitReached'), 'warning')
          return
        }
        if (!canPayActionCost(owner, config.cost)) return
        const assets =
          type === 'Farm'
            ? { images: { final: { sheet: 'resources/wheat', frame: 0 } } }
            : getBuildingAsset(type, { ...owner, age: buildingAge }, Assets)
        const placeableBuilding: PlaceableBuildingConfig = { ...config, ...assets, type, buildingAge }
        controls.setMouseBuilding?.(placeableBuilding)
      },
    }
  }

  getActionMenuItems(selection: RuntimeEntity): MenuButtonSpec[] {
    if (!selection.interface) return []
    if (isUnitEntity(selection)) {
      return [
        ...(selection.interface.menu || []),
        ...(selection.type === UNIT_TYPES.villager ? [this.getUnitTrainingMenuButton(selection)] : []),
        ...(selection.type !== UNIT_TYPES.villager ? [this.getMountHorseButton(selection)] : []),
      ]
    }
    if (!isBuildingEntity(selection)) return selection.interface.menu || []
    if (!selection.isBuilt) return []
    const debugItems = selection.type === BUILDING_TYPES.stable ? [this.getStableDebugAddHorseButton(selection)] : []
    if (!isOwnedByPlayer(selection, this.menu.context.player)) return debugItems
    return [...debugItems, ...(selection.interface.menu || [])]
  }
}
