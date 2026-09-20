# Village starting states

Fresh campaigns can define deterministic village profiles in `GameConfig.villageStarts`, keyed by civilization.
Profiles create ordinary saved buildings, units and physical resource stocks. The normal map restore,
unit placement, daily economy and campaign save paths then take over. Loading or revisiting a saved
world never reapplies a profile or grants its resources again.

```ts
const config = {
  players: [{ civ: 'Xia', isHuman: true }],
  heroStartVillage: 'Hellas',
  villageStarts: {
    Hellas: {
      age: 0,
      buildings: { StoragePit: 1, Granary: 1, Barracks: 1, Market: 1 },
      units: { Villager: 10, Fantassin: 3 },
      resourceBonus: { wood: 500, food: 300, stone: 200 },
    },
  },
}
```

- `heroStartVillage` chooses the host civilization's starting region and puts the hero near its
  TownCenter, without transferring the city to the hero's faction. The host must have a base;
  use a civilization distinct from the human for this hero-only start.
- `age` is the technological age (0-2), independent of building/unit counts.
- Counts are total targets, not additions to the baseline. Existing baseline entities are retained.
  Housing is added automatically to support the resulting population, including trainees.
- `resourceBonus` is added once to actual stores, not directly to player counters.
- `wallRadius` optionally creates available perimeter segments around the TownCenter.
- Required entities that cannot fit cause an explicit initialization error. No partial state is committed.
- Remote AI villages receive their profiles at campaign initialization, before their first visit.
- Legacy `civilizationLevel` remains accepted and maps to these profiles using shared AI targets.
  An explicit profile overrides the legacy level. Existing saved cities are left intact.

Profiles are scenario starting grants, not simulated purchases. They do not advance campaign time or
trigger daily events. The old runtime starting-kit generator has been removed.

## Storage pit construction

Live AI and both offline paths (unvisited regions and saved regions) use
`app/lib/grid/storagePitPlacement.ts`. The caller supplies terrain and occupancy;
the planner owns resource filtering, reachability, footprint clearance, scoring and
deterministic tie-breaking. First arrival restores the simulated buildings rather
than choosing their positions again.

- Consider wood, stone, gold, copper and iron within 35 tiles of the village.
- Ignore depleted/destroyed resources and resources inside another map space.
- Prefer lots serving substantial nearby resources and reducing trips to existing
  TownCenters/storage pits. Resources within 8 tiles of an existing depot already
  have coverage; a new depot must save at least 3 tiles for the resources it serves.
- Never fall back to an empty village-center lot. An unfinished storage pit prevents
  another project. Normal affordability and building caps still apply.
- Villager orders no longer purchase depots. This avoids a second live-only rule,
  including the former misclassification of wheat as a storage-pit resource.
- Material reserves use the same resource/coverage policy. A storage pit is optional
  and does not gate market development.

Explicit starting profiles still prescribe their initial building counts. Their
layout uses the shared resource scoring in required-building mode, while retaining
its courtyard/resource-relocation rules. These profiles are applied once, not again
on subsequent visits. Existing buildings are never moved by this planner.

Offline planning remains daily; live planning uses the normal AI update cadence.

## Starter construction and storage balance

The age-0 solo progression is a hero bag of 50 resources, a craftable camp chest,
then a small base. A chest costs 10 wood and holds 300 resources. It can fund a
TownCenter plus a House together (280), or both dedicated depots (150).

| Building | Age-0 cost | Storage capacity |
| --- | --- | --- |
| House | 40 wood, 10 stone | — |
| TownCenter | 150 wood, 80 stone | 600 |
| StoragePit | 60 wood, 20 stone | 3000 |
| Granary | 50 wood, 20 stone | 2000 |
| Barracks | 120 wood, 40 stone | — |
| Market | 100 wood, 40 stone | — |

Starter buildings require no leather. Later tiers retain fiber and higher costs;
Construction durations are unchanged. The WatchTower costs 60 wood and 120 stone and has 300 HP; the initial Temple requires no leather. Capacity is shared across resource
types, not per resource. Interior chests inherit the parent building's capacity,
using the same policy as offline deliveries and regional storage alerts. The
TownCenter accommodates the standard initial grant of 550 resources. A custom
starting profile granting additional materials should provide adequate depots.
Existing over-capacity inventories are preserved; further deposits wait for space.


## Camp chests and villager deliveries

Live and offline AI use the same camp-chest placement and payment helper. A camp
without a nearby compatible depot can build a 10-wood chest near reachable work
resources. At most two outdoor camp chests are allowed per village; a full or
manually blocked nearby chest does not trigger a replacement. Permanent depots
remain the normal development priority, and a chest can anchor a storage-pit
project before a TownCenter exists.

Without a depot, workers can gather into their bags up to their carrying limit.
For this bootstrap craft only, the AI can pay from stored wood and villager bags.
Bag resources do not become general construction funds. Offline gathering debits
actual resource nodes; creating the chest debits exactly 10 wood only on success.
The shared rules apply on first arrival and on return; offline planning still runs
daily rather than at the live update cadence.

Owned outdoor chests expose a saved villager-delivery toggle, allowed by default.
Blocking deliveries excludes them from automatic live and offline deposits. Manual
transfers and spending their contents remain available. The TownCenter's interior
chest is retained. Hero-crafted chests are paid during crafting, not again on placement.
