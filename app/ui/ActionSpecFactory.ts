import { Assets } from 'pixi.js'
import {
  assignStableHorseToHero,
  canAfford,
  getBuildingAsset,
  getIconPath,
  getStableHorseAmount,
  heroHasLinkedHorse,
  isBuildingLimitReached,
  isValidCondition,
} from '../lib'
import { renderUnitTypeAvatar } from '../lib/avatar'
import { t } from '../lib/lang'
import { AGE_TECHNOLOGIES, AGE_UP_ENABLED, BUILDING_TYPES, FAMILY_TYPES, SOUND_CUES } from '../constants'
import { isTraineeTrainingType } from '../lib/buildings/buildingTraining'
import { hasLivingChief, heroCanCommand, playerNeedsChiefForCommand } from '../lib/chief'
import { playUiSound } from '../lib/audio/uiSound'
import {
  formatActionCost,
  getBuildingTooltip as buildBuildingTooltip,
  getMissingResourceMessage,
  getTechnologyTooltip as buildTechnologyTooltip,
  getUnitTooltip as buildUnitTooltip,
} from './ActionTooltipFactory'
import type { BuildingEntity, PlaceableBuildingConfig, RuntimeEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { MenuButtonSpec, TooltipContent } from '../types/ui'
import type { BuildingConfig, TechnologyConfig, UnitConfig } from '../types/config'
import type { ResourceAmount } from '../types/common'
import type { MenuHost } from './MenuHost'

function isBuildingEntity(selection: RuntimeEntity | null | undefined): selection is BuildingEntity {
  return selection?.family === FAMILY_TYPES.building
}

function hasPendingTrainingUnit(selection: BuildingEntity, type: string): boolean {
  return Boolean(
    selection.owner?.units?.some(unit => unit.dest === selection && unit.trainingTargetType === type && !unit.isDead)
  )
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
    return buildUnitTooltip(type, config, this.isChiefCommandBlocked(), building)
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
      disabled: () => this.isChiefTrainingBlocked(type, building),
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
        if (canAfford(player, unit.cost)) {
          if (player.population >= player.populationMax) {
            menu.showMessage(t('needHouses'), 'warning')
            return
          }
          menu.toggleQueuedActionCancel(type, true)
          selection.buyUnit?.(type)
        } else {
          menu.showMessage(this.getMessage(unit.cost ?? {}), 'warning')
        }
      },
      onCreate: (selection: RuntimeEntity, element: HTMLElement) => {
        if (!isBuildingEntity(selection)) return
        const unitSelection = selection
        const div = document.createElement('div')
        div.className = 'action-menu-column'
        const cancel = this.createActionIcon(getIconPath('003_50721'))
        cancel.id = `${type}-cancel`
        const hasReservedTraining = hasPendingTrainingUnit(unitSelection, type)
        const hasActiveTraining = unitSelection.loading !== null && unitSelection.queue?.[0] === type
        const hasQueuedTraining = unitSelection.queue?.some(q => q === type)
        const showCancel = isTraineeTrainingType(unitSelection, type)
          ? hasReservedTraining || hasActiveTraining
          : hasQueuedTraining
        if (!showCancel) {
          cancel.classList.add('hidden')
        }
        cancel.addEventListener('pointerup', () => {
          this.playUiClick()
          unitSelection.cancelUnits?.(type)
        })
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
            if (canAfford(player, unit.cost)) {
              if (player.population >= player.populationMax) {
                menu.showMessage(t('needHouses'), 'warning')
                return
              }
              menu.toggleQueuedActionCancel(type, true)
              unitSelection.buyUnit?.(type)
            } else {
              menu.showMessage(this.getMessage(unit.cost ?? {}), 'warning')
            }
          })
        }
        const queue = unitSelection.queue?.filter(q => q === type).length ?? 0
        const counter = document.createElement('div')
        counter.classList.add('content')
        counter.textContent = queue ? String(queue) : ''
        div.appendChild(img)
        div.appendChild(cancel)
        element.appendChild(div)
        element.appendChild(counter)
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

  getStableBindHeroHorseButton(building: BuildingEntity): MenuButtonSpec {
    const { menu } = this
    const hero = () => menu.context.controls.heroUnit
    const isUnavailable = () => getStableHorseAmount(building) <= 0 || heroHasLinkedHorse(hero())
    return {
      id: 'stableBindHeroHorse',
      icon: getIconPath('004_50731'),
      tooltip: () => ({
        title: t('stableBindHeroHorse'),
        description: t('stableBindHeroHorseDescription'),
        meta: [
          getStableHorseAmount(building) <= 0 ? t('stableNeedsHorse') : null,
          heroHasLinkedHorse(hero()) ? t('heroAlreadyHasHorse') : null,
        ],
      }),
      disabled: isUnavailable,
      onClick: () => {
        const heroUnit = hero()
        if (heroHasLinkedHorse(heroUnit)) {
          menu.showMessage(t('heroAlreadyHasHorse'), 'warning')
          return
        }
        if (getStableHorseAmount(building) <= 0) {
          menu.showMessage(t('stableNeedsHorse'), 'warning')
          return
        }
        if (!assignStableHorseToHero(building, heroUnit)) {
          menu.showMessage(t('stableNeedsHorse'), 'warning')
          return
        }
        menu.showMessage(t('heroHorseLinked'), 'success')
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
      disabled: () => this.isChiefCommandBlocked() || isBuildingLimitReached(owner, type),
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
        if (canAfford(owner, config.cost)) {
          const assets =
            type === 'Farm'
              ? { images: { final: { sheet: 'resources/wheat', frame: 0 } } }
              : getBuildingAsset(type, owner, Assets)
          const placeableBuilding: PlaceableBuildingConfig = { ...config, ...assets, type }
          controls.setMouseBuilding?.(placeableBuilding)
        } else {
          menu.showMessage(this.getMessage(config.cost ?? {}), 'warning')
        }
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
        if (canAfford(player, config.cost)) {
          player.buyTechnology?.(type)
        } else {
          menu.showMessage(this.getMessage(config.cost ?? {}), 'warning')
        }
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
    if (!isBuildingEntity(selection)) return selection.interface.menu || []
    if (!selection.isBuilt) return []
    const items = selection.interface.menu || []
    if (selection.type !== BUILDING_TYPES.stable) return items
    return [this.getStableBindHeroHorseButton(selection), ...items]
  }
}
