import { Assets } from 'pixi.js'
import { canAfford, getBuildingAsset, getIconPath, isValidCondition } from '../lib'
import { t } from '../lib/lang'
import { AGE_TECHNOLOGIES, AGE_UP_ENABLED, BUILDING_TYPES, FAMILY_TYPES, SOUND_CUES } from '../constants'
import { getWallIcon, type WallOwner } from '../lib/buildings/walls'
import { getTowerType, type TowerOwner } from '../lib/buildings/towers'
import { playUiSound } from '../lib/uiSound'
import type Menu from '../classes/Menu'
import type { BuildingEntity, PlaceableBuildingConfig, RuntimeEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { MenuButtonSpec, TooltipContent } from '../types/ui'
import type { BuildingConfig, TechnologyConfig, UnitConfig } from '../types/config'
import type { ResourceAmount } from '../types/common'
import type { LoadedGameConfig } from '../types/save'

function isBuildingEntity(selection: RuntimeEntity | null | undefined): selection is BuildingEntity {
  return selection?.family === FAMILY_TYPES.building
}

function requiresVillagerTraining(config: UnitConfig): boolean {
  return config.category !== 'Civilian' && config.category !== 'Boat'
}

export class ActionSpecFactory {
  menu: Menu

  constructor(menu: Menu) {
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
    const { player } = this.menu.context
    const resource = (Object.keys(cost) as (keyof ResourceAmount)[]).find(prop => player[prop] < (cost[prop] ?? 0))
    return t('needMore', { resource: t(resource as string) })
  }

  formatCost(cost?: ResourceAmount): string {
    return Object.entries(cost || {})
      .map(([resource, amount]) => `${amount} ${t(resource)}`)
      .join(', ')
  }

  getBuildingTooltip(type: string, owner: PlayerLike, config: BuildingConfig): TooltipContent {
    const displayType = type === BUILDING_TYPES.watchTower ? getTowerType(owner as TowerOwner) : type
    return {
      title: t(displayType),
      description: t(`${displayType}Description`),
      meta: [
        t('tooltipCost', { cost: this.formatCost(config.cost) }),
        t('tooltipBuildTime', { time: config.constructionTime ?? 0 }),
      ],
    }
  }

  getTechnologyTooltip(type: string, config: TechnologyConfig): TooltipContent {
    return {
      title: t(type),
      description: t(`${type}Description`),
      meta: [
        t('tooltipCost', { cost: this.formatCost(config.cost) }),
        t('tooltipResearchTime', { time: config.researchTime ?? 0 }),
      ],
    }
  }

  getUnitTooltip(type: string, config: UnitConfig): TooltipContent {
    return {
      title: t(type),
      description: t(`${type}Description`),
      meta: [
        t('tooltipCost', { cost: this.formatCost(config.cost) }),
        t('tooltipTrainTime', { time: config.trainingTime ?? 0 }),
      ],
    }
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
    Object.values(player.config.units).forEach(unit => {
      if (unit.icon) preload(getIconPath(unit.icon))
    })
    Object.values(player.techs).forEach(config => {
      if (config.icon) preload(getIconPath(config.icon))
    })
    Object.keys(player.config.buildings).forEach(type => {
      try {
        const asset = getBuildingAsset(type, player, Assets)
        if (asset?.icon) preload(getIconPath(asset.icon as string))
      } catch {}
    })
    const gameConfig = Assets.cache.get('config') as LoadedGameConfig
    Object.values((gameConfig.resources || {}) as Record<string, { icon?: string }>).forEach(res => {
      if (res.icon) preload(getIconPath(res.icon))
    })
    Object.values((gameConfig.animals || {}) as Record<string, { icon?: string }>).forEach(animal => {
      if (animal.icon) preload(getIconPath(animal.icon))
    })
  }

  getActionUnitButton(type: string): MenuButtonSpec {
    const { menu } = this
    const {
      context: { player },
    } = menu
    const unit = player.config.units[type]
    return {
      id: type,
      icon: () => getIconPath(unit.icon),
      tooltip: () => this.getUnitTooltip(type, unit),
      hide: () => (unit.conditions || []).some(condition => !isValidCondition(condition, player)),
      onClick: (selection: RuntimeEntity) => {
        if (!isBuildingEntity(selection)) return
        if (canAfford(player, unit.cost)) {
          if (!requiresVillagerTraining(unit) && player.population >= player.populationMax) {
            menu.showMessage(t('needHouses'), 'warning')
            return
          }
          if (!requiresVillagerTraining(unit)) menu.toggleQueuedActionCancel(type, true)
          selection.buyUnit?.(type)
        } else {
          menu.showMessage(this.getMessage(unit.cost ?? {}), 'warning')
        }
      },
      onCreate: (selection: RuntimeEntity, element: HTMLElement) => {
        if (!isBuildingEntity(selection)) return
        const unitSelection = selection
        const div = document.createElement('div')
        div.className = 'bottombar-menu-column'
        const cancel = this.createActionIcon(getIconPath('003_50721'))
        cancel.id = `${type}-cancel`
        if (requiresVillagerTraining(unit) || !unitSelection.queue?.some(q => q === type)) {
          cancel.classList.add('hidden')
        }
        cancel.addEventListener('pointerup', () => {
          this.playUiClick()
          if (requiresVillagerTraining(unit)) return
          unitSelection.cancelUnits?.(type)
        })
        const img = this.createActionIcon(getIconPath(unit.icon))
        img.addEventListener('pointerup', () => {
          this.playUiClick()
          if (canAfford(player, unit.cost)) {
            if (!requiresVillagerTraining(unit) && player.population >= player.populationMax) {
              menu.showMessage(t('needHouses'), 'warning')
              return
            }
            if (!requiresVillagerTraining(unit)) menu.toggleQueuedActionCancel(type, true)
            unitSelection.buyUnit?.(type)
          } else {
            menu.showMessage(this.getMessage(unit.cost ?? {}), 'warning')
          }
        })
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
      icon: () => {
        const displayType = type === BUILDING_TYPES.watchTower ? getTowerType(owner as TowerOwner) : type
        const assets = getBuildingAsset(displayType, owner, Assets)
        return getIconPath(
          type === BUILDING_TYPES.smallWall
            ? getWallIcon(owner as WallOwner, assets.icon as string)
            : (assets.icon as string)
        )
      },
      hide: () => !owner.isBuildingEligible?.(type),
      onClick: () => {
        const displayType = type === BUILDING_TYPES.watchTower ? getTowerType(owner as TowerOwner) : type
        const assets = getBuildingAsset(displayType, owner, Assets)
        controls.removeMouseBuilding()
        if (canAfford(owner, config.cost)) {
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
    return {
      icon: getIconPath(config.icon),
      id: type,
      tooltip: () => this.getTechnologyTooltip(type, config),
      hide: () =>
        (!AGE_UP_ENABLED && AGE_TECHNOLOGIES.has(type)) ||
        (config.conditions || []).some(
          condition => player.technologies.includes(type) || !isValidCondition(condition, player)
        ),
      onClick: (selection: RuntimeEntity) => {
        if (!isBuildingEntity(selection)) return
        controls.removeMouseBuilding()
        if (canAfford(player, config.cost)) {
          selection.buyTechnology?.(type)
        } else {
          menu.showMessage(this.getMessage(config.cost ?? {}), 'warning')
        }
      },
    }
  }

  getActionMenuItems(selection: RuntimeEntity): MenuButtonSpec[] {
    if (!selection.interface) return []
    if (!isBuildingEntity(selection)) return selection.interface.menu || []
    if (!selection.isBuilt) return []
    if (selection.technology) {
      return [
        {
          icon: getIconPath('003_50721'),
          id: `${selection.technology}-cancel`,
          tooltip: () => ({
            title: t('cancel'),
            description: t('cancelTechnologyDescription'),
          }),
          onClick: (target: RuntimeEntity) => {
            if (isBuildingEntity(target)) target.cancelTechnology?.()
          },
        },
      ]
    }
    return selection.interface.menu || []
  }
}
