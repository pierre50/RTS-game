import { RESOURCE_ICON_IDS } from '../../constants'
import { getIconPath } from '../../lib'
import { renderBuildingAvatar } from '../../lib/avatar'
import { renderEquipmentAvatarLazy } from '../equipment/EquipmentAvatar'
import type { ResourceAmount } from '../../types/common'
import type { GameContextLike } from '../../types/context'

const ARROW_PROJECTILE_FRAMES: Record<string, number> = {
  arrow_ceramic: 0,
  arrow_copper: 32,
  arrow_bronze: 64,
  arrow_iron: 96,
}
const ARROW_PROJECTILE_SHEET_WIDTH = 127
const ARROW_PROJECTILE_SHEET_HEIGHT = 5
const ARROW_PROJECTILE_FRAME_SCALE = 1.65

const TOOL_ICON_FAMILIES = {
  axe: 'assets/graphics/equipments/weapon/axe/texture.png',
  hammer: 'assets/graphics/equipments/tool/hammer/texture.png',
  pickaxe: 'assets/graphics/equipments/tool/pickaxe/texture.png',
} as const
const TOOL_ICON_SHEET_WIDTH = 4089
const TOOL_ICON_SHEET_HEIGHT = 2128
const TOOL_ICON_FRAME_BY_MATERIAL: Record<string, { x: number; y: number }> = {
  bronze: { x: 3741, y: 0 },
  ceramic: { x: 3806, y: 516 },
  copper: { x: 3806, y: 1032 },
  iron: { x: 3806, y: 1548 },
}
const TOOL_ICON_FRAME_SCALE = 2.05
const TOOL_ICON_FRAME_CENTER = 28
const TOOL_ICON_VISIBLE_CENTER = { x: 52, y: 60 }

export function createInventoryResourceIcon(resource: keyof ResourceAmount): HTMLImageElement {
  const icon = document.createElement('img')
  icon.className = 'img inventory-resource-icon'
  icon.src = getIconPath(RESOURCE_ICON_IDS[resource].commodity)
  icon.alt = ''
  return icon
}

export function createInventoryBuildingIcon(context: GameContextLike, type: string): HTMLImageElement {
  const icon = document.createElement('img')
  icon.className = 'img'
  icon.alt = ''
  const canvas = document.createElement('canvas')
  canvas.width = 120
  canvas.height = 120
  if (renderBuildingAvatar(context.app, type, context.player, canvas)) {
    icon.src = canvas.toDataURL()
  }
  return icon
}

type InventorySpriteIconOptions = {
  className: string
  frameScale: number
  frameX: number
  frameY: number
  offsetX?: number
  offsetY?: number
  sheetHeight: number
  sheetWidth: number
  src: string
  verticalAlign?: 'center'
}

function createInventorySpriteIcon({
  className,
  frameScale,
  frameX,
  frameY,
  offsetX = 0,
  offsetY = 0,
  sheetHeight,
  sheetWidth,
  src,
  verticalAlign,
}: InventorySpriteIconOptions): HTMLSpanElement {
  const icon = document.createElement('span')
  icon.className = `img ${className}`

  const sprite = document.createElement('img')
  sprite.className = 'inventory-sprite-icon-image'
  sprite.src = src
  sprite.alt = ''
  sprite.style.width = `${sheetWidth * frameScale}px`
  sprite.style.height = `${sheetHeight * frameScale}px`
  sprite.style.transform =
    verticalAlign === 'center'
      ? `translate(${-frameX * frameScale + offsetX}px, -50%)`
      : `translate(${-frameX * frameScale + offsetX}px, ${-frameY * frameScale + offsetY}px)`
  icon.appendChild(sprite)
  return icon
}

function createInventoryArrowIcon(item: string): HTMLSpanElement {
  return createInventorySpriteIcon({
    className: 'inventory-arrow-icon',
    frameScale: ARROW_PROJECTILE_FRAME_SCALE,
    frameX: ARROW_PROJECTILE_FRAMES[item] ?? ARROW_PROJECTILE_FRAMES.arrow_ceramic,
    frameY: 0,
    sheetHeight: ARROW_PROJECTILE_SHEET_HEIGHT,
    sheetWidth: ARROW_PROJECTILE_SHEET_WIDTH,
    src: 'assets/graphics/projectiles/texture.png',
    verticalAlign: 'center',
  })
}

function createInventoryToolIcon(item: string): HTMLSpanElement | null {
  const [family, material = 'ceramic'] = item.split('_')
  const src = TOOL_ICON_FAMILIES[family as keyof typeof TOOL_ICON_FAMILIES]
  if (!src) return null
  const frame = TOOL_ICON_FRAME_BY_MATERIAL[material] ?? TOOL_ICON_FRAME_BY_MATERIAL.ceramic

  return createInventorySpriteIcon({
    className: 'inventory-tool-icon',
    frameScale: TOOL_ICON_FRAME_SCALE,
    frameX: frame.x,
    frameY: frame.y,
    offsetX: TOOL_ICON_FRAME_CENTER - TOOL_ICON_VISIBLE_CENTER.x * TOOL_ICON_FRAME_SCALE,
    offsetY: TOOL_ICON_FRAME_CENTER - TOOL_ICON_VISIBLE_CENTER.y * TOOL_ICON_FRAME_SCALE,
    sheetHeight: TOOL_ICON_SHEET_HEIGHT,
    sheetWidth: TOOL_ICON_SHEET_WIDTH,
    src,
  })
}

export function createInventoryEquipmentIcon(context: GameContextLike, item: string, label: string): HTMLElement {
  if (item.startsWith('arrow_')) return createInventoryArrowIcon(item)
  const toolIcon = createInventoryToolIcon(item)
  if (toolIcon) return toolIcon

  const icon = document.createElement('canvas')
  icon.className = 'img'
  icon.width = 64
  icon.height = 64
  renderEquipmentAvatarLazy(context.app, item, icon, label, context.performance)
  return icon
}
