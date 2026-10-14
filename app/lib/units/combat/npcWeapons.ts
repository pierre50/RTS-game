import { getEquippedWorkTool, workToolFamily } from '../../equipment/workTools'
import { isSlingshot } from '../../equipment/rangedWeapon'
import { Assets } from 'pixi.js'
import defaultEquipment from '../../../../public/assets/data/gameplay/equipment.json'
import { equipmentBaseKey, isEquipmentBroken, withEquipmentDurability } from '../../equipment/equipmentCondition'
import { canReachContact } from '../../contact/contactGeometry'
import type { EquipmentStats } from '../../../types/config'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'

type NpcWeaponUnit = Partial<
  Pick<
    UnitEntity,
    'type' | 'family' | 'inventory' | 'dest' | 'x' | 'y' | 'i' | 'j' | 'spaceId' | 'spriteScale' | 'equipmentDurability'
  >
> & {
  action?: string | null
  controlMode?: string
  owner?: { config?: { equipment?: Record<string, EquipmentStats> } } | null
}
export type NpcWeaponChoice = { kind: 'ranged' | 'melee'; weapon?: string; index: number; range?: number }

export function hasNpcWeaponInventory(unit: Pick<NpcWeaponUnit, 'type' | 'controlMode' | 'inventory'>): boolean {
  return unit.type !== 'Hero' && unit.controlMode !== 'hero' && unit.inventory?.npcWeaponsInitialized === true
}

export function npcWeaponDefinition(item: string, unit?: NpcWeaponUnit): EquipmentStats['weapon'] {
  const definitions =
    unit?.owner?.config?.equipment ??
    (Assets.cache.has('config') ? Assets.cache.get('config')?.equipment : undefined) ??
    defaultEquipment
  return (definitions as Record<string, EquipmentStats>)[equipmentBaseKey(item)]?.weapon
}

export function isNpcWeaponItem(item: string, unit?: NpcWeaponUnit): boolean {
  return !equipmentBaseKey(item).startsWith('arrow_') && Boolean(npcWeaponDefinition(item, unit))
}

/** Carrying an item does not imply the physical ability to fight with it. */
export function canNpcWieldWeapon(unit: NpcWeaponUnit, item: string): boolean {
  if (!isNpcWeaponItem(item, unit)) return false
  if (unit.type !== 'Villager') return true
  const key = equipmentBaseKey(item)
  return (
    /^(axe|pickaxe|hammer|scythe|dagger|club|bow)(_|$)/.test(key) ||
    ['slingshot', 'longstick', 'catchingPole', 'cane'].includes(key)
  )
}

/** Replace the former issued combat axes once, preserving wear and removed weapons. */
function migrateBanditWeapon(unit: UnitEntity): void {
  const replacement = unit.type === 'BanditChief' ? 'mace_bronze' : unit.type === 'BanditSword' ? 'club_ceramic' : null
  if (!replacement || unit.isDead || unit.inventory?.banditWeaponMigrated) return
  unit.inventory ??= {}
  const replace = (item: string) =>
    equipmentBaseKey(item).startsWith('axe_') ? item.replace(/^[^~]+/, replacement) : item
  if (unit.inventory.equipment) unit.inventory.equipment = unit.inventory.equipment.map(replace)
  const melee = unit.inventory.activeWeapons?.melee
  if (melee) unit.inventory.activeWeapons!.melee = replace(melee)
  for (const [key, condition] of Object.entries(unit.equipmentDurability ?? {})) {
    if (!key.startsWith('axe_')) continue
    unit.equipmentDurability![replacement] = Math.min(unit.equipmentDurability![replacement] ?? condition, condition)
    delete unit.equipmentDurability![key]
  }
  unit.inventory.banditWeaponMigrated = true
}

