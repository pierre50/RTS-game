import { assignVillagerAutonomy, hasVillagerAutonomyTarget } from '../lib'
import { t } from '../lib/lang'
import { playUiSound } from '../lib/audio/uiSound'
import { getUnitEquipmentLevel, setUnitDebugLevel, XP_MAX_LEVEL } from '../lib/units/unitExperience'
import { refreshUnitEquipmentStats } from '../lib/equipment/equipmentStats'
import { ensureAndRefreshBakedLpcUnitAssets } from '../lib/lpc'
import { SOUND_CUES, UNIT_TYPES } from '../constants'
import { createInventoryContainer } from '../lib/inventory/inventoryContainers'
import { isVillagerSleepTime, shouldVillagerRestBeforeBed } from '../lib/units/villagerSchedule'
import {
  keepNpcHere,
  startFollowingHero,
  releaseIfStillLooking,
  playNpcOrderSound,
  clearNpcCommunicationFocus,
} from '../lib/npc/npcInteraction'
import { createTitledEntityInfoContent } from './EntityInfoModalManager'
import { createInspectionModal, setInspectionMode, setModalTitle } from './InspectionPanel'
import {
  pickForeignNpcChatterLine,
  pickForeignNpcSleepingChatterLine,
  pickNpcGreetingLine,
  pickNpcRestingChatterLine,
  pickNpcSleepingChatterLine,
} from '../lib/npc/npcChatter'
import { NestedButtonMenu, type NestedButtonMenuItem } from './menu/NestedButtonMenu'
import { InventoryTransferPanel } from './inventory/InventoryTransferPanel'
import type { Modal } from '../lib'
import type { NpcOrdersOpenOptions } from '../types/context'
import type { UnitEntity, VillagerAutonomyJob } from '../types/entities'
import type { MenuHost } from './MenuHost'

type NpcOrderId = 'stay' | 'follow' | 'goto' | 'cancel' | VillagerAutonomyJob
type NpcOrderMenuId = NpcOrderId | 'resources' | 'bag'

type NpcOrderSpec = {
  id: NpcOrderId
  labelKey: string
  run?: (npc: UnitEntity) => void
  villagerJob?: VillagerAutonomyJob
  startsPicking?: boolean
}

const NPC_ORDER_SPECS: NpcOrderSpec[] = [
  { id: 'goto', labelKey: 'npcOrderGoTo', startsPicking: true },
  { id: 'construction', labelKey: 'npcOrderConstruction', villagerJob: 'construction' },
  { id: 'horseCapture', labelKey: 'npcOrderHorseCapture', villagerJob: 'horseCapture' },
  { id: 'follow', labelKey: 'npcOrderFollow', run: startFollowingHero },
  { id: 'stay', labelKey: 'npcOrderStay', run: keepNpcHere },
  { id: 'cancel', labelKey: 'npcOrderCancelSleep' },
]

const NPC_RESOURCE_ORDER_SPECS: Required<Pick<NpcOrderSpec, 'id' | 'labelKey' | 'villagerJob'>>[] = [
  { id: 'food', labelKey: 'npcOrderFood', villagerJob: 'food' },
  { id: 'wood', labelKey: 'npcOrderWood', villagerJob: 'wood' },
  { id: 'stone', labelKey: 'npcOrderStone', villagerJob: 'stone' },
  { id: 'gold', labelKey: 'npcOrderGold', villagerJob: 'gold' },
  { id: 'copper', labelKey: 'npcOrderCopper', villagerJob: 'copper' },
  { id: 'iron', labelKey: 'npcOrderIron', villagerJob: 'iron' },
]

const ALL_NPC_ORDER_SPECS: NpcOrderSpec[] = [...NPC_ORDER_SPECS, ...NPC_RESOURCE_ORDER_SPECS]

function isSleepingNpc(npc: UnitEntity | null | undefined): boolean {
  return npc?.shelterState?.reason === 'sleep' && npc.sleepVisualState === 'sleeping'
}

function isRestingBeforeBedNpc(npc: UnitEntity | null | undefined): boolean {
  return Boolean(
    npc &&
      npc.type === UNIT_TYPES.villager &&
      npc.shelterState?.reason === 'sleep' &&
      npc.sleepVisualState !== 'sleeping' &&
      shouldVillagerRestBeforeBed(npc)
  )
}

