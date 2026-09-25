import { t } from '../../lib/lang'
import { changeMinimapZoom, getMinimapZoom } from './MinimapZoom'
import { createWorldMapLegend } from '../worldMap/WorldMapLegend'
import type { MacroWorldSettlement } from '../worldMap/WorldMapTypes'
import type { MenuHost } from '../MenuHost'

export function renderMinimapLegend(container: HTMLElement, menu: MenuHost): void {
  container.replaceChildren()
  const toolbar = document.createElement('div')
  toolbar.className = 'minimap-zoom-controls'
  const less = document.createElement('button')
  const more = document.createElement('button')
  const value = document.createElement('span')
  value.setAttribute('aria-live', 'polite')
  const sync = () => {
    const zoom = getMinimapZoom(menu.context)
    value.textContent = `${Math.round(zoom * 100)} %`
    less.disabled = zoom <= 1
    more.disabled = zoom >= 4
  }
  for (const [button, direction, label] of [
    [less, -1, 'minimapZoomOut'],
    [more, 1, 'minimapZoomIn'],
  ] as const) {
    button.type = 'button'
    button.className = 'ui-btn'
    button.textContent = direction === 1 ? '+' : '−'
    button.title = t(label)
    button.setAttribute('aria-label', t(label))
    button.addEventListener('click', () => {
      changeMinimapZoom(menu.context, direction)
      sync()
      menu.activateMiniMap()
    })
  }
  sync()
  toolbar.append(less, value, more)
  container.appendChild(toolbar)
  const legend = createWorldMapLegend(
    menu,
    {
      settlements: menu.context.map.worldManifest?.settlements as MacroWorldSettlement[] | undefined,
    },
    true
  )
  if (legend) container.appendChild(legend)
  const shapes = document.createElement('div')
  shapes.className = 'minimap-shape-legend'
  shapes.textContent = t('minimapMarkerShapes')
  container.appendChild(shapes)
}