/** Migrate issued weapons once. Thereafter removing a weapon from the bag really removes it. */
export function initializeNpcWeapons(unit: UnitEntity, issued: readonly string[]): void {
  migrateBanditWeapon(unit)
  if (unit.type === 'Hero' || unit.controlMode === 'hero' || unit.isDead || unit.inventory?.npcWeaponsInitialized)
    return
  unit.inventory ??= {}
  const bag = (unit.inventory.equipment ??= [])
  for (const item of issued) {
    if (!isNpcWeaponItem(item, unit) || bag.some(existing => equipmentBaseKey(existing) === equipmentBaseKey(item)))
      continue
    const durability = unit.equipmentDurability?.[equipmentBaseKey(item)]
    bag.push(durability == null ? item : withEquipmentDurability(item, durability))
  }
  unit.inventory.npcWeaponsInitialized = true
}

export function getNpcWeaponChoice(unit: NpcWeaponUnit, target = unit.dest, rangedOnly = false): NpcWeaponChoice {
  if (unit.inventory?.toolsStowed) return { kind: 'melee', index: -1 }
  let melee: NpcWeaponChoice = { kind: 'melee', index: -1 }
  let ranged: NpcWeaponChoice | undefined
  let meleePower = -Infinity
  let rangedPower = -Infinity
  const bag = unit.inventory?.equipment ?? []
  const tool = getEquippedWorkTool(unit)
  const candidates = [...bag.entries(), ...(tool ? [[-2, tool] as [number, string]] : [])]
  for (const [index, item] of candidates) {
    if (index !== -2 && workToolFamily(item)) continue
    // The equipped tool is a fallback after usable combat weapons, regardless of its material.
    if (index === -2 && melee.weapon) continue
    if (!canNpcWieldWeapon(unit, item) || isEquipmentBroken(item)) continue
    const weapon = npcWeaponDefinition(item, unit)!
    if ((equipmentBaseKey(item).startsWith('bow') || isSlingshot(item)) && weapon.range) {
      const hasAmmo = isSlingshot(item)
        ? (unit.inventory?.resources?.stone ?? 0) >= 1
        : bag.some(ammo => equipmentBaseKey(ammo).startsWith('arrow_'))
      if (hasAmmo && (weapon.power ?? 0) > rangedPower) {
        rangedPower = weapon.power ?? 0
        ranged = { kind: 'ranged', weapon: item, index, range: weapon.range }
      }
    } else if (!weapon.range && (weapon.power ?? 0) > meleePower) {
      meleePower = weapon.power ?? 0
      melee = { kind: 'melee', weapon: item, index }
    }
  }
  if (rangedOnly) return ranged ?? { kind: 'ranged', index: -1 }
  if (!ranged || !target || !('family' in target)) return melee
  if (
    unit.action !== 'hunt' &&
    target &&
    'family' in target &&
    Number.isFinite(unit.x) &&
    Number.isFinite(unit.y) &&
    canReachContact(unit as UnitEntity, target as RuntimeEntity, melee.weapon)
  )
    return melee
  return ranged
}

export function getNpcActiveCombatEquipment(unit: NpcWeaponUnit): string[] {
  const choice = getNpcWeaponChoice(unit)
  const active = choice.weapon ? [choice.weapon] : []
  if (choice.kind === 'ranged' && !isSlingshot(choice.weapon)) {
    active.push('quiver')
    const arrow = unit.inventory?.equipment?.find(item => equipmentBaseKey(item).startsWith('arrow_'))
    if (arrow) active.push(arrow)
  }
  return active
}

export function sameNpcWeapon(a: NpcWeaponChoice, b: NpcWeaponChoice): boolean {
  return a.kind === b.kind && equipmentBaseKey(a.weapon ?? '') === equipmentBaseKey(b.weapon ?? '')
}

export function hasUsableNpcRangedWeapon(unit: NpcWeaponUnit): boolean {
  return Boolean(
    unit.inventory?.equipment?.some(
      item =>
        (isSlingshot(item) || equipmentBaseKey(item).startsWith('bow')) &&
        !isEquipmentBroken(item) &&
        npcWeaponDefinition(item, unit)?.range
    )
  )
}
