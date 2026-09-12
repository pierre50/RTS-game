import { Modal } from '../lib'

type InspectionModalOptions = {
  title: string
  content: HTMLElement
  panelClass?: string
  inspection?: boolean
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
  title,
  content,
  panelClass,
  inspection = true,
  showCloseButton = true,
  dismissible = true,
  onClose,
}: InspectionModalOptions): Modal {
  const modal = new Modal({ title, content, onClose, dismissible, showCloseButton })
  if (panelClass) modal._panel?.classList.add(panelClass)
  setInspectionMode(modal, inspection)
  return modal
}
