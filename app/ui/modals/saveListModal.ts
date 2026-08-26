import { Modal } from '../../lib'
import { playClickSound } from '../../lib/audio/uiSound'
import { t } from '../../lib/lang'
import { listSaves, loadSave, deleteSave, exportSave, importSaveFile, EXPORT_EXT } from '../../serialization/SaveStorage'
import type { SaveIndexEntry, SaveRecord } from '../../types/save'

type SaveListModalOptions = {
  onLoad: (saveData: SaveRecord) => void
  onError?: (message: string) => void
  onChange?: () => void
  onClose?: () => void
}

type SaveListState = SaveListModalOptions & {
  saves: SaveIndexEntry[]
  listEl: HTMLDivElement
  getModal: () => Modal
  setSaves: (saves: SaveIndexEntry[]) => void
}

function reportError(importStatus: HTMLSpanElement, onError: SaveListModalOptions['onError'], message: string): void {
  importStatus.textContent = message
  importStatus.className = 'save-list-import-status save-list-import-status--err'
  onError?.(message)
}

function confirmDeleteSave(state: SaveListState, key: string, name: string): void {
  const content = document.createElement('div')
  content.className = 'modal-menu'

  const message = document.createElement('p')
  message.className = 'save-list-confirm-message'
  message.textContent = t('confirmDeleteSave', { name })
  content.appendChild(message)

  const confirmBtn = document.createElement('button')
  confirmBtn.type = 'button'
  confirmBtn.className = 'ui-btn'
  confirmBtn.textContent = t('deleteSave')

  const cancelBtn = document.createElement('button')
  cancelBtn.type = 'button'
  cancelBtn.className = 'ui-btn'
  cancelBtn.textContent = t('cancel')

  const confirmModal = new Modal({
    title: t('deleteSave'),
    content,
  })

  confirmBtn.addEventListener('pointerdown', playClickSound)
  confirmBtn.addEventListener('click', () => {
    confirmModal.close()
    deleteSave(key)
    state.setSaves(state.saves.filter(save => save.key !== key))
    renderList(state)
    state.onChange?.()
  })
  cancelBtn.addEventListener('pointerdown', playClickSound)
  cancelBtn.addEventListener('click', () => confirmModal.close())

  content.appendChild(confirmBtn)
  content.appendChild(cancelBtn)
}

function createSaveRow(
  state: SaveListState,
  importStatus: HTMLSpanElement | null,
  { key, name }: SaveIndexEntry,
): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'save-list-row'

  const nameEl = document.createElement('span')
  nameEl.className = 'save-list-name'
  nameEl.textContent = name

  const loadBtn = createLoadButton(state, importStatus, key)
  const exportBtn = createExportButton(state, importStatus, key, name)
  const deleteBtn = createDeleteButton(state, key, name)

  row.appendChild(nameEl)
  row.appendChild(loadBtn)
  row.appendChild(exportBtn)
  row.appendChild(deleteBtn)
  return row
}

function createLoadButton(state: SaveListState, importStatus: HTMLSpanElement | null, key: string): HTMLButtonElement {
  const loadBtn = document.createElement('button')
  loadBtn.className = 'ui-btn'
  loadBtn.textContent = t('load')
  loadBtn.addEventListener('pointerdown', playClickSound)
  loadBtn.addEventListener('click', () => {
    try {
      const saveData = loadSave(key)
      state.getModal().close()
      state.onLoad(saveData)
    } catch {
      reportMaybeVisibleError(state, importStatus, t('corruptSave'))
    }
  })
  return loadBtn
}

function createExportButton(
  state: SaveListState,
  importStatus: HTMLSpanElement | null,
  key: string,
  name: string,
): HTMLButtonElement {
  const exportBtn = document.createElement('button')
  exportBtn.className = 'ui-btn save-list-export-btn'
  exportBtn.title = t('exportSave')
  exportBtn.setAttribute('aria-label', `${t('exportSave')} : ${name}`)
  exportBtn.textContent = '⬇'
  exportBtn.addEventListener('pointerdown', playClickSound)
  exportBtn.addEventListener('click', () => {
    try {
      exportSave(key)
    } catch {
      reportMaybeVisibleError(state, importStatus, t('exportError'))
    }
  })
  return exportBtn
}

