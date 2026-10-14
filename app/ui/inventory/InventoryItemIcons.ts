import { equipmentBaseKey, equipmentWithoutCondition } from '../../lib/equipment/equipmentCondition'
import { migrateEquipmentMaterial } from '../../lib/equipment/equipmentMaterials'
import { RESOURCE_ICON_IDS } from '../../constants'
import { getIconPath } from '../../lib'
import { renderBuildingAvatar } from '../../lib/avatar'
import { renderEquipmentAvatarLazy } from '../equipment/EquipmentAvatar'
import type { ResourceAmount } from '../../types/common'
import type { GameContextLike } from '../../types/context'

const ARROW_ICON_KEYS = new Set(['arrow_ceramic', 'arrow_bronze', 'arrow_iron'])

const TOOL_ICON_KEYS = new Set([
  'axe_ceramic',
  'axe_bronze',
  'axe_iron',
  'pickaxe_ceramic',
  'pickaxe_bronze',
  'pickaxe_iron',
  'hammer_ceramic',
  'hammer_bronze',
  'hammer_iron',
  'scythe_ceramic',
  'scythe_bronze',
  'scythe_iron',
  'longstick',
  'catchingPole',
])
const RANGED_WEAPON_ICON_KEYS = new Set(['bow', 'bow_great', 'bow_recurve', 'slingshot'])
const MELEE_WEAPON_ICON_KEYS = new Set([
  'club_ceramic',
  'dagger_bronze',
  'dagger_iron',
  'spear_ceramic',
  'spear_bronze',
  'spear_iron',
  'mace_bronze',
  'mace_iron',
  'sword_bronze',
  'sword_iron',
  'sword_curved_bronze',
  'sword_curved_iron',
])
const SHIELD_ICON_KEYS = new Set(['round_shield_wood_slash', 'round_shield_bronze_slash', 'round_shield_iron_slash'])
const ARMOR_ICON_KEYS = new Set([
  'armor_leather',
  'armor_mail_iron',
  'armor_legion_bronze',
  'armor_legion_iron',
  'helmet_pointed_leather',
  'helmet_barbarian_leather',
  'helmet_barbarian_nasal_leather',
  'helmet_pointed_bronze',
  'helmet_pointed_iron',
  'helmet_barbuta_bronze',
  'helmet_barbuta_iron',
  'helmet_legion_bronze',
  'helmet_legion_iron',
  'helmet_nasal_bronze',
  'helmet_nasal_iron',
  'helmet_bascinet_round_bronze',
  'helmet_bascinet_round_iron',
  'helmet_norman_bronze',
  'helmet_norman_iron',
  'sack_cloth_hood_leather',
  'shoulder_legion_leather',
  'shoulder_legion_bronze',
  'shoulder_legion_iron',
  'bracers_leather',
  'bracers_bronze',
  'bracers_iron',
  'leg_armor_leather',
  'leg_armor_bronze',
  'leg_armor_iron',
])
const HELMET_DECOR_ICON_KEYS = new Set([
  'centurion_crest',
  'legion_plumage',
  'plumage',
  'helmet_wings',
  'upward_horns_white',
  'horns_short',
])
const PAIRED_DECOR_INSET: Record<string, number> = {
  helmet_wings: 10,
  upward_horns_white: 14,
  horns_short: 6,
} // Pixels per side on the 128px icon canvas, shared by every helmet.
const COMPOSITE_HELMET_ICON_KEYS = new Set([
  'helmet_pointed_leather',
  'helmet_barbarian_leather',
  'helmet_barbarian_nasal_leather',
  ...['pointed', 'barbuta', 'legion', 'nasal', 'bascinet_round', 'norman'].flatMap(model =>
    ['bronze', 'iron'].map(material => `helmet_${model}_${material}`)
  ),
])

export function getInventoryEquipmentImagePath(item: string): string | null {
  const [base, decorated] = item.split('~decor:')
  if (decorated && base?.startsWith('helmet_')) {
    const parts = decorated.split('+')
    if (!COMPOSITE_HELMET_ICON_KEYS.has(base) || !parts.every(part => HELMET_DECOR_ICON_KEYS.has(part))) return null
    return `assets/icons/armor/${base}.png`
  }
  if (TOOL_ICON_KEYS.has(item)) return `assets/icons/tools/${item}.png`
  if (RANGED_WEAPON_ICON_KEYS.has(item)) return `assets/icons/ranged-weapons/${item}.png`
  if (MELEE_WEAPON_ICON_KEYS.has(item)) return `assets/icons/melee-weapons/${item}.png`
  if (SHIELD_ICON_KEYS.has(item)) return `assets/icons/shields/${item}.png`
  if (ARMOR_ICON_KEYS.has(item)) return `assets/icons/armor/${item}.png`
  return null
}

