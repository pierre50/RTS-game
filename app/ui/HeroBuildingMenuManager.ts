import { renderHeroBuildingBody } from './hero-building/HeroBuildingBody'
import { t } from '../lib/lang'
import { heroHomeButton } from './hero-building/HeroHomeButton'
import { getBuildingAssetOwner } from '../lib/graphics/assets'
import { createHeroBuildingUpgrade } from './hero-building/HeroBuildingUpgrade'
import { isTraineeTrainingType } from '../lib/buildings/buildingTraining'
import { BUILDING_TYPES, SOUND_CUES } from '../constants'
import type { Modal } from '../lib'
import { playAudibleSoundCue } from '../lib/audio/sound'
import { renderBuildingAvatar } from '../lib/avatar'
import { isHeroInteractionTargetReachable } from '../lib/hero/heroActionRange'
import type { BuildingEntity } from '../types/entities'
import type { MenuButtonSpec } from '../types/ui'
import { TITLED_ENTITY_INFO_OPTIONS } from './EntityInfoContent'
import { createInspectionModal, setInspectionWindowSize } from './InspectionPanel'
import { InteractionPanel } from './InteractionPanel'
import type { MenuHost } from './MenuHost'
import { createHeroBuildingActionButton } from './hero-building/HeroBuildingActionButton'
import { updateHeroBuildingProgress } from './hero-building/HeroBuildingProgress'
import { heroBuildingStructureSignature } from './hero-building/HeroBuildingStructureSignature'
import { buttonMeta } from './hero-building/HeroBuildingButtonText'
import { heroSleepButton } from './hero-building/HeroSleepButton'
import { canHeroTradeAtMarket } from './hero-building/HeroMarketBody'
import type { InventoryTransferPanel } from './inventory/InventoryTransferPanel'
import { getBuildingDisplayName } from './utils/entityDisplayName'

function isSleepTarget(building: BuildingEntity): boolean {
  return building.type === BUILDING_TYPES.fireCamp || building.type === BUILDING_TYPES.campBedroll
}

export class HeroBuildingMenuManager {
  menu: MenuHost
  layout: InteractionPanel
  panel: HTMLDivElement
  header: HTMLDivElement
  infoAvatarWrap: HTMLDivElement
  infoAvatarCanvas: HTMLCanvasElement
  info: HTMLDivElement
  body: HTMLDivElement
  backButton: HTMLButtonElement
  modal?: Modal
  private upgradeModal?: Modal
  marketOpen = false
  building: BuildingEntity | null
  stack: MenuButtonSpec[][]
  opened: boolean
  structureSignature: string
  transferPanel: InventoryTransferPanel | null

  constructor(menu: MenuHost) {
    this.menu = menu
    this.building = null
    this.marketOpen = false
    this.stack = []
    this.opened = false
    this.structureSignature = ''
    this.transferPanel = null

    this.layout = new InteractionPanel()
    this.panel = this.layout.element

    this.backButton = document.createElement('button')
    this.backButton.type = 'button'
    this.backButton.className = 'hero-building-menu-nav ui-btn'
    this.backButton.textContent = '<'
    this.backButton.addEventListener('click', () => this.back())

    this.body = document.createElement('div')
    this.body.className = 'hero-building-menu-body'

    this.infoAvatarWrap = document.createElement('div')
    this.infoAvatarWrap.className = 'unit-avatar-frame'
    this.infoAvatarCanvas = document.createElement('canvas')
    this.infoAvatarCanvas.width = 120
    this.infoAvatarCanvas.height = 120
    this.infoAvatarWrap.appendChild(this.infoAvatarCanvas)

    this.info = document.createElement('div')
    this.info.className = 'entity-info-modal selection-info active'

    this.header = document.createElement('div')
    this.header.className = 'entity-info-wrapper'
    this.header.appendChild(this.infoAvatarWrap)
    this.header.appendChild(this.info)

    this.layout.information.appendChild(this.header)
    this.layout.actions.appendChild(this.backButton)
    this.layout.actions.appendChild(this.body)
    this.layout.actions.appendChild(this.layout.secondaryActions)
  }

  canOpenFor(building: BuildingEntity | null | undefined): building is BuildingEntity {
    const hero = this.menu.context.controls.heroUnit
    if (!hero || !building || building.isDestroyed || building.isDead) return false
    if (building.type === BUILDING_TYPES.trap && building.isBuilt) return false
    return isHeroInteractionTargetReachable(hero, null, building)
  }

