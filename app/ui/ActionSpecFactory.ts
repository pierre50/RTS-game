import { Assets } from 'pixi.js'
import {
  canAfford,
  getBuildingAsset,
  getIconPath,
  getStableHorseAmount,
  isBuildingLimitReached,
  isValidCondition,
  storeStableHorse,
  STABLE_HORSE_CAPACITY,
} from '../lib'
import { renderUnitTypeAvatar } from '../lib/avatar'
import { HORSE_COLOR_PALETTES, type HorseColor } from '../lib/horses/horseColors'
import { t } from '../lib/lang'
import { AGE_TECHNOLOGIES, AGE_UP_ENABLED, BUILDING_TYPES, FAMILY_TYPES, SOUND_CUES, UNIT_TYPES } from '../constants'
import { hasBuildingTrainingCapacity, isTraineeTrainingType } from '../lib/buildings/buildingTraining'
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
  getBuildingTooltip as buildBuildingTooltip,
  getMissingResourceMessage,
  getTechnologyTooltip as buildTechnologyTooltip,
  getUnitTooltip as buildUnitTooltip,
} from './ActionTooltipFactory'
import type { BuildingEntity, PlaceableBuildingConfig, RuntimeEntity, UnitEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { MenuButtonSpec, TooltipContent } from '../types/ui'
import type { BuildingConfig, TechnologyConfig, UnitConfig } from '../types/config'
import type { ResourceAmount } from '../types/common'
import type { MenuHost } from './MenuHost'

function isBuildingEntity(selection: unknown): selection is BuildingEntity {
  return (selection as RuntimeEntity | null | undefined)?.family === FAMILY_TYPES.building
}

function isUnitEntity(selection: unknown): selection is UnitEntity {
  return (selection as RuntimeEntity | null | undefined)?.family === FAMILY_TYPES.unit
}

function hasPendingTrainingUnit(selection: BuildingEntity, type: string): boolean {
  return Boolean(
    selection.trainingQueue?.some(item => item.type === type) ||
      selection.owner?.units?.some(unit => unit.dest === selection && unit.trainingTargetType === type && !unit.isDead)
  )
}

function hasAnyUnitTraining(selection: BuildingEntity): boolean {
  return Boolean(
    selection.queue?.length ||
      selection.trainingQueue?.length ||
      selection.owner?.units?.some(unit => unit.dest === selection && unit.trainingTargetType && !unit.isDead)
  )
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

  getBuildingTooltip(type: string, owner: PlayerLike, config: BuildingConfig): TooltipContent {
    return buildBuildingTooltip({
      commandBlocked: this.isChiefCommandBlocked(),
      config,
      isLimitReached: isBuildingLimitReached(owner, type),
      type,
    })
  }

  getTechnologyTooltip(type: string, config: TechnologyConfig): TooltipContent {
    return buildTechnologyTooltip(type, config, this.menu.context.player, this.isChiefCommandBlocked())
  }

  getUnitTooltip(type: string, config: UnitConfig, building?: BuildingEntity): TooltipContent {
    const cost = getUnitTrainingCost(this.menu.context.player, type)
    return buildUnitTooltip(type, config, cost, this.isChiefCommandBlocked(), building)
  }

  isChiefCommandBlocked(): boolean {
    const { controls, player } = this.menu.context
    if (!playerNeedsChiefForCommand(player)) return false
    return !heroCanCommand(controls.heroUnit) || !hasLivingChief(player)
  }

  isChiefTrainingBlocked(type: string, building?: BuildingEntity): boolean {
    if (!this.isChiefCommandBlocked()) return false
    return type === 'Villager' || Boolean(building && isTraineeTrainingType(building, type))
  }

  preloadIcons(player: PlayerLike): void {
    const preload = (src: string) => {
      new Image().src = src
    }
    preload(getIconPath('010_50721'))
    preload(getIconPath('001_50721'))
    preload(getIconPath('003_50721'))
    preload(getIconPath('002_50721'))
    preload(getIconPath('006_50721'))
    ;['006_50731', '007_50731', '008_50731', '010_50731', '004_50731', '009_50731'].forEach(icon =>
      preload(getIconPath(icon))
    )
    Object.values(player.techs).forEach(config => {
      if (config.icon) preload(getIconPath(config.icon))
    })
  }

  getActionUnitButton(type: string, building?: BuildingEntity): MenuButtonSpec {
    const { menu } = this
    const {
      context: { player },
    } = menu
    const unit = player.config.units[type]
    const isTraineeBuildingOngoing = (): boolean => {
      if (!building || !isTraineeTrainingType(building, type)) return false
      return hasPendingTrainingUnit(building, type) || (building.loading !== null && building.queue?.[0] === type)
    }
    return {
      id: type,
      tooltip: () => this.getUnitTooltip(type, unit, building),
      disabled: () =>
        this.isChiefTrainingBlocked(type, building) ||
        !canPayActionCost(player, getUnitTrainingCost(player, type)) ||
        Boolean(building && !isTraineeTrainingType(building, type) && !hasBuildingTrainingCapacity(building)),
      hide: () => {
        if (building && isTraineeTrainingType(building, type)) return !isTraineeBuildingOngoing()
        return (unit.conditions || []).some(condition => !isValidCondition(condition, player))
      },
      onClick: (selection: RuntimeEntity) => {
        if (!isBuildingEntity(selection)) return
        if (this.isChiefTrainingBlocked(type, selection)) {
          menu.showMessage(t('requiresChief'), 'warning')
          return
        }
        // Trainee units aren't bought directly: send a villager to the building instead.
        if (isTraineeTrainingType(selection, type)) return
        if (!canPayActionCost(player, getUnitTrainingCost(player, type))) return
        if (player.population >= player.populationMax) {
          menu.showMessage(t('needHouses'), 'warning')
          return
        }
        selection.buyUnit?.(type)
      },
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
        const isTrainee = isTraineeTrainingType(unitSelection, type)
        if (isTrainee || this.isChiefTrainingBlocked(type, unitSelection)) {
          img.classList.add('is-passive')
        } else {
          img.addEventListener('pointerup', () => {
            this.playUiClick()
            if (this.isChiefTrainingBlocked(type, unitSelection)) {
              menu.showMessage(t('requiresChief'), 'warning')
              return
            }
            if (!canPayActionCost(player, getUnitTrainingCost(player, type))) return
            if (player.population >= player.populationMax) {
              menu.showMessage(t('needHouses'), 'warning')
              return
            }
            unitSelection.buyUnit?.(type)
          })
        }
        div.appendChild(img)
        element.appendChild(div)
      },
    }
  }

  getCancelUnitTrainingButton(building: BuildingEntity): MenuButtonSpec {
    return {
      id: 'cancelUnitTraining',
      icon: getIconPath('003_50721'),
      tooltip: () => ({
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

  getActionRallyPointButton(): MenuButtonSpec {
    return {
      id: 'rallyPoint',
      icon: getIconPath('006_50721'),
      tooltip: () => ({
        title: t('rallyPoint'),
        description: t('rallyPointDescription'),
      }),
      onClick: (selection: RuntimeEntity) => {
        this.menu.closeHeroBuildingMenu()
        this.menu.context.controls.rallyPointController?.start(selection)
      },
    }
  }

  getUnitTrainingMenuButton(unit: UnitEntity): MenuButtonSpec {
    return {
      id: 'unitTraining',
      icon: getIconPath('010_50721'),
      tooltip: () => ({
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
      tooltip: () => this.getUnitTooltip(type, unitConfig),
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
      tooltip: () => ({
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
      tooltip: () => ({
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
    const config = owner.config.buildings[type]
    return {
      id: type,
      tooltip: () => this.getBuildingTooltip(type, owner, config),
      hide: () => !owner.isBuildingEligible?.(type),
      disabled: () =>
        this.isChiefCommandBlocked() || isBuildingLimitReached(owner, type) || !canPayActionCost(owner, config.cost),
      onClick: () => {
        controls.removeMouseBuilding()
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
            : getBuildingAsset(type, owner, Assets)
        const placeableBuilding: PlaceableBuildingConfig = { ...config, ...assets, type }
        controls.setMouseBuilding?.(placeableBuilding)
      },
    }
  }

  getActionTechnologyButton(type: string): MenuButtonSpec {
    const { menu } = this
    const {
      context: { controls, player },
    } = menu
    const config = player.techs[type]
    const isAcquired = () => player.technologies.includes(type)
    return {
      icon: getIconPath(config.icon ?? ''),
      id: type,
      acquired: isAcquired,
      tooltip: () => this.getTechnologyTooltip(type, config),
      hide: () =>
        (!AGE_UP_ENABLED && AGE_TECHNOLOGIES.has(type)) ||
        (!isAcquired() && this.hasHiddenTechnologyPrerequisite(type)),
      disabled: () =>
        isAcquired() ||
        this.isChiefCommandBlocked() ||
        !canPayActionCost(player, config.cost) ||
        (config.conditions || []).some(condition => !isValidCondition(condition, player)),
      onClick: () => {
        controls.removeMouseBuilding()
        if (this.isChiefCommandBlocked()) {
          menu.showMessage(t('requiresChief'), 'warning')
          return
        }
        if ((config.conditions || []).some(condition => !isValidCondition(condition, player))) {
          menu.showMessage(t('technologyUnavailable'), 'warning')
          return
        }
        if (!canPayActionCost(player, config.cost)) return
        player.buyTechnology?.(type)
      },
    }
  }

  hasHiddenTechnologyPrerequisite(type: string): boolean {
    const { player } = this.menu.context
    const config = player.techs[type]
    if (!config) return true
    return (config.conditions || []).some(
      condition =>
        condition.key === 'technologies' &&
        condition.op === 'includes' &&
        !player.technologies.includes(String(condition.value))
    )
  }

  getHeroTechnologyButtons(): MenuButtonSpec[] {
    return Object.keys(this.menu.context.player.techs).map(type => this.getActionTechnologyButton(type))
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
