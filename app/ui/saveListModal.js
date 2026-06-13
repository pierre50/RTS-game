import { Modal } from '../lib'
import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { listSaves, loadSave, deleteSave, exportSave, importSaveFile, EXPORT_EXT } from '../serialization/SaveStorage'

export function openSaveListModal({ onLoad, onError, onClose }) {
  let saves = listSaves()

  const wrapper = document.createElement('div')
  wrapper.className = 'save-list-wrapper'

  const listEl = document.createElement('div')
  listEl.className = 'save-list'

  let modal
  let importStatus

  function reportError(message) {
    importStatus.textContent = message
    importStatus.className = 'save-list-import-status save-list-import-status--err'
    onError?.(message)
  }

  function confirmDeleteSave(key, name) {
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
      saves = saves.filter(save => save.key !== key)
      renderList()
    })
    cancelBtn.addEventListener('pointerdown', playClickSound)
    cancelBtn.addEventListener('click', () => confirmModal.close())

    content.appendChild(confirmBtn)
    content.appendChild(cancelBtn)
  }

  function renderList() {
    listEl.innerHTML = ''
    if (saves.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'save-list-empty'
      empty.textContent = t('noSaves')
      listEl.appendChild(empty)
    } else {
      saves.forEach(({ key, name }) => {
        const row = document.createElement('div')
        row.className = 'save-list-row'

        const nameEl = document.createElement('span')
        nameEl.className = 'save-list-name'
        nameEl.textContent = name

        const loadBtn = document.createElement('button')
        loadBtn.className = 'ui-btn'
        loadBtn.textContent = t('load')
        loadBtn.addEventListener('pointerdown', playClickSound)
        loadBtn.addEventListener('click', () => {
          try {
            const saveData = loadSave(key)
            modal.close()
            onLoad(saveData)
          } catch {
            reportError(t('corruptSave'))
          }
        })

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
            reportError(t('exportError'))
          }
        })

        const deleteBtn = document.createElement('button')
        deleteBtn.className = 'ui-btn'
        deleteBtn.textContent = '✕'
        deleteBtn.title = t('deleteSave')
        deleteBtn.setAttribute('aria-label', `${t('deleteSave')} : ${name}`)
        deleteBtn.addEventListener('pointerdown', playClickSound)
        deleteBtn.addEventListener('click', () => confirmDeleteSave(key, name))

        row.appendChild(nameEl)
        row.appendChild(loadBtn)
        row.appendChild(exportBtn)
        row.appendChild(deleteBtn)
        listEl.appendChild(row)
      })
    }
  }

  renderList()
  wrapper.appendChild(listEl)

  // --- Import footer ---
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

  importStatus = document.createElement('span')
  importStatus.className = 'save-list-import-status'
  importStatus.setAttribute('role', 'status')
  importStatus.setAttribute('aria-live', 'polite')

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file) return
    fileInput.value = ''
    importBtn.disabled = true
    importStatus.textContent = ''
    importStatus.className = 'save-list-import-status'
    try {
      const { name } = await importSaveFile(file)
      saves = listSaves()
      renderList()
      importStatus.textContent = t('importSuccess', { name })
      importStatus.classList.add('save-list-import-status--ok')
    } catch (err) {
      const msgKey =
        err.message === 'MAX_SAVES_REACHED'
          ? 'maxSavesReached'
          : err.message === 'STORAGE_FULL'
            ? 'storageFull'
            : 'importError'
      importStatus.textContent = t(msgKey)
      importStatus.classList.add('save-list-import-status--err')
    } finally {
      importBtn.disabled = false
    }
  })

  footer.appendChild(fileInput)
  footer.appendChild(importBtn)
  footer.appendChild(importStatus)
  wrapper.appendChild(footer)

  modal = new Modal({ title: t('loadGame'), content: wrapper, onClose })
}
