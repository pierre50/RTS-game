import { Modal } from '../lib'
import { isHeroInteractionSessionInRange } from '../lib/hero/heroActionRange'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { RuntimeEntity } from '../types/entities'

type InspectionModalOptions = {
  proximity?: {
    context: GameContextLike
    targets: () => RuntimeEntity[]
    enabled?: () => boolean
  }
  title: string
  content: HTMLElement
  panelClass?: string
  inspection?: boolean
  interaction?: boolean
  showCloseButton?: boolean
  dismissible?: boolean
  onClose: () => void
}

export function setModalTitle(modal: Modal | undefined, title: string): void {
  const titleElement = modal?._panel?.querySelector<HTMLElement>('.modal-title')
  if (titleElement) titleElement.textContent = title
}

export function setInspectionMode(modal: Modal | undefined, enabled: boolean): void {
  modal?._panel?.classList.toggle('inspection-panel', enabled)
  modal?._backdrop?.classList.toggle('inspection-panel-backdrop', enabled)
}

export function createInspectionModal({
  proximity,
  title,
  content,
  panelClass,
  inspection = true,
  interaction = false,
  showCloseButton = true,
  dismissible = true,
  onClose,
}: InspectionModalOptions): Modal {
  let task: SchedulerTaskId | undefined
  const cleanup = () => {
    if (task !== undefined) proximity?.context.scheduler.remove(task)
    task = undefined
  }
  const modal = new Modal({
    title,
    content,
    gameWindow: true,
    dismissible,
    showCloseButton,
    onClose: () => {
      cleanup()
      onClose()
    },
  })
  const close = modal.close.bind(modal)
  modal.close = () => {
    cleanup()
    close()
  }
  if (proximity?.context.scheduler) {
    task = proximity.context.scheduler.add(
      () => {
        if (proximity.enabled?.() === false) return
        const hero = proximity.context.controls?.heroUnit
        if (proximity.targets().some(target => isHeroInteractionSessionInRange(hero, target))) return
        modal.close()
        onClose()
      },
      100,
      'ui.interactionProximity'
    )
  }
  if (panelClass) modal._panel?.classList.add(...panelClass.split(/\s+/).filter(Boolean))
  setInspectionMode(modal, inspection)
  if (interaction) modal._panel?.classList.add('interaction-panel')
  return modal
}
