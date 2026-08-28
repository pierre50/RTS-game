import type { MinimapPlayerCanvas } from '../../types/ui'
import type { MenuHost } from '../MenuHost'

export class MinimapView {
  menu: MenuHost
  wrap: HTMLDivElement
  element: HTMLDivElement
  terrain?: HTMLCanvasElement
  players: MinimapPlayerCanvas[]
  resources?: HTMLCanvasElement
  camera?: HTMLCanvasElement

  constructor(menu: MenuHost) {
    this.menu = menu
    this.wrap = document.createElement('div')
    this.wrap.className = 'minimap-wrap'
    this.element = document.createElement('div')
    this.element.className = 'minimap-map'
    this.wrap.appendChild(this.element)

    this.players = []
  }

  ensureCanvases(): { terrain: HTMLCanvasElement; resources: HTMLCanvasElement; camera: HTMLCanvasElement } {
    if (!this.terrain) {
      this.terrain = document.createElement('canvas')
      this.element.appendChild(this.terrain)
    }

    if (!this.resources) {
      this.resources = document.createElement('canvas')
      this.element.appendChild(this.resources)
    }

    if (!this.camera) {
      this.camera = document.createElement('canvas')
      this.camera.classList.add('minimap-camera')
      this.element.appendChild(this.camera)
    }

    return { terrain: this.terrain, resources: this.resources, camera: this.camera }
  }

  releaseCanvases(): void {
    this.terrain?.remove()
    this.resources?.remove()
    this.camera?.remove()
    this.players.forEach(({ canvas }) => canvas.remove())
    this.terrain = undefined
    this.resources = undefined
    this.camera = undefined
    this.players = []
  }

  destroy(): void {
    this.releaseCanvases()
    this.wrap.remove()
  }
}
