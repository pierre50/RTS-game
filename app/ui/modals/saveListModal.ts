import { Modal } from '../../lib'
import { playClickSound } from '../../lib/audio/uiSound'
import { t } from '../../lib/lang'
import { listSaves, loadSave } from '../../serialization/SaveStorage'
import type { SaveIndexEntry, SaveRecord } from '../../types/save'
import { createInventoryActionRow } from '../inventory/InventoryActionRow'

type SaveListModalOptions = {
  onLoad: (saveData: SaveRecord) => void
  onError?: (message: string) => void
  onClose?: () => void
}

type SaveListState = SaveListModalOptions & {
  saves: SaveIndexEntry[]
  listEl: HTMLDivElement
  getModal: () => Modal
}

function formatSaveDate(date: number): string {
  if (!Number.isFinite(date)) return ''
  return new Date(date).toLocaleString()
}

function createSaveRow(state: SaveListState, { key, name, date }: SaveIndexEntry): HTMLElement {
  return createInventoryActionRow(
    { playUiClick: playClickSound },
    {
      id: `save-list-${key}`,
      className: 'save-list-row',
      hideIcon: true,
      title: name,
      description: formatSaveDate(date),
      trailingAction: {
        label: t('load'),
        onClick: () => {
          try {
            const saveData = loadSave(key)
            state.getModal().close()
            state.onLoad(saveData)
          } catch {
            reportMaybeVisibleError(state, t('corruptSave'))
          }
        },
      },
    }
  ).element
}

function reportMaybeVisibleError(state: SaveListState, message: string): void {
  state.onError?.(message)
}

function renderList(state: SaveListState): void {
  state.listEl.innerHTML = ''
  if (state.saves.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'save-list-empty'
    empty.textContent = t('noSaves')
    state.listEl.appendChild(empty)
    return
  }

  state.saves.forEach(save => {
    state.listEl.appendChild(createSaveRow(state, save))
  })
}

export function openSaveListModal({ onLoad, onError, onClose }: SaveListModalOptions): void {
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
    onClose,
    getModal: () => modal,
  }

  renderList(state)
  wrapper.appendChild(listEl)

  modal = new Modal({ title: t('loadGame'), content: wrapper, onClose })
}
