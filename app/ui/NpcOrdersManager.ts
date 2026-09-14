import type { DialogueSequence } from '../types/dialogue'
import { heroCanCommand } from '../lib/chief'
import { createNpcGroupSummary } from './NpcGroupSummary'
import { InteractionPanel } from './InteractionPanel'
import type { Modal } from '../lib'
import { NpcQuestPanel } from './NpcQuestPanel'
import { canShowNpcJobOrder } from './menu/NpcOrderEligibility'
import { npcTrainingDetail } from './menu/NpcTrainingDetails'
import { assignVillagerAutonomy } from '../lib'
import { t } from '../lib/lang'
import { playUiSound } from '../lib/audio/uiSound'
import {
  findBestTrainingBuildingForUnit,
  sendUnitToTraining,
  VILLAGER_TRAINING_UNIT_TYPES,
} from '../lib/units/unitTrainingOrders'
import { getUnitEquipmentLevel, setUnitDebugLevel, XP_MAX_LEVEL } from '../lib/units/unitExperience'
import { refreshUnitEquipmentStats } from '../lib/equipment/equipmentStats'
import { ensureAndRefreshBakedLpcUnitAssets } from '../lib/lpc'
import { getUnitGender } from '../lib/units/unitIdentity'
import { SOUND_CUES, UNIT_TYPES } from '../constants'
import { isVillagerSleepTime, shouldVillagerRestBeforeBed } from '../lib/units/villagerSchedule'
import {
  keepNpcHere,
  startFollowingHero,
  releaseIfStillLooking,
  playNpcOrderSound,
  clearNpcCommunicationFocus,
} from '../lib/npc/npcInteraction'
import { createTitledEntityInfoContent } from './EntityInfoContent'
import { createInspectionModal, setInspectionMode, setModalTitle } from './InspectionPanel'
import {
  pickForeignNpcChatterLine,
  pickForeignNpcSleepingChatterLine,
  pickNpcGreetingLine,
  pickNpcRescueThanksLine,
  pickNpcRestingChatterLine,
  pickNpcSleepingChatterLine,
} from '../lib/npc/npcChatter'
import { NestedButtonMenu, type NestedButtonMenuItem } from './menu/NestedButtonMenu'
import { UnitInventoryScreen } from './inventory/UnitInventoryScreen'
import type { NpcOrdersOpenOptions } from '../types/context'
import type { UnitEntity, VillagerAutonomyJob } from '../types/entities'
import type { MenuHost } from './MenuHost'
import { SpokenTextReveal } from './SpokenTextReveal'

type NpcOrderId = 'stay' | 'follow' | 'goto' | 'mountHorse' | VillagerAutonomyJob | `train-${string}`
type NpcOrderMenuId = NpcOrderId | 'resources' | 'training' | 'bag'

type NpcOrderSpec = {
  id: NpcOrderId
  labelKey: string
  run?: (npc: UnitEntity) => void
  villagerJob?: VillagerAutonomyJob
  trainingType?: string
  mountHorse?: boolean
  startsPicking?: boolean
}

const NPC_ORDER_SPECS: NpcOrderSpec[] = [
  { id: 'goto', labelKey: 'npcOrderGoTo', startsPicking: true },
  { id: 'construction', labelKey: 'npcOrderConstruction', villagerJob: 'construction' },
  { id: 'horseCapture', labelKey: 'npcOrderHorseCapture', villagerJob: 'horseCapture' },
  { id: 'follow', labelKey: 'npcOrderFollow', run: startFollowingHero },
  { id: 'stay', labelKey: 'npcOrderStay', run: keepNpcHere },
]

const NPC_RESOURCE_ORDER_SPECS: Required<Pick<NpcOrderSpec, 'id' | 'labelKey' | 'villagerJob'>>[] = [
  { id: 'food', labelKey: 'npcOrderFood', villagerJob: 'food' },
  { id: 'wood', labelKey: 'npcOrderWood', villagerJob: 'wood' },
  { id: 'stone', labelKey: 'npcOrderStone', villagerJob: 'stone' },
  { id: 'gold', labelKey: 'npcOrderGold', villagerJob: 'gold' },
  { id: 'copper', labelKey: 'npcOrderCopper', villagerJob: 'copper' },
  { id: 'iron', labelKey: 'npcOrderIron', villagerJob: 'iron' },
]

