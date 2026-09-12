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
