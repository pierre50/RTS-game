# Final map files

## Settlement preparation (second pass)

Terrain generation and settlement preparation are separate commands:

```sh
pnpm world:generate-1000
pnpm world:prepare public/maps/worlds/world-test-1000
pnpm world:prepare public/maps/worlds/world-test-1000 --check
```

Continent generation fixes each civilization's composition to three outposts,
two villages and one city. Sites are assigned to civilizations offline and stay
at least 72 cells apart. The second pass uses each site's explicit profile.
Villages use their granary as the settlement anchor and contain no TownCenter;
TownCenters are reserved for cities, while outposts use a FireCamp.
At new-game loading, the chosen human civilization's six bases and authored wheat
fields are omitted: only its hero is instantiated. The seven AI civilizations
therefore have 42 settlements, with separate owners sharing civilization faction
and color. Prepared games always use the hero-only start and have no size selector.

`tools/prepare-world-settlements.cjs` also accepts one finalized `.map` file.
`--out <directory>` writes preparations elsewhere. `--check` regenerates in memory
and fails if an output is missing or differs; it never rewrites files. Invalid
terrain, blocked entrances, overlapping entities, missing bandit caves and excessive
depot stocks fail before publishing that map's output. Each output is replaced
atomically. The world manifest registers their checksums. Source maps, terrain
and existing game saves are untouched.

The second pass reuses the shared civilization assignment, settlement profiles,
village placement and bandit decoration/loot rules. It writes a deterministic
`<map-name>.settlements.json` file with:

- `format: "prepared-settlements"`, `version: 1`, map ID and final grid size;
- `source.sha256` of the exact source map and `source.rulesSha256` of generation
  code and configuration, so outdated preparations can be detected;
- `settlements`, linking each site/civilization/profile to its prepared owner
  and `resourceLabels` identifying its authored wheat fields;
- `players`, containing exact building/unit positions, stable labels and depot inventories;
- `banditCamps`, with fixed rosters, patrol anchors and outdoor chest loot or
  `caveContent` linking loot to an existing cave (interior furnishing remains a separate concern);
- the **complete replacement** `resources` and `animals` arrays. Village placement
  can relocate resources and add wheat; these arrays must not be appended to the
  original blueprint's resources;
- `heroSpawns`, free connected starting positions for each civilization;
- a validated count summary.

Agriculture uses four 3×3 wheat patches per village and eight per city. Each patch
starts with one to four young crops at frame zero, randomly scattered across its
nine cells; the remaining crops use the loaded sprite's final frame. Fields leave a circulation margin around building entrances. The variation
is seeded so repeated preparation stays deterministic. Outposts have no authored wheat fields.

All prepared units start idle, without saved movement orders or autonomous jobs.
After the final building layout, `distribute-settlement-units.cjs` spreads civilians
around homes and amenities, the first RPG workers near their authored fields, and
soldiers around defensive/military buildings. Chiefs stay near the center. Positions
are connected, within 30 cells of the base, leave a one-cell clearance around
building footprints, avoid entrances and their immediate
approaches, and prefer a two-cell gap between inhabitants. This runs offline only;
new games restore these positions and existing saves retain their own positions.
Population sizes still come from `app/config/settlementProfiles.ts`.

New games consume the sidecar registered by the world-directory command in
`manifest.json`. Loading verifies the source and sidecar checksums and the rules
identifier recorded in the manifest. Use `--check` to compare against current
generation code. Continent new games require a preparation; stale or unavailable
files fail explicitly, without falling back to live generation.

Preparation places wildlife after AI buildings, fields and inhabitants. The original
blueprint population is preserved, and animals cannot affect settlement layouts.
Settlement exclusion areas follow the actual buildings and fields, with two cells
of clearance. Affected groups move together; old blueprints without herd IDs use
compact same-species groups inferred from the shared generation radius and size.
Placement prefers the original habitat, then another allowed habitat, within 128
cells. Destinations must offer at least 96 connected walkable cells and a route
12 cells away, accounting for cliffs, buildings, resources and settlement areas.
Cave and camp clearings remain reserved. Preparation fails without dropping animals
if no compatible destination fits the whole group.

Existing stables receive a seeded random stock of tamed horses: 1–2 in outposts,
1–3 in villages, and 3–5 in cities. No stable is added to a profile that lacks one.
Rerun `world:prepare` to update an existing world's preparation.

Prepared starts restore exact buildings, units, chests, wildlife and resources;
they bypass live village/camp generation and initial resource relocation. Hero
positions are reserved by the offline pass. The scripted player introduction
(campfire and companion) remains a separate gameplay step.
Saved games restore their own state and keep the original terrain resource
baseline for resource deltas; they do not fetch or reapply initial preparations.
Worlds without registered preparations retain their legacy loading path, except
continents which require preparation. `--out` and single-file commands produce
standalone files without registering them in a world manifest.

## Terrain generation

`blueprint.cjs` generates the source terrain and resources, then `local-blueprint.cjs`
prepares the final local grid before writing the file. This final step converts
coordinates, normalizes water topology, protects the five-cell coast buffer and
starting areas, resolves relief transitions, and excludes resources on water,
shoreline borders or slopes.

World blueprint version 2 stores the final grid:

