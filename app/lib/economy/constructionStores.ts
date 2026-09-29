import { getBaseTerritory } from '../territory/baseTerritory'
import type { ResourceAmount } from '../../types/common'

type Site = { i: number; j: number; spaceId?: string | null }
type Store = Site & {
  type: string
  label?: string
  interiorPortalId?: string
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  inventory?: { resources?: ResourceAmount }
}
type Owner = { label?: string; buildings?: Store[] }

/** Count retrievable depot stock in this settlement; never a remote construction payment. */
export function constructionStores(owner: Owner, site: Site): ResourceAmount[] {
  const territory = getBaseTerritory(site, [owner])
  if (!territory) return []
  const stores = (owner.buildings ?? []).flatMap(store => [
    store,
    ...((store as Store & { interiorBuildings?: Store[] }).interiorBuildings ?? []),
  ])
  const inventories = [...new Set(stores)]
    .filter(
      store =>
        isCommunalResourceStore(store, owner) &&
        communalStoreBuilding(store, owner)?.type !== 'TownCenter' &&
        store.isBuilt !== false &&
        !store.isDead &&
        !store.isDestroyed &&
        getBaseTerritory(store, [owner])?.center === territory.center
    )
    .flatMap(store => (store.inventory?.resources ? [store.inventory.resources] : []))
  return [...new Set(inventories)]
}

/** Resolve synthetic inventory to its exterior depot, including detached save records. */
export function communalStoreBuilding(
  store: Store & { owner?: Owner | null },
  owner: Owner | null | undefined = store.owner
): Store | undefined {
  if (['TownCenter', 'StoragePit', 'Granary'].includes(store.type)) return store
  if (store.type !== 'Chest' || !store.label?.endsWith(':default:storage-chest') || !owner) return undefined
  return (owner.buildings ?? []).find(
    parent =>
      ['TownCenter', 'StoragePit', 'Granary'].includes(parent.type) &&
      parent.isBuilt !== false &&
      !parent.isDead &&
      !parent.isDestroyed &&
      (store.label ===
        `interior:${parent.interiorPortalId || `${owner.label}:${parent.label}`}:default:storage-chest` ||
        store.spaceId === `interior:${parent.interiorPortalId || `${owner.label}:${parent.label}`}` ||
        (parent as Store & { interiorBuildings?: Store[] }).interiorBuildings?.includes(store))
  )
}

/** Legacy town-center stocks remain spendable, but receive no new automatic deliveries. */
export function isCommunalResourceStore(
  store: Store & { owner?: Owner | null },
  owner: Owner | null | undefined = store.owner
): boolean {
  return Boolean(communalStoreBuilding(store, owner))
}
