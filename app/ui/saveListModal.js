import { Modal } from '../lib'
import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { listSaves, loadSave, deleteSave } from '../serialization/SaveStorage'

export function openSaveListModal({ onLoad, onError, onClose }) {
  const saves = listSaves()

  const content = document.createElement('div')
  content.className = 'save-list'

  let modal

  if (saves.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'save-list-empty'
    empty.textContent = t('noSaves')
    content.appendChild(empty)
  } else {
    saves.forEach(({ key, name }) => {
      const row = document.createElement('div')
      row.className = 'save-list-row'

      const nameEl = document.createElement('span')
      nameEl.className = 'save-list-name'
      nameEl.textContent = name

      const loadBtn = document.createElement('button')
      loadBtn.className = 'btn-dark'
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

      const deleteBtn = document.createElement('button')
      deleteBtn.className = 'btn-dark secondary'
      deleteBtn.textContent = '✕'
      deleteBtn.addEventListener('pointerdown', playClickSound)
      deleteBtn.addEventListener('click', () => {
        deleteSave(key)
        row.remove()
        if (!content.querySelector('.save-list-row')) {
          const empty = document.createElement('div')
          empty.className = 'save-list-empty'
          empty.textContent = t('noSaves')
          content.appendChild(empty)
        }
      })

      row.appendChild(nameEl)
      row.appendChild(loadBtn)
      row.appendChild(deleteBtn)
      content.appendChild(row)
    })
  }

  modal = new Modal({ title: t('loadGame'), content, onClose })
}
