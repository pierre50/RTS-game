import { Modal } from '../lib'
import { attachInspectionHeader } from './InspectionHeader'
import { isHeroInteractionSessionInRange } from '../lib/hero/heroActionRange'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { RuntimeEntity } from '../types/entities'

export type InspectionWindowSize = 'small' | 'large'

type InspectionModalOptions = {
  size?: InspectionWindowSize
  proximity?: {
    context: GameContextLike
    targets: () => RuntimeEntity[]
    enabled?: () => boolean
  }
  title: string
  content: HTMLElement
  headerContent?: HTMLElement
  panelClass?: string
  inspection?: boolean
  interaction?: boolean
  dismissible?: boolean
  onClose: () => void
}

export function setModalTitle(modal: Modal | undefined, title: string): void {
  const titleElement = modal?._panel?.querySelector<HTMLElement>('.modal-title')
  if (titleElement) titleElement.textContent = title
}

export function setInspectionMode(modal: Modal | undefined, enabled: boolean): void {
  setInspectionWindowSize(modal, enabled ? 'small' : 'large')
}

/** Two explicit layouts shared by conversations, inspection and building management. */
export function setInspectionWindowSize(modal: Modal | undefined, size: InspectionWindowSize): void {
  const small = size === 'small'
  modal?._panel?.classList.toggle('inspection-panel', small)
  modal?._backdrop?.classList.toggle('inspection-panel-backdrop', small)
  for (const value of ['small', 'large'] as const) {
    modal?._panel?.classList.toggle(`inspection-window--${value}`, size === value)
    modal?._backdrop?.classList.toggle(`inspection-window-backdrop--${value}`, size === value)
  }
}

export function createInspectionModal({
  size,
  proximity,
  title,
  content,
  headerContent,
  panelClass,
  inspection = true,
  interaction = false,
  dismissible = true,
  onClose,
}: InspectionModalOptions): Modal {
  let disposeHeader: (() => void) | undefined
  let task: SchedulerTaskId | undefined
  const cleanup = () => {
    disposeHeader?.()
    if (task !== undefined) proximity?.context.scheduler.remove(task)
    task = undefined
  }
  const modal = new Modal({
    title,
    content,
    headerContent,
    gameWindow: true,
    dismissible,
    onClose: () => {
      cleanup()
      onClose()
    },
  })
  if (!headerContent && content && modal._panel) disposeHeader = attachInspectionHeader(modal._panel, content)
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
  setInspectionWindowSize(modal, size ?? (inspection ? 'small' : 'large'))
  if (interaction) modal._panel?.classList.add('interaction-panel')
  return modal
}