  open(building: BuildingEntity): boolean {
    if (!this.canOpenFor(building)) return false
    if (this.opened && this.building === building) {
      this.refresh()
      return true
    }
    if (this.opened) this.close()
    const items = this.getBuildingActionMenuItems(building)
    this.building = building
    this.marketOpen =
      building.type === BUILDING_TYPES.market && canHeroTradeAtMarket(building, this.menu.context.controls.heroUnit)
    this.stack = [items]
    this.opened = true
    this.structureSignature = this.getStructureSignature()
    this.modal = createInspectionModal({
      proximity: { context: this.menu.context, targets: () => (building.isDead ? [] : [building]) },
      title: getBuildingDisplayName(building),
      inspection: !building.isBuilt || building.type !== BUILDING_TYPES.chest,
      interaction: !building.isBuilt || building.type !== BUILDING_TYPES.chest,
      panelClass: building.isBuilt && building.type === BUILDING_TYPES.chest ? 'inventory-transfer-modal' : undefined,
      content: this.panel,
      onClose: () => this.close(),
    })
    if (building.isBuilt && building.type === BUILDING_TYPES.chest) {
      playAudibleSoundCue(building, SOUND_CUES.building.chestOpen, { profile: 'surface' })
    }
    this.render()
    return true
  }

  close(): void {
    if (!this.opened && !this.modal) return
    this.closeUpgrade()
    const modal = this.modal
    this.modal = undefined
    const building = this.building
    this.building = null
    this.marketOpen = false
    this.stack = []
    this.opened = false
    this.structureSignature = ''
    this.info.textContent = ''
    this.body.textContent = ''
    this.transferPanel = null
    modal?.close()
    const player = this.menu.context.player
    if (building && player?.selectedBuilding === building) {
      building.unselect?.()
      player.selectedBuilding = null
    }
  }

  private closeUpgrade(): void {
    const modal = this.upgradeModal
    this.upgradeModal = undefined
    modal?.close()
    if (this.modal?._backdrop) this.modal._backdrop.hidden = false
  }

  private openUpgrade(building: BuildingEntity): void {
    if (this.upgradeModal || this.building !== building) return
    const upgrade = createHeroBuildingUpgrade(this.menu, building, () => {
      this.closeUpgrade()
      this.refresh()
    })
    if (!upgrade) return
    const content = document.createElement('div')
    content.className = 'building-upgrade-sheet-content'
    content.appendChild(upgrade)
    this.upgradeModal = createInspectionModal({
      title: getBuildingDisplayName(building),
      content,
      panelClass: 'building-upgrade-sheet',
      size: 'small',
      proximity: { context: this.menu.context, targets: () => [building] },
      onClose: () => this.closeUpgrade(),
    })
    if (this.modal?._backdrop) this.modal._backdrop.hidden = true
  }

  back(): void {
    if (this.marketOpen) {
      this.close()
      return
    }
    if (this.stack.length <= 1) {
      this.close()
      return
    }
    this.stack.pop()
    this.render()
  }

  refresh(): void {
    if (!this.opened || !this.building) return
    if (!this.building || this.building.isDestroyed || this.building.isDead) {
      this.close()
      return
    }
    this.stack[0] = this.getBuildingActionMenuItems(this.building)
    this.structureSignature = this.getStructureSignature()
    this.render()
  }

  syncLiveState(): void {
    if (!this.opened || !this.building) return
    if (this.building.isDestroyed || this.building.isDead) {
      this.close()
      return
    }
    const signature = this.getStructureSignature()
    if (signature !== this.structureSignature) {
      this.refresh()
      return
    }
    this.renderInfo()
    this.updateProgress()
  }

  refreshInventory(): void {
    if (
      this.building?.type !== BUILDING_TYPES.chest &&
      this.building?.type !== BUILDING_TYPES.market &&
      this.building?.type !== BUILDING_TYPES.forge &&
      this.building?.type !== BUILDING_TYPES.fireCamp
    )
      return
    this.syncLiveState()
  }

  getStructureSignature(): string {
    return heroBuildingStructureSignature(this)
  }

  getBuildingActionMenuItems(building: BuildingEntity): MenuButtonSpec[] {
    if (!building.isBuilt) return []
    const items = this.menu.getActionMenuItems(building)
    if (building.type === BUILDING_TYPES.house && building.owner === this.menu.context.controls.heroUnit?.owner)
      return [heroHomeButton(this.menu, building, () => this.refresh()), ...items]
    if (!isSleepTarget(building)) return items
    return [this.getSleepButton(building), ...items]
  }

  getSleepButton(building: BuildingEntity): MenuButtonSpec {
    return heroSleepButton(this.menu, building, () => this.close())
  }

