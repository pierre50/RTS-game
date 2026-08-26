import type { MinimapPlayerCanvas } from '../../types/ui'
import type { MenuHost } from '../MenuHost'

export class MinimapView {
  menu: MenuHost
  wrap: HTMLDivElement
  element: HTMLDivElement
  terrain: HTMLCanvasElement
  players: MinimapPlayerCanvas[]
  resources: HTMLCanvasElement
  camera: HTMLCanvasElement

  constructor(menu: MenuHost) {
    this.menu = menu
    this.wrap = document.createElement('div')
    this.wrap.className = 'minimap-wrap'
    this.element = document.createElement('div')
    this.element.className = 'minimap-map'
    this.wrap.appendChild(this.element)

    this.terrain = document.createElement('canvas')
    this.players = []
    this.resources = document.createElement('canvas')
    this.camera = document.createElement('canvas')
    this.camera.classList.add('minimap-camera')

    this.element.appendChild(this.terrain)
    this.element.appendChild(this.resources)
    this.element.appendChild(this.camera)
  }

  destroy(): void {
    this.wrap.remove()
  }
}
