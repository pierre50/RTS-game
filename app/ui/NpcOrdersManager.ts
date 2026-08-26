import { assignVillagerAutonomy, hasVillagerAutonomyTarget } from '../lib'
import { t } from '../lib/lang'
import { playUiSound } from '../lib/audio/uiSound'
import { getUnitEquipmentLevel, setUnitDebugLevel, XP_MAX_LEVEL } from '../lib/units/unitExperience'
import { refreshUnitEquipmentStats } from '../lib/equipment/equipmentStats'
import { ensureAndRefreshBakedLpcUnitAssets } from '../lib/lpc'
import { SOUND_CUES, UNIT_TYPES } from '../constants'
import {
  keepNpcHere,
  canKeepNpcHere,
  startFollowingHero,
  releaseIfStillLooking,
  playNpcOrderSound,
  clearNpcCommunicationFocus,
} from '../lib/npc/npcInteraction'
import { createTitledEntityInfoContent } from './EntityInfoModalManager'
import { createInspectionModal, setInspectionMode, setModalTitle } from './InspectionPanel'
import { pickForeignNpcChatterLine, pickNpcGreetingLine } from '../lib/npc/npcChatter'
import type { Modal } from '../lib'
import type { NpcOrdersOpenOptions } from '../types/context'
import type { UnitEntity, VillagerAutonomyJob } from '../types/entities'
import type { MenuHost } from './MenuHost'

type NpcOrderId = 'stay' | 'follow' | 'goto' | VillagerAutonomyJob

const NPC_ORDER_SPECS: {
  id: NpcOrderId
  labelKey: string
  run?: (npc: UnitEntity) => void
  villagerJob?: VillagerAutonomyJob
  startsPicking?: boolean
}[] = [
  { id: 'goto', labelKey: 'npcOrderGoTo', startsPicking: true },
  { id: 'food', labelKey: 'npcOrderFood', villagerJob: 'food' },
  { id: 'wood', labelKey: 'npcOrderWood', villagerJob: 'wood' },
  { id: 'stone', labelKey: 'npcOrderStone', villagerJob: 'stone' },
  { id: 'gold', labelKey: 'npcOrderGold', villagerJob: 'gold' },
  { id: 'construction', labelKey: 'npcOrderConstruction', villagerJob: 'construction' },
  { id: 'horseCapture', labelKey: 'npcOrderHorseCapture', villagerJob: 'horseCapture' },
  { id: 'follow', labelKey: 'npcOrderFollow', run: startFollowingHero },
  { id: 'stay', labelKey: 'npcOrderStay', run: keepNpcHere },
]

export class NpcOrdersManager {
  menu: MenuHost
  panel: HTMLDivElement
  infoContainer: HTMLDivElement
  chatterContainer: HTMLDivElement
  debugContainer: HTMLDivElement
  debugLevelButton: HTMLButtonElement
  buttonsContainer: HTMLDivElement
  modal?: Modal
  buttons: Map<NpcOrderId, HTMLButtonElement>
  opened: boolean
  npcs: UnitEntity[]

  constructor(menu: MenuHost) {
    this.menu = menu
    this.opened = false
    this.npcs = []
    this.buttons = new Map()

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

    for (const spec of NPC_ORDER_SPECS) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'ui-btn'
      button.textContent = t(spec.labelKey)
      button.addEventListener('click', () => {
        if (!this.npcs.length || button.disabled) return
        playUiSound(SOUND_CUES.ui.menuClick)
        const npcs = this.npcs
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
      })
      this.buttons.set(spec.id, button)
      this.buttonsContainer.appendChild(button)
    }
  }

  open(npcs: UnitEntity[], options: NpcOrdersOpenOptions = {}): void {
    this.npcs = npcs
    this.opened = true
    const title =
      npcs.length > 1 ? t('npcOrdersTitleCount', { count: npcs.length }) : npcs[0]?.name || t('npcOrdersTitle')

    // A single target gets its stats/avatar shown above the order buttons, in the same panel —
    // a group order doesn't have one set of stats to show, so it stays buttons-only.
    this.infoContainer.replaceChildren()
    const soloTarget = npcs.length === 1 ? npcs[0] : null
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
    this.buttonsContainer.hidden = !ordersEnabled

    // A commandable single target gets a short in-character greeting addressed to the player
    // instead of idle chatter — callers can still override with an explicit chatterLine.
    this.chatterContainer.replaceChildren()
    const chatterLine =
      options.chatterLine ??
      (soloTarget
        ? ordersEnabled
          ? pickNpcGreetingLine(this.menu.context.player?.name ?? '')
          : pickForeignNpcChatterLine(soloTarget)
        : null)
    if (chatterLine) {
      const line = document.createElement('p')
      line.className = 'npc-orders-chatter-line'
      line.textContent = chatterLine
      this.chatterContainer.appendChild(line)
    }

    this.updateDebugControls(soloTarget)

    const stayButton = this.buttons.get('stay')
    if (stayButton) {
      stayButton.disabled = !npcs.some(canKeepNpcHere)
    }
    const hasVillager = npcs.some(npc => npc.type === UNIT_TYPES.villager)
    for (const spec of NPC_ORDER_SPECS) {
      if (!spec.villagerJob) continue
      const button = this.buttons.get(spec.id)
      if (!button) continue
      const needsKnownTarget = spec.villagerJob === 'construction' || spec.villagerJob === 'horseCapture'
      const hasTarget =
        !needsKnownTarget ||
        npcs.some(npc => npc.type === UNIT_TYPES.villager && hasVillagerAutonomyTarget(npc, spec.villagerJob!))
      button.disabled = !hasVillager || !hasTarget
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
}
