import {
  firstConstructionRow,
  getWindowNavigationPoint,
  hasSteppableWindowField,
  preferActiveWindowTab,
} from './GameWindowElements'
import { adjustWindowField } from './GameWindowForms'
import { getWindowInteraction } from './GameWindowInteraction'
import { findDirectionalTarget } from './GameWindowNavigation'
import { scrollWindowInformation } from './GameWindowScroll'
import { getVariantRow } from './VariantRow'

export interface WindowMoveContext {
  panel: HTMLElement
  selected: HTMLElement | null
  items: () => HTMLElement[]
  select: (element: HTMLElement | null, focus: boolean) => void
  scheduleRefresh: () => void
}

/** Steps the in-place control under the selection; returns false when the move should navigate instead. */
function stepSelectedControl(context: WindowMoveContext, dx: number, dy: number): boolean {
  const interaction = getWindowInteraction(context.panel)
  if (interaction) {
    interaction.move(dx, dy)
    return true
  }
  if (!dx) return false
  const variant = getVariantRow(context.selected)
  if (variant) {
    variant.step(dx)
    return true
  }
  if (!hasSteppableWindowField(context.selected)) return false
  adjustWindowField(context.selected, dx)
  return true
}

function findDirectionalItem(items: HTMLElement[], selected: HTMLElement | null, dx: number, dy: number) {
  const index = findDirectionalTarget(
    items.map(item => getWindowNavigationPoint(item, Boolean(dy))),
    items.indexOf(selected as HTMLElement),
    dx,
    dy
  )
  const next: HTMLElement | null = items[index] ?? null
  return dy < 0 ? preferActiveWindowTab(items, next, selected) : next
}

export function moveWindowSelection(context: WindowMoveContext, dx: number, dy: number): void {
  if (stepSelectedControl(context, dx, dy)) {
    context.scheduleRefresh()
    return
  }
  const { selected } = context
  const items = context.items()
  if (!items.length && dy) {
    scrollWindowInformation(context.panel, dy * 48, selected)
    return
  }
  // Enter construction in reading order, independent of the tab's horizontal
  // position or the catalogue's previous scroll position.
  const firstConstruction = firstConstructionRow(items, selected, dy)
  if (firstConstruction) {
    context.select(firstConstruction, true)
    return
  }
  const next = findDirectionalItem(items, selected, dx, dy)
  if (dx && selected?.matches('.ui-tab') && next?.matches('.ui-tab')) next.click()
  context.select(next, true)
}
