import type { Modal } from '../../lib'
import type { TributeRaidUnit } from '../TributeRaidRules'
import { canAfford, payCost } from '../../lib'
import { livingRaidUnits, type TributeRaid } from '../TributeRaidRules'
import type { TributeRaidSystem } from '../TributeRaidSystem'
import {
  getLocalTributeRefusedMessage,
  getLocalTributeTargetMessage,
  getTributeCannotPayLabel,
  getTributeDemand,
  getTributePayLabel,
  getTributeRefuseLabel,
  getTributeTitle,
} from '../TributeRaidText'

type TributeModalView = {
  createChiefContent: (chief: TributeRaidUnit) => HTMLElement
  createModal: (options: {
    title: string
    content: HTMLElement
    panelClass: string
    showCloseButton?: boolean
    onClose: () => void
  }) => Modal
}

export function openTributeModal(runtime: TributeRaidSystem, raid: TributeRaid, view: TributeModalView): void {
  if (raid.phase !== 'approaching' || raid.modal) return
  raid.phase = 'parley'
  for (const unit of livingRaidUnits(raid)) unit.stop?.()

  let resolved = false
  const content = document.createElement('div')
  content.className = 'bandit-tribute-modal-content'
  content.appendChild(view.createChiefContent(raid.chief))

  const speech = document.createElement('p')
  speech.className = 'bandit-tribute-text'
  speech.textContent = getTributeDemand(raid)
  content.appendChild(speech)

  const actions = document.createElement('div')
  actions.className = 'npc-orders-options bandit-tribute-actions'

  const canPayTribute = canAfford(runtime.context.player, raid.tribute)
  const payButton = document.createElement('button')
  payButton.type = 'button'
  payButton.className = 'ui-btn'
  payButton.textContent = getTributePayLabel(raid)
  payButton.disabled = !canPayTribute
  if (!canPayTribute) payButton.title = getTributeCannotPayLabel(raid)
  payButton.addEventListener('click', () => {
    if (resolved || raid.phase !== 'parley') return
    if (!canAfford(runtime.context.player, raid.tribute)) {
      runtime.context.menu?.showMessage(getTributeCannotPayLabel(raid), 'warning')
      return
    }
    resolved = true
    payCost(runtime.context.player, raid.tribute)
    runtime.context.menu?.updateTopbar()
    raid.modal?.close()
    raid.modal = null
    runtime.acceptTribute(raid)
  })
  actions.appendChild(payButton)

  const refuseButton = document.createElement('button')
  refuseButton.type = 'button'
  refuseButton.className = 'ui-btn'
  refuseButton.textContent = getTributeRefuseLabel(raid)
  refuseButton.addEventListener('click', () => {
    if (resolved || raid.phase !== 'parley') return
    resolved = true
    raid.modal?.close()
    raid.modal = null
    runtime.makeRaidHostile(raid)
  })
  actions.appendChild(refuseButton)
  content.appendChild(actions)

  raid.modal = view.createModal({
    title: getTributeTitle(raid),
    content,
    panelClass: 'bandit-tribute-modal',
    showCloseButton: false,
    onClose: () => {
      raid.modal = null
      if (!resolved && raid.phase === 'parley') runtime.makeRaidHostile(raid)
    },
  })
}

export function resolveTributeParley(runtime: TributeRaidSystem, raid: TributeRaid): void {
  if (raid.target.owner?.isPlayed) {
    runtime.openTributeModal(raid)
    return
  }

  raid.phase = 'parley'
  for (const unit of livingRaidUnits(raid)) unit.stop?.()
  const targetOwner = raid.target.owner
  if (targetOwner && runtime.shouldLocalChiefPayTribute(raid)) {
    payCost(targetOwner, raid.tribute)
    runtime.context.menu?.showMessage(getLocalTributeTargetMessage(raid), 'info')
    runtime.acceptTribute(raid)
    return
  }

  runtime.context.menu?.showMessage(getLocalTributeRefusedMessage(raid), 'warning')
  runtime.makeRaidHostile(raid)
}

export function shouldLocalChiefPayTribute(runtime: TributeRaidSystem, raid: TributeRaid): boolean {
  const targetOwner = raid.target.owner
  if (!targetOwner || !canAfford(targetOwner, raid.tribute)) return false
  return (runtime.context.map.random?.() ?? Math.random()) < 0.5
}