export function renderInventoryEquipmentImage(canvas: HTMLCanvasElement, item: string): boolean {
  const visual = migrateEquipmentMaterial(equipmentWithoutCondition(item))
  const path = getInventoryEquipmentImagePath(visual)
  if (!path) return false
  canvas.dataset.toolIcon = item
  const decorations = visual.split('~decor:')[1]?.split('+') ?? []
  const sources = [path, ...decorations.map(decor => `assets/icons/helmet-decorations/${decor}.png`)]
  const images = sources.map(src => {
    const image = new Image()
    image.src = src
    return image
  })
  const draw = () => {
    if (canvas.dataset.toolIcon !== item) return
    if (!images.every(image => image.complete && image.naturalWidth > 0)) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = false
    if (!decorations.length) {
      context.drawImage(images[0]!, 0, 0, canvas.width, canvas.height)
      return
    }
    const drawDecoration = (decor: string, index: number) => {
      const image = images[index + 1]!
      if (!Object.hasOwn(PAIRED_DECOR_INSET, decor)) {
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        return
      }
      const sourceHalf = image.naturalWidth / 2
      const targetHalf = canvas.width / 2
      const inset = (canvas.width * PAIRED_DECOR_INSET[decor]!) / 128
      const offsetY = decor === 'horns_short' ? (canvas.height * 4) / 128 : 0
      context.drawImage(image, 0, 0, sourceHalf, image.naturalHeight, inset, offsetY, targetHalf, canvas.height)
      context.drawImage(image, sourceHalf, 0, sourceHalf, image.naturalHeight, targetHalf - inset, offsetY, targetHalf, canvas.height)
    }
    decorations.forEach((decor, index) => {
      if (decor === 'centurion_crest' || decor === 'upward_horns_white' || decor === 'horns_short') {
        drawDecoration(decor, index)
      }
    })
    context.drawImage(
      images[0]!,
      (canvas.width * 23) / 128,
      (canvas.height * 41) / 128,
      (canvas.width * 82) / 128,
      (canvas.height * 82) / 128
    )
    decorations.forEach((decor, index) => {
      if (decor !== 'centurion_crest' && decor !== 'upward_horns_white' && decor !== 'horns_short') {
        drawDecoration(decor, index)
      }
    })
  }
  images.forEach(image => {
    image.onload = draw
  })
  draw()
  return true
}

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

function createInventoryImageIcon(src: string): HTMLImageElement {
  const icon = document.createElement('img')
  icon.className = 'img'
  icon.src = src
  icon.alt = ''
  return icon
}

export function createInventorySlingshotStoneIcon(): HTMLImageElement {
  return createInventoryImageIcon('assets/icons/ammunition/slingshot_stone.png')
}

export function createInventoryEquipmentIcon(context: GameContextLike, item: string, label: string): HTMLElement {
  const baseItem = equipmentBaseKey(item)
  if (baseItem === 'arrow_copper') return createInventoryImageIcon('assets/icons/ammunition/arrow_ceramic.png')
  if (ARROW_ICON_KEYS.has(baseItem)) return createInventoryImageIcon(`assets/icons/ammunition/${baseItem}.png`)
  const equipmentImagePath = getInventoryEquipmentImagePath(migrateEquipmentMaterial(equipmentWithoutCondition(item)))
  if (equipmentImagePath) {
    if (!equipmentWithoutCondition(item).includes('~decor:')) return createInventoryImageIcon(equipmentImagePath)
    const icon = document.createElement('canvas')
    icon.className = 'img'
    icon.width = 128
    icon.height = 128
    renderInventoryEquipmentImage(icon, item)
    return icon
  }

  const icon = document.createElement('canvas')
  icon.className = 'img'
  icon.width = 64
  icon.height = 64
  renderEquipmentAvatarLazy(context.app, item, icon, label, context.performance)
  return icon
}