export class NpcOrdersManager {
  menu: MenuHost
  panel: HTMLDivElement
  infoContainer: HTMLDivElement
  chatterContainer: HTMLDivElement
  debugContainer: HTMLDivElement
  debugLevelButton: HTMLButtonElement
  buttonsContainer: HTMLDivElement
  bagContainer: HTMLDivElement
  transferPanel: InventoryTransferPanel | null
  modal?: Modal
  orderMenu: NestedButtonMenu<NpcOrderMenuId>
  buttons: NestedButtonMenu<NpcOrderMenuId>['buttons']
  opened: boolean
  npcs: UnitEntity[]
  ordersEnabled: boolean

  constructor(menu: MenuHost) {
    this.menu = menu
    this.opened = false
    this.npcs = []
    this.ordersEnabled = false
    this.transferPanel = null

    this.panel = document.createElement('div')
    this.panel.className = 'npc-orders-panel-content'

    this.infoContainer = document.createElement('div')
    this.infoContainer.className = 'npc-orders-info'
    this.panel.appendChild(this.infoContainer)

    this.chatterContainer = document.createElement('div')
    this.chatterContainer.className = 'npc-orders-chatter'
    this.panel.appendChild(this.chatterContainer)

    this.debugContainer = document.createElement('div')
    this.debugContainer.className = 'npc-orders-debug'
    this.panel.appendChild(this.debugContainer)

    this.debugLevelButton = document.createElement('button')
    this.debugLevelButton.type = 'button'
    this.debugLevelButton.className = 'npc-orders-debug-level ui-btn'
    this.debugLevelButton.addEventListener('click', () => {
      const target = this.npcs.length === 1 ? this.npcs[0] : null
      if (!target || this.debugLevelButton.disabled) return
      playUiSound(SOUND_CUES.ui.menuClick)
      void this.cycleDebugLevel(target)
    })
    this.debugContainer.appendChild(this.debugLevelButton)

    this.buttonsContainer = document.createElement('div')
    this.buttonsContainer.className = 'npc-orders-options'
    this.panel.appendChild(this.buttonsContainer)

    this.bagContainer = document.createElement('div')
    this.bagContainer.className = 'npc-orders-bag'
    this.bagContainer.hidden = true
    this.panel.appendChild(this.bagContainer)

    this.orderMenu = new NestedButtonMenu<NpcOrderMenuId>({
      container: this.buttonsContainer,
      items: this.createOrderMenuItems(),
      backLabel: t('back'),
      backButtonClassName: 'ui-btn npc-orders-back',
      showBackButton: false,
      onNavigate: () => playUiSound(SOUND_CUES.ui.menuClick),
      onBack: () => playUiSound(SOUND_CUES.ui.menuClick),
    })
    this.buttons = this.orderMenu.buttons
  }

