import { minimapMarkerIcon } from './MinimapMarkerIcons'
import { t } from '../../lib/lang'
import { createWorldMapLegend } from '../worldMap/WorldMapLegend'
import type { MacroWorldSettlement } from '../worldMap/WorldMapTypes'
import type { MenuHost } from '../MenuHost'

export function renderMinimapLegend(
  container: HTMLElement,
  menu: MenuHost,
  symbols: HTMLElement,
  filterControls = true
): void {
  container.replaceChildren()
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
    shapes,
    filterControls
  )
  if (legend) container.appendChild(legend)
  container.appendChild(shapes)
}