function createDeleteButton(state: SaveListState, key: string, name: string): HTMLButtonElement {
  const deleteBtn = document.createElement('button')
  deleteBtn.className = 'ui-btn'
  deleteBtn.textContent = '✕'
  deleteBtn.title = t('deleteSave')
  deleteBtn.setAttribute('aria-label', `${t('deleteSave')} : ${name}`)
  deleteBtn.addEventListener('pointerdown', playClickSound)
  deleteBtn.addEventListener('click', () => confirmDeleteSave(state, key, name))
  return deleteBtn
}

function reportMaybeVisibleError(
  state: SaveListState,
  importStatus: HTMLSpanElement | null,
  message: string,
): void {
  if (importStatus) {
    reportError(importStatus, state.onError, message)
    return
  }

  state.onError?.(message)
}

function renderList(state: SaveListState, importStatus: HTMLSpanElement | null = null): void {
  state.listEl.innerHTML = ''
  if (state.saves.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'save-list-empty'
    empty.textContent = t('noSaves')
    state.listEl.appendChild(empty)
    return
  }

  state.saves.forEach(save => {
    state.listEl.appendChild(createSaveRow(state, importStatus, save))
  })
}

function getImportErrorKey(err: unknown): string {
  const message = err instanceof Error ? err.message : ''
  return message === 'MAX_SAVES_REACHED' ? 'maxSavesReached' : message === 'STORAGE_FULL' ? 'storageFull' : 'importError'
}

function createImportFooter(state: SaveListState): HTMLDivElement {
  const footer = document.createElement('div')
  footer.className = 'save-list-footer'

  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = EXPORT_EXT
  fileInput.style.display = 'none'

  const importBtn = document.createElement('button')
  importBtn.className = 'ui-btn save-list-import-btn'
  importBtn.textContent = t('importSave')
  importBtn.addEventListener('pointerdown', playClickSound)
  importBtn.addEventListener('click', () => fileInput.click())

  const importStatus = createImportStatus()
  fileInput.addEventListener('change', () => {
    void handleSaveImport(state, fileInput, importBtn, importStatus)
  })

  footer.appendChild(fileInput)
  footer.appendChild(importBtn)
  footer.appendChild(importStatus)
  return footer
}

function createImportStatus(): HTMLSpanElement {
  const importStatus = document.createElement('span')
  importStatus.className = 'save-list-import-status'
  importStatus.setAttribute('role', 'status')
  importStatus.setAttribute('aria-live', 'polite')
  return importStatus
}

async function handleSaveImport(
  state: SaveListState,
  fileInput: HTMLInputElement,
  importBtn: HTMLButtonElement,
  importStatus: HTMLSpanElement,
): Promise<void> {
  const file = fileInput.files?.[0]
  if (!file) return

  fileInput.value = ''
  importBtn.disabled = true
  importStatus.textContent = ''
  importStatus.className = 'save-list-import-status'
  try {
    const { name } = await importSaveFile(file)
    state.setSaves(listSaves())
    renderList(state, importStatus)
    state.onChange?.()
    importStatus.textContent = t('importSuccess', { name })
    importStatus.classList.add('save-list-import-status--ok')
  } catch (err) {
    importStatus.textContent = t(getImportErrorKey(err))
    importStatus.classList.add('save-list-import-status--err')
  } finally {
    importBtn.disabled = false
  }
}

export function openSaveListModal({ onLoad, onError, onChange, onClose }: SaveListModalOptions): void {
  let modal: Modal
  const wrapper = document.createElement('div')
  wrapper.className = 'save-list-wrapper'

  const listEl = document.createElement('div')
  listEl.className = 'save-list'

  const state: SaveListState = {
    saves: listSaves(),
    listEl,
    onLoad,
    onError,
    onChange,
    onClose,
    getModal: () => modal,
    setSaves: saves => {
      state.saves = saves
    },
  }

  renderList(state)
  wrapper.appendChild(listEl)
  wrapper.appendChild(createImportFooter(state))

  modal = new Modal({ title: t('loadGame'), content: wrapper, onClose })
}
