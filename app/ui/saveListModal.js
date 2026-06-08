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
            if (onError) onError(t('corruptSave'))
          }
        })

        const exportBtn = document.createElement('button')
        exportBtn.className = 'ui-btn save-list-export-btn'
        exportBtn.title = t('exportSave')
        exportBtn.textContent = '⬇'
        exportBtn.addEventListener('pointerdown', playClickSound)
        exportBtn.addEventListener('click', () => {
          try {
            exportSave(key)
          } catch {
            if (onError) onError(t('exportError'))
          }
        })

        const deleteBtn = document.createElement('button')
        deleteBtn.className = 'ui-btn'
        deleteBtn.textContent = '✕'
        deleteBtn.addEventListener('pointerdown', playClickSound)
        deleteBtn.addEventListener('click', () => {
          deleteSave(key)
          saves = saves.filter(s => s.key !== key)
          renderList()
        })

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

  const importStatus = document.createElement('span')
  importStatus.className = 'save-list-import-status'

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
        err.message === 'MAX_SAVES_REACHED' ? 'maxSavesReached'
        : err.message === 'STORAGE_FULL' ? 'storageFull'
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