  render(): void {
    const building = this.building
    if (!building) return
    this.marketOpen =
      building.type === BUILDING_TYPES.market && canHeroTradeAtMarket(building, this.menu.context.controls.heroUnit)
    const inventoryMode = Boolean(
      building.isBuilt &&
        (this.marketOpen ||
          building.type === BUILDING_TYPES.chest ||
          building.type === BUILDING_TYPES.forge ||
          building.type === BUILDING_TYPES.fireCamp)
    )
    const managementMode = inventoryMode || this.isManagedBuilding(building)
    setInspectionWindowSize(this.modal, managementMode ? 'large' : 'small')
    this.modal?._panel?.classList.toggle('interaction-panel', !inventoryMode)
    this.modal?._panel?.classList.toggle('inventory-transfer-modal', inventoryMode)
    this.modal?._panel?.classList.toggle(
      'crafting-workshop',
      Boolean(building.isBuilt && (building.type === BUILDING_TYPES.forge || building.type === BUILDING_TYPES.fireCamp))
    )
    this.panel.classList.toggle('market-trade-screen', this.marketOpen)
    // Only re-extracted on open/refresh (structure changes), not on every
    // syncLiveState() tick — renderInfo() alone runs far more often (e.g. on
    // every training-progress update) and re-cropping the avatar each time
    // would be wasteful.
    const rendered = renderBuildingAvatar(
      this.menu.context.app,
      building.type,
      getBuildingAssetOwner({ ...building, owner: building.owner ?? this.menu.context.player }),
      this.infoAvatarCanvas
    )
    this.infoAvatarWrap.classList.toggle('hidden', !rendered)
    const items = this.stack[this.stack.length - 1] || []
    this.renderInfo()
    this.body.replaceChildren()
    const upgrade = createHeroBuildingUpgrade(this.menu, building, () => this.refresh())
    if (upgrade) {
      const action = document.createElement('button')
      action.type = 'button'
      action.dataset.windowAction = 'upgrade'
      action.textContent = t('forgeUpgradeAction')
      action.addEventListener('click', () => this.openUpgrade(building))
      this.body.appendChild(action)
    }
    this.backButton.textContent = '<'
    this.backButton.classList.toggle('is-visible', !this.marketOpen && this.stack.length > 1)
    if (this.renderContainerBody(building)) {
      this.body.classList.toggle('is-empty', false)
      this.updateProgress()
      return
    }
    items
      .filter(button => !['heroCampfireSleep', 'heroSetHome'].includes(button.id ?? ''))
      .filter(button => !button.hide || !button.hide())
      .forEach(button => this.appendActionButton(building, button))
    this.body.classList.toggle(
      'is-empty',
      !Array.from(this.body.children).some(child => !(child as HTMLElement).dataset.windowAction)
    )
    this.updateProgress()
  }

  isManagedBuilding(building: BuildingEntity): boolean {
    return Boolean(
      building.isBuilt &&
        building.owner?.label === this.menu.context.player.label &&
        (['StoragePit', 'Granary'].includes(building.type) ||
          (building.units ?? []).some(type => isTraineeTrainingType(building, type)))
    )
  }

  appendActionButton(building: BuildingEntity, button: MenuButtonSpec): void {
    const trainingEntries = building.trainingQueue
      ?.map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.type === button.id)
    if (trainingEntries?.length) {
      for (const { index } of trainingEntries) {
        this.body.appendChild(this.createButton(building, button, { trainingIndex: index }))
      }
      return
    }
    this.body.appendChild(this.createButton(building, button))
  }

  renderContainerBody(building: BuildingEntity): boolean {
    return renderHeroBuildingBody(this, building)
  }

  renderInfo(): void {
    const building = this.building
    const title = this.modal?._panel?.querySelector('.modal-title')
    if (title && building) title.textContent = getBuildingDisplayName(building)
    this.info.textContent = ''
    this.layout.secondaryActions.replaceChildren()
    if (typeof building?.interface?.info === 'function') {
      building.interface.info(this.info, {
        ...TITLED_ENTITY_INFO_OPTIONS,
        actionsContainer: this.layout.secondaryActions,
      })
    }
    if (building) {
      for (const spec of this.getBuildingActionMenuItems(building)) {
        if (!['heroCampfireSleep', 'heroSetHome'].includes(spec.id ?? '') || spec.hide?.()) continue
        const button = this.createButton(building, spec)
        button.dataset.windowAction = spec.id === 'heroCampfireSleep' ? 'sleep' : 'home'
        button.title = buttonMeta(spec)
        this.layout.secondaryActions.appendChild(button)
      }
    }
  }

  createButton(
    building: BuildingEntity,
    button: MenuButtonSpec,
    options: { trainingIndex?: number } = {}
  ): HTMLButtonElement {
    return createHeroBuildingActionButton(this.menu, building, button, options, {
      refresh: () => this.refresh(),
      openChildren: children => {
        this.stack.push(children)
        this.render()
      },
    })
  }

  updateProgress(): void {
    if (this.building) updateHeroBuildingProgress(this.body, this.building)
  }

  isOpen(): boolean {
    return this.opened
  }

  getTarget(): BuildingEntity | null {
    return this.building
  }

  destroy(): void {
    this.modal?.close()
    this.modal = undefined
  }
}