- `sourceSize` is the logical region size used in the manifest and output path.
- `size` is the final grid bound; `localGridLayout` defines its occupied footprint.
- Base64 terrain uses byte `255` for unoccupied cells; relief uses signed bytes.
- Resources, spawns, camps and settlement locals use final grid coordinates.

The game decodes these layers and renders their borders; it does not normalize
water or relief on load. Version 1 files remain readable through the legacy
coordinate conversion, without terrain correction. Existing saved games retain
their recorded terrain rather than receiving an implicit migration.

To finalize older generated world files without regenerating seeds or settlements:

```sh
node tools/finalize-world-maps.cjs public/maps/worlds/world-4242
```

Finalized terrain stays intact; missing prepared content and scenery files are added.

## Prepared content

The generator also stores initial wildlife and packed border appearances. Wildlife
uses the shared habitat/group rules and a dedicated seed. Loading only checks that
each planned animal cell is still available after villages/camps are instantiated.
An empty animal list is authoritative; saved populations are restored normally.

`terrainAppearanceData` packs each affected cell in nine bytes: grid index (u32 LE),
water frame + 1, relief frame + 1, half-step elevation, direction bitmask and ground
index. Frames/ground zero mean absent. The game applies these records once; editing
terrain later can still rebuild its appearance normally.

Each world manifest also points to a `.scenery.json` sidecar. These contain only a
1024-pixel border strip, its resource descriptions and prepared borders. Cell data
uses six-byte records (u32 LE grid index, terrain byte, signed relief byte). Neighbor
views load these instead of full region files, through the existing session cache.

Run the finalizer with `--refresh-content` after changing wildlife or border rules.
This refresh preserves the final terrain and settlements. Resource textures are
chosen before lazy visual creation, so visibility does not consume random choices.
Static resource sprites/shadows are created on first display/use; animated growing
resources retain their normal lifecycle. Wind subscriptions follow render visibility.

## Prepared settlement roads

`world:prepare` writes a `roads` section in the settlements sidecar. It fixes
settlement anchors and shared squares first, then plans roads through these squares
before placing secondary buildings and fields. It connects city and village entrance cells;
outposts and bandit camps are not destinations. The game bakes the supplied path sprites into its terrain textures, including
streamed tiles. New saves store the compact layer in `world.roads`; restoration
uses that snapshot without fetching or reapplying settlement preparations. Older
saves without that field retain their original road-free state. The minimap draws roads beneath markers, respects explored cells and zoom, and
never displays the outdoor network in interiors.

The deterministic planner joins nearby settlements with a spanning network in
each reachable land component. Four-neighbor A* avoids all resource cells,
building footprints, authored crop rectangles, water and shoreline cells. Height
changes above one level are forbidden; legal slopes are penalized. A five-cell
soft tree margin encourages forest detours without blocking narrow passages.
Jungle/dark forest terrain costs more, and existing roads cost less so routes can
share sections. Searches try local corridors before falling back to the full map.
No resources or buildings are removed. Disconnected islands are reported as
separate `roads.components`; no bridges or artificial connections are invented.
The network uses distance-ordered candidate links, not a globally optimal road
length or a direct road for every pair of settlements.

Road version 1 stores `stride`, entrance `anchors`, `routes` with cell indices,
and unique `cells` as `[gridIndex, connections]`. `gridIndex = i * stride + j`;
connection bits are NE=1 (`j-1`), SE=2 (`i+1`), SW=4 (`j+1`), NW=8 (`i-1`).
Only traversed edges contribute to junction masks. The source seed, terrain and
settlement cores determine the network; road generation consumes no live RNG.

Generate and inspect the current continent:

```sh
pnpm world:prepare public/maps/worlds/world-test-1000
pnpm world:prepare public/maps/worlds/world-test-1000 --check
python3 tools/maps/preview-roads.py public/maps/worlds/world-test-1000/maps/world-test-1000-r0-0.map
```

The preview requires Pillow and a packed version-2 continent map with its prepared
sidecar. It writes `reports/roads/roads-overview.png` and `roads-details.png` from
the actual generated data. These are planning views, not screenshots of gameplay.


### Districts and defenses around prepared roads

After planning the network, road cells and a one-cell margin are protected from
buildings, fields, perimeter walls and relocated resource nodes. This is a placement
reservation, not an obstacle to walking. Required tower lots are reserved before
housing; the real towers are installed after the other buildings. Their placement
uses the configured attack range, prioritizes different road approaches at the
village outskirts, and discourages clustered towers. When there is no usable road
approach, the existing peripheral placement remains the fallback. Tower counts
still come from settlement profiles; outposts gain no artificial road links.

Markets favor the central square and roads. Military buildings favor the inside
of a road approach. Houses and forges have a softer road preference, while granaries,
fields and resource depots retain their agricultural/resource priorities. Idle
inhabitants are distributed off the road after all buildings are finished.

The final validation checks settlement access, all occupied footprints, continuous
walkable road edges and reciprocal atlas connections. The preparation CLI includes
these rules in its content hash. Existing saves are not rebuilt or relocated.

Preview real footprints and tower coverage without running the game:

```sh
python3 tools/maps/preview-settlement-defenses.py public/maps/worlds/world-test-1000/maps/world-test-1000-r0-0.map --prepared /tmp/rts-road-planning/world-test-1000-r0-0.settlements.json --out reports/roads/settlement-defenses.png
```