  open(npcs: UnitEntity[], options: NpcOrdersOpenOptions = {}): void {
    this.npcs = npcs
    this.opened = true
    this.orderMenu.reset()
    this.closeBag()
    const title =
      npcs.length > 1 ? t('npcOrdersTitleCount', { count: npcs.length }) : npcs[0]?.name || t('npcOrdersTitle')

    // A single target gets its stats/avatar shown above the order buttons, in the same panel —
    // a group order doesn't have one set of stats to show, so it stays buttons-only.
    this.infoContainer.replaceChildren()
    const soloTarget = npcs.length === 1 ? npcs[0] : null
    const sleepingSoloTarget = isSleepingNpc(soloTarget)
    const ownSleepingSoloTarget = sleepingSoloTarget && soloTarget?.owner?.isPlayed === true
    const restingSoloTarget = isRestingBeforeBedNpc(soloTarget)
    const hasInfo = Boolean(soloTarget?.interface?.info)
    if (soloTarget && hasInfo) {
      this.infoContainer.appendChild(
        createTitledEntityInfoContent(this.menu.context.app, soloTarget, { showAllXp: true })
      )
    }

    // Just chatting (no order possible right now — non-chief hero, or the ally isn't
    // commandable) shows the same panel with the buttons hidden rather than a whole
    // separate window.
    const isOwnGroup = npcs.every(npc => npc.owner?.isPlayed === true)
    const ordersEnabled = (options.ordersEnabled ?? true) && isOwnGroup
    this.ordersEnabled = ordersEnabled
    this.buttonsContainer.hidden = !ordersEnabled
    this.orderMenu.syncVisibility()

    // A commandable single target gets a short in-character greeting addressed to the player
    // instead of idle chatter — callers can still override with an explicit chatterLine.
    this.chatterContainer.replaceChildren()
    const chatterLine =
      options.chatterLine ??
      (soloTarget
        ? sleepingSoloTarget
          ? ownSleepingSoloTarget
            ? pickNpcSleepingChatterLine()
            : pickForeignNpcSleepingChatterLine()
          : ordersEnabled
          ? restingSoloTarget
            ? pickNpcRestingChatterLine(soloTarget)
            : pickNpcGreetingLine(this.menu.context.player?.name ?? '')
          : pickForeignNpcChatterLine(soloTarget)
        : null)
    if (chatterLine) {
      const line = document.createElement('p')
      line.className = 'npc-orders-chatter-line'
      line.textContent = chatterLine
      this.chatterContainer.appendChild(line)
    }

    this.updateDebugControls(soloTarget)

    const hasFollower = npcs.some(npc => npc.followingHero === true)
    const hasNonFollower = npcs.some(npc => npc.followingHero !== true)
    const stayButton = this.buttons.get('stay')
    if (stayButton) {
      stayButton.disabled = !hasFollower
    }
    const followButton = this.buttons.get('follow')
    if (followButton) {
      followButton.disabled = !hasNonFollower
    }
    const hasVillager = npcs.some(npc => npc.type === UNIT_TYPES.villager)
    const resourcesButton = this.buttons.get('resources')
    const nightWorkBlocked = hasVillager && isVillagerSleepTime(this.menu.context)
    if (resourcesButton) {
      resourcesButton.disabled = !hasVillager || nightWorkBlocked
    }
    for (const spec of ALL_NPC_ORDER_SPECS) {
      if (!spec.villagerJob) continue
      const button = this.buttons.get(spec.id)
      if (!button) continue
      const needsKnownTarget = spec.villagerJob === 'construction' || spec.villagerJob === 'horseCapture'
      const hasTarget =
        !needsKnownTarget ||
        npcs.some(npc => npc.type === UNIT_TYPES.villager && hasVillagerAutonomyTarget(npc, spec.villagerJob!))
      button.disabled = !hasVillager || !hasTarget || nightWorkBlocked
    }
    if (this.modal) {
      setModalTitle(this.modal, title)
      setInspectionMode(this.modal, hasInfo)
      return
    }
    this.modal = createInspectionModal({
      title,
      content: this.panel,
      panelClass: 'npc-orders-panel',
      inspection: hasInfo,
      onClose: () => this.close(),
    })
  }

  private async cycleDebugLevel(target: UnitEntity): Promise<void> {
    const currentLevel = getUnitEquipmentLevel(target)
    const nextLevel = Math.min(XP_MAX_LEVEL, currentLevel + 1)
    setUnitDebugLevel(target, nextLevel)
    refreshUnitEquipmentStats(target)
    await ensureAndRefreshBakedLpcUnitAssets(target)
    this.infoContainer.replaceChildren()
    if (target.interface?.info) {
      this.infoContainer.appendChild(createTitledEntityInfoContent(this.menu.context.app, target, { showAllXp: true }))
    }
    this.updateDebugControls(target)
    this.menu.updateHeroStatus?.(target)
  }

  private updateDebugControls(target: UnitEntity | null): void {
    const showDebug = Boolean(target && target.type !== UNIT_TYPES.villager)
    this.debugContainer.hidden = !showDebug
    if (!target) return
    if (!showDebug) return
    const currentLevel = getUnitEquipmentLevel(target)
    const isMaxLevel = currentLevel >= XP_MAX_LEVEL
    const nextLevel = Math.min(XP_MAX_LEVEL, currentLevel + 1)
    this.debugLevelButton.disabled = isMaxLevel
    this.debugLevelButton.textContent = isMaxLevel ? 'Debug niveau max' : `Debug niveau ${nextLevel}`
  }

