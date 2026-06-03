import { Modal } from '../lib'
import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { parseSaveJSON } from '../serialization/SaveValidator'

export class PauseMenu {
  constructor(menu) {
    this.menu = menu
  }

  createOpenButton() {
    const button = document.createElement('div')
    button.className = 'topbar-options-menu btn-ui'
    button.innerText = t('menuBtn')
    button.addEventListener('pointerdown', () => this.open())
    return button
  }

  open() {
    const { menu } = this
    playClickSound()
    menu.context.pause()

    const content = document.createElement('div')
    content.className = 'modal-menu'
    const modal = new Modal(content)

    content.appendChild(
      this.createActionButton(t('save'), 'btn-dark', () => {
        menu.context.save()
        modal.close()
        menu.context.resume()
      })
    )
    content.appendChild(this.createLoadControl(modal))
    content.appendChild(
      this.createActionButton(t('quit'), 'btn-dark secondary', () => {
        modal.close()
        menu.context.quit()
      })
    )
    content.appendChild(
      this.createActionButton(t('cancel'), 'btn-dark secondary', () => {
        modal.close()
        menu.context.resume()
      })
    )
  }

  createActionButton(label, className, onClick) {
    const button = document.createElement('button')
    button.className = className
    button.innerText = label
    button.addEventListener('pointerdown', () => {
      playClickSound()
      onClick()
    })
    return button
  }

  createLoadControl(modal) {
    const { menu } = this
    const load = document.createElement('div')
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/JSON'
    input.addEventListener('change', evt => {
      const file = evt.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ({ target: { result } }) => {
        try {
          menu.context.load(parseSaveJSON(result))
          modal.close()
          menu.context.resume()
        } catch (error) {
          menu.showMessage(t('invalidSaveFile'))
          console.error(error)
        } finally {
          input.value = ''
        }
      }
      reader.readAsText(file)
    })
    load.className = 'input-file btn-dark'
    load.innerText = t('load')
    load.addEventListener('pointerdown', playClickSound)
    load.appendChild(input)
    return load
  }
}
