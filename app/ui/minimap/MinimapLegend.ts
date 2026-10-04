import { minimapMarkerIcon } from './MinimapMarkerIcons'
import { t } from '../../lib/lang'
import { changeMinimapZoom, getMinimapZoom } from './MinimapZoom'
import { createWorldMapLegend } from '../worldMap/WorldMapLegend'
import type { MacroWorldSettlement } from '../worldMap/WorldMapTypes'
import type { MenuHost } from '../MenuHost'

export function renderMinimapLegend(container: HTMLElement, menu: MenuHost, symbols: HTMLElement): void {
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
    button.dataset.windowLabel = t(label)
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
  const shapes = symbols
  shapes.replaceChildren()
  const title = document.createElement('div')
  title.className = 'worldmap-legend-title'
  title.textContent = t('minimapLegendSymbols')
  shapes.appendChild(title)
  for (const [kind, label] of [
    ['village', 'settlementVillage'],
    ['city', 'settlementCity'],
    ['outpost', 'settlementOutpost'],
    ['camp', 'minimapLegendCamp'],
  ] as const) {
    const row = document.createElement('div')
    row.className = 'worldmap-legend-row minimap-symbol-row'
    const symbol = document.createElement('span')
    symbol.className = 'minimap-symbol'
    const image = document.createElement('img')
    image.src = minimapMarkerIcon(kind)
    image.alt = ''
    symbol.appendChild(image)
    symbol.setAttribute('aria-hidden', 'true')
    const name = document.createElement('span')
    name.className = 'worldmap-legend-name'
    name.textContent = t(label)
    row.append(symbol, name)
    shapes.appendChild(row)
  }
  const legend = createWorldMapLegend(
    menu,
    { settlements: menu.context.map.worldManifest?.settlements as MacroWorldSettlement[] | undefined },
    true,
    shapes
  )
  if (legend) container.appendChild(legend)
}