  close(keepFrozen = false): void {
    if (!this.opened && !this.modal) return
    const modal = this.modal
    this.modal = undefined
    this.opened = false
    this.ordersEnabled = false
    this.closeBag()
    this.orderMenu.reset()
    const npcs = this.npcs
    this.npcs = []
    if (!keepFrozen) releaseIfStillLooking(npcs)
    modal?.close()
  }

  toggle(npcs: UnitEntity[]): void {
    if (this.opened) {
      this.close()
      return
    }
    this.open(npcs)
  }

  isOpen(): boolean {
    return this.opened
  }

  getTarget(): UnitEntity[] {
    return this.npcs
  }

  destroy(): void {
    this.modal?.close()
    this.modal = undefined
  }

  private createOrderMenuItems(): NestedButtonMenuItem<NpcOrderMenuId>[] {
    return NPC_ORDER_SPECS.flatMap(spec => {
      const item = this.createOrderMenuItem(spec)
      if (spec.id !== 'goto') return [item]
      return [
        item,
        {
          id: 'bag',
          label: t('npcOrderBag'),
          hidden: () => !this.canShowBagButton(),
          onClick: () => this.openBag(),
        },
        {
          id: 'resources',
          label: t('npcOrderResources'),
          children: NPC_RESOURCE_ORDER_SPECS.map(resourceSpec => this.createOrderMenuItem(resourceSpec)),
        },
      ]
    })
  }

  private createOrderMenuItem(spec: NpcOrderSpec): NestedButtonMenuItem<NpcOrderMenuId> {
    return {
      id: spec.id,
      label: t(spec.labelKey),
      onClick: () => this.runOrder(spec),
    }
  }

  refreshInventory(): void {
    if (!this.opened || this.bagContainer.hidden) return
    this.renderBag()
  }

  private canShowBagButton(): boolean {
    return this.ordersEnabled && this.npcs.length === 1 && Boolean(this.menu.context.controls.heroUnit)
  }

  private openBag(): void {
    if (!this.canShowBagButton()) return
    playUiSound(SOUND_CUES.ui.menuClick)
    this.orderMenu.reset()
    this.buttonsContainer.hidden = true
    this.bagContainer.hidden = false
    this.renderBag()
  }

  private closeBag(): void {
    this.transferPanel = null
    this.bagContainer.hidden = true
    this.bagContainer.replaceChildren()
    this.buttonsContainer.hidden = !this.ordersEnabled
  }

  private renderBag(): void {
    const npc = this.npcs.length === 1 ? this.npcs[0] : null
    const hero = this.menu.context.controls.heroUnit
    if (!npc || !hero) {
      this.closeBag()
      return
    }

    const npcContainer = createInventoryContainer(npc, {
      id: npc.label,
      label: t('inventoryNpcBag', { name: npc.name || t('npcOrdersTitle') }),
      labelKey: 'inventoryBag',
    })
    const heroContainer = createInventoryContainer(hero, {
      id: hero.label,
      labelKey: 'inventoryYourBag',
    })
    this.transferPanel = new InventoryTransferPanel({
      context: this.menu.context,
      destination: npcContainer,
      source: heroContainer,
      onChange: () => this.menu.updateHeroStatus?.(hero),
    })
    this.bagContainer.replaceChildren(this.transferPanel.element)
  }

  private runOrder(spec: NpcOrderSpec): void {
    if (!this.npcs.length) return
    playUiSound(SOUND_CUES.ui.menuClick)
    const npcs = this.npcs
    if (spec.id === 'cancel') {
      this.close()
      return
    }
    if (spec.startsPicking) {
      // Still committed to an order (waiting on the world click) — don't resume old tasks yet.
      this.close(true)
      this.menu.context.controls.beginNpcGoTo?.(npcs)
      return
    }
    this.close(true)
    if (spec.villagerJob) {
      for (const npc of npcs) {
        if (npc.type !== UNIT_TYPES.villager) continue
        clearNpcCommunicationFocus(npc)
        npc.previousDest = null
        assignVillagerAutonomy(npc, spec.villagerJob)
      }
    } else {
      for (const npc of npcs) spec.run?.(npc)
    }
    playNpcOrderSound(npcs)
  }
}