const NPC_TRAINING_ORDER_SPECS: Required<Pick<NpcOrderSpec, 'id' | 'labelKey' | 'trainingType'>>[] =
  VILLAGER_TRAINING_UNIT_TYPES.map(type => ({
    id: `train-${type}`,
    labelKey: type,
    trainingType: type,
  }))

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
  speakerContainer: HTMLDivElement
  choicesContainer: HTMLDivElement
  infoContainer: HTMLDivElement
  chatterContainer: HTMLDivElement
  debugContainer: HTMLDivElement
  debugLevelButton: HTMLButtonElement
  buttonsContainer: HTMLDivElement
  exitButton: HTMLButtonElement
  bagScreen: UnitInventoryScreen | null
  private readonly chatterReveal = new SpokenTextReveal()
  modal?: Modal
  bagModal?: Modal
  orderMenu: NestedButtonMenu<NpcOrderMenuId>
  buttons: NestedButtonMenu<NpcOrderMenuId>['buttons']
  opened: boolean
  npcs: UnitEntity[]
  private scriptedReplyActive = false
  private dialogueRevision = 0
  private scriptedReplyPanel = document.createElement('div')
  questPanel: NpcQuestPanel
  ordersEnabled: boolean

  constructor(menu: MenuHost) {
    this.menu = menu
    this.opened = false
    this.npcs = []
    this.ordersEnabled = false
    this.bagScreen = null


    const layout = new InteractionPanel()
    this.panel = layout.element
    this.speakerContainer = layout.information
    this.choicesContainer = layout.actions

    this.infoContainer = document.createElement('div')
    this.infoContainer.className = 'npc-orders-info'
    this.speakerContainer.appendChild(this.infoContainer)

    this.chatterContainer = document.createElement('div')
    this.chatterContainer.className = 'npc-orders-chatter'
    this.speakerContainer.appendChild(this.chatterContainer)
    this.questPanel = new NpcQuestPanel(menu, (line, npc) => {
      this.stopChatterReveal()
      this.showChatterLine(line, npc)
    })
    this.choicesContainer.appendChild(this.questPanel.root)
    this.scriptedReplyPanel.className = 'npc-quest-options'
    this.choicesContainer.appendChild(this.scriptedReplyPanel)

    this.debugContainer = document.createElement('div')
    this.debugContainer.className = 'npc-orders-debug'
    this.speakerContainer.appendChild(this.debugContainer)

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
    this.choicesContainer.appendChild(this.buttonsContainer)

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

    // Keep the exit outside conditional choices, submenus and inventory content.
    this.exitButton = document.createElement('button')
    this.exitButton.type = 'button'
    this.exitButton.className = 'ui-btn npc-orders-exit'
    this.exitButton.textContent = t('npcOrderCancelSleep')
    this.exitButton.addEventListener('click', () => {
      playUiSound(SOUND_CUES.ui.menuClick)
      this.close()
    })
    this.choicesContainer.appendChild(this.exitButton)
  }

  open(npcs: UnitEntity[], options: NpcOrdersOpenOptions = {}): void {
    if (this.scriptedReplyActive) return
    const dialogue = options.dialogue ?? (options.scriptedReply ? {
      startId: 'reply',
      nodes: [{ id: 'reply', line: options.chatterLine ?? '', choices: [{ id: 'reply', label: options.scriptedReply.label }] }],
      onComplete: options.scriptedReply.onSelect,
    } : undefined)
    if (dialogue) {
      const ids = new Set(dialogue.nodes.map(node => node.id))
      if (ids.size !== dialogue.nodes.length || !ids.has(dialogue.startId) || dialogue.nodes.some(node =>
        !node.choices.length || new Set(node.choices.map(choice => choice.id)).size !== node.choices.length ||
        node.choices.some(choice => choice.nextId !== undefined && !ids.has(choice.nextId))))
        throw new Error('Invalid dialogue sequence')
    }
    this.scriptedReplyActive = Boolean(dialogue)
    this.exitButton.hidden = Boolean(dialogue)
    this.scriptedReplyPanel.hidden = !dialogue
    this.scriptedReplyPanel.replaceChildren()
    if (dialogue) this.showDialogueChoices(dialogue, dialogue.startId)
    this.npcs = npcs
    this.opened = true
    this.orderMenu.reset()
    this.closeBag()
    const title =
      npcs.length > 1 ? t('npcOrdersTitleCount', { count: npcs.length }) : npcs[0]?.name || t('npcOrdersTitle')

    // Individual information and group composition occupy the same information area.
    this.infoContainer.replaceChildren()
    const soloTarget = npcs.length === 1 ? npcs[0] : null
    const sleepingSoloTarget = isSleepingNpc(soloTarget)
    const ownSleepingSoloTarget = sleepingSoloTarget && soloTarget?.owner?.isPlayed === true
    const restingSoloTarget = isRestingBeforeBedNpc(soloTarget)
    const hasInfo = Boolean(soloTarget?.interface?.info)
    if (soloTarget && hasInfo) {
      this.infoContainer.appendChild(
        createTitledEntityInfoContent(this.menu.context.app, soloTarget, { showAllXp: true, hideStats: !heroCanCommand(this.menu.context.controls?.heroUnit) })
      )
    } else if (npcs.length > 1) {
      this.infoContainer.appendChild(createNpcGroupSummary(this.menu.context.app, npcs))
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
    this.stopChatterReveal()
    this.chatterContainer.replaceChildren()
    const rescuedNpcs = npcs.filter(npc => npc.owner?.isPlayed && npc.pendingRescueThanks)
    if (dialogue) this.questPanel.clear()
    const chatterLine =
      dialogue?.nodes.find(node => node.id === dialogue.startId)?.line ??
      this.questPanel.update(soloTarget, true) ??
      (rescuedNpcs.length ? pickNpcRescueThanksLine(rescuedNpcs) : null) ??
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
      const chatterSourceNpc = soloTarget ?? rescuedNpcs[0] ?? npcs[0] ?? null
      this.showChatterLine(chatterLine, chatterSourceNpc)
      for (const npc of rescuedNpcs) npc.pendingRescueThanks = false
    }

    this.updateDebugControls(soloTarget)
    if (dialogue) this.debugContainer.hidden = true

    for (const [id, button] of this.buttons) {
      if (id !== 'back') button.disabled = false
    }
    this.orderMenu.syncVisibility()
    if (this.modal) {
      setModalTitle(this.modal, title)
      setInspectionMode(this.modal, true)
      return
    }
    this.modal = createInspectionModal({
      proximity: { context: this.menu.context, targets: () => this.npcs.filter(npc => !npc.isDead), enabled: () => !this.scriptedReplyActive },
      title,
      content: this.panel,
      panelClass: 'npc-orders-panel',
      interaction: true,
      showCloseButton: false,
      dismissible: !dialogue,
      onClose: () => this.close(),
    })
  }

  private showDialogueChoices(sequence: DialogueSequence, nodeId: string): void {
    const node = sequence.nodes.find(node => node.id === nodeId)!
    const revision = ++this.dialogueRevision
    this.scriptedReplyPanel.replaceChildren()
    for (const choice of node.choices) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'ui-btn'
      button.textContent = choice.label
      button.addEventListener('click', () => {
        if (!this.scriptedReplyActive || revision !== this.dialogueRevision) return
        ++this.dialogueRevision
        button.disabled = true
        this.menu.playUiClick?.()
        if (choice.nextId !== undefined) {
          sequence.onNodeChanged?.(choice.nextId)
          const next = sequence.nodes.find(entry => entry.id === choice.nextId)!
          this.showChatterLine(next.line, this.npcs[0] ?? null)
          this.showDialogueChoices(sequence, next.id)
        } else {
          this.scriptedReplyActive = false
          sequence.onComplete()
        }
      })
      this.scriptedReplyPanel.appendChild(button)
    }
  }

  private async cycleDebugLevel(target: UnitEntity): Promise<void> {
    const currentLevel = getUnitEquipmentLevel(target)
    const nextLevel = Math.min(XP_MAX_LEVEL, currentLevel + 1)
    setUnitDebugLevel(target, nextLevel)
    refreshUnitEquipmentStats(target)
    await ensureAndRefreshBakedLpcUnitAssets(target)
    this.infoContainer.replaceChildren()
    if (target.interface?.info) {
      this.infoContainer.appendChild(createTitledEntityInfoContent(this.menu.context.app, target, { showAllXp: true, hideStats: !heroCanCommand(this.menu.context.controls?.heroUnit) }))
    }
    this.updateDebugControls(target)
    this.menu.updateHeroStatus?.(target)
  }

  private updateDebugControls(target: UnitEntity | null): void {
    const showDebug = Boolean(heroCanCommand(this.menu.context.controls?.heroUnit) && target && target.type !== UNIT_TYPES.villager)
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
    if (this.scriptedReplyActive) return
    if (!this.opened && !this.modal) return
    const modal = this.modal
    this.modal = undefined
    this.opened = false
    this.ordersEnabled = false
    this.questPanel.clear()
    this.scriptedReplyPanel.hidden = true
    this.scriptedReplyPanel.replaceChildren()
    this.closeBag()
    this.orderMenu.reset()
    const npcs = this.npcs
    this.npcs = []
    this.stopChatterReveal()
    if (!keepFrozen) releaseIfStillLooking(npcs)
    modal?.close()
    for (const npc of npcs) this.menu.context.neutralQuests?.dialogueClosed?.(npc)
  }

  private showChatterLine(line: string, speaker: UnitEntity | null): void {
    this.chatterContainer.replaceChildren()
    const renderedLine = document.createElement('p')
    renderedLine.className = 'npc-orders-chatter-line'
    this.chatterContainer.appendChild(renderedLine)
    this.chatterReveal.show([{ element: renderedLine, text: line }], getUnitGender(speaker) === 'female' ? 'female' : 'male')
  }

  private stopChatterReveal(): void {
    this.chatterReveal.stop()
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
    ++this.dialogueRevision
    this.stopChatterReveal()
    this.scriptedReplyActive = false
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
          hidden: () => !this.canShowResourcesButton(),
          children: NPC_RESOURCE_ORDER_SPECS.map(resourceSpec => this.createOrderMenuItem(resourceSpec)),
        },
        {
          id: 'training',
          label: t('unitTrainingMenu'),
          hidden: () => !this.canShowTrainingButton(),
          children: NPC_TRAINING_ORDER_SPECS.map(trainingSpec => this.createOrderMenuItem(trainingSpec)),
        },
        {
          id: 'mountHorse',
          label: t('mountHorseTraining'),
          hidden: () => !this.canShowMountHorseButton(),
          onClick: () => this.runOrder({ id: 'mountHorse', labelKey: 'mountHorseTraining', mountHorse: true }),
        },
      ]
    })
  }

  private createOrderMenuItem(spec: NpcOrderSpec): NestedButtonMenuItem<NpcOrderMenuId> {
    return {
      id: spec.id,
      label: t(spec.labelKey),
      detail: spec.trainingType ? () => this.getTrainingOrderDetail(spec.trainingType!) : undefined,
      hidden: () => !this.canShowOrder(spec),
      onClick: () => this.runOrder(spec),
    }
  }

  private getTrainingOrderDetail(trainingType: string): string {
    return npcTrainingDetail(this.npcs, this.menu.context.player, trainingType)
  }

  private hasVillager(): boolean {
    return this.npcs.some(npc => npc.type === UNIT_TYPES.villager)
  }

  private hasNightWorkBlock(): boolean {
    return this.hasVillager() && isVillagerSleepTime(this.menu.context)
  }

  private canShowOrder(spec: NpcOrderSpec): boolean {
    if (spec.id === 'follow') return this.npcs.some(npc => npc.followingHero !== true)
    if (spec.id === 'stay') return this.npcs.some(npc => npc.followingHero === true)
    if (spec.villagerJob) return this.canShowVillagerJobOrder(spec.villagerJob)
    if (spec.trainingType) return this.canShowTrainingOrder(spec.trainingType)
    if (spec.mountHorse) return this.canShowMountHorseButton()
    return true
  }

  private canShowResourcesButton(): boolean {
    return this.hasVillager() && !this.hasNightWorkBlock()
  }

  private canShowTrainingButton(): boolean {
    return (
      this.hasVillager() &&
      !this.hasNightWorkBlock() &&
      this.npcs.some(
        npc =>
          npc.type === UNIT_TYPES.villager &&
          VILLAGER_TRAINING_UNIT_TYPES.some(type => findBestTrainingBuildingForUnit(npc, type))
      )
    )
  }

  private canShowTrainingOrder(trainingType: string): boolean {
    return (
      !this.hasNightWorkBlock() &&
      this.npcs.some(
        npc => npc.type === UNIT_TYPES.villager && Boolean(findBestTrainingBuildingForUnit(npc, trainingType))
      )
    )
  }

  private canShowMountHorseButton(): boolean {
    return this.npcs.some(
      npc =>
        npc.type !== UNIT_TYPES.villager &&
        !npc.mountedOnHorse &&
        Boolean(findBestTrainingBuildingForUnit(npc, npc.type))
    )
  }

  private canShowVillagerJobOrder(job: VillagerAutonomyJob): boolean {
    return canShowNpcJobOrder(this.npcs, this.menu.context, job)
  }

  syncQuest(): void {
    if (this.opened && !this.scriptedReplyActive) this.questPanel.update(this.npcs.length === 1 ? this.npcs[0] : null)
  }

  refreshInventory(): void {
    this.syncQuest()
    if (!this.opened) return
    this.bagScreen?.render()
  }

  private canShowBagButton(): boolean {
    return this.ordersEnabled && this.npcs.length === 1 && Boolean(this.menu.context.controls.heroUnit)
  }

  private openBag(): void {
    if (this.bagModal || !this.canShowBagButton()) return
    playUiSound(SOUND_CUES.ui.menuClick)
    this.orderMenu.reset()
    this.buttonsContainer.hidden = true
    this.bagScreen = new UnitInventoryScreen(this.menu, this.npcs[0])
    this.bagModal = this.bagScreen.open(() => this.close())
    if (this.modal?._backdrop) this.modal._backdrop.hidden = true
  }

  private closeBag(): void {
    const bagModal = this.bagModal
    this.bagModal = undefined
    bagModal?.close()
    if (this.modal?._backdrop) this.modal._backdrop.hidden = false
    this.bagScreen = null
    this.buttonsContainer.hidden = !this.ordersEnabled
  }

  private runOrder(spec: NpcOrderSpec): void {
    if (!this.npcs.length) return
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
    } else if (spec.trainingType) {
      for (const npc of npcs) {
        if (npc.type !== UNIT_TYPES.villager) continue
        clearNpcCommunicationFocus(npc)
        npc.previousDest = null
        sendUnitToTraining(npc, spec.trainingType)
      }
    } else if (spec.mountHorse) {
      for (const npc of npcs) {
        if (npc.type === UNIT_TYPES.villager || npc.mountedOnHorse) continue
        clearNpcCommunicationFocus(npc)
        npc.previousDest = null
        sendUnitToTraining(npc, npc.type)
      }
    } else {
      for (const npc of npcs) spec.run?.(npc)
    }
    playNpcOrderSound(npcs)
  }
}
