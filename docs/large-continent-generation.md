# Continuous continent generation

`pnpm world:generate-1000` rebuilds `world-test-1000`, available in the
new-game map selector. `pnpm world:generate-5000` can generate the larger world
locally, but its output is ignored by Git and it is not listed in the menu. `pnpm world:generate-large` remains the configurable
generator (5000 by default). This is an **offline authoring step**;
starting a game loads its generated blueprint and does not regenerate its biomes.

Options:

```
pnpm world:generate-1000
pnpm world:generate-5000
pnpm world:generate-large --size 1000 --seed 5000
pnpm world:generate-large --size 512 --seed 5000 --out /tmp/rts-continent-512
```

`--land-mask` defaults to `public/maps/world-masks/continent-001.png`.
`--biomes` defaults to `blackforest,desert,temperate,steppe` and accepts a subset.
The default seed is 5000 for both sizes, so both use the same template and biome
field at their respective resolutions. Cave and camp densities remain land-area
based; they are not fixed counts copied from the large map.
Python 3 with Pillow is required, as for normal world generation.

## Shared world rules

`tools/maps/large-mask.py` imports `tools/generate-macro-world.py` and calls its
macro terrain generator. Coast cleanup, lakes, climate scores, biome sectors and
transition noise therefore come from the same implementation as regional worlds.
The normal 720 × 720 macro field is expanded to the requested local layout with
nearest-neighbor sampling, preserving biome codes and contiguous sectors. It is
then projected to the game's grid. Steppe and temperate both use Grass terrain,
as in normal worlds; their forest profiles and animal choices remain distinct.
The biome preview preserves their distinct colors.

After projection, `tools/maps/large-coast.cjs` repairs coast configurations that
the shoreline atlas cannot represent. It fills the fewest adjacent water cells
for each invalid configuration, borrowing the repairing land cell's terrain and
biome. A global neighbour frontier runs until every coast is supported, including
across content patch boundaries. This preserves existing land and never fills
void cells; an impossible playable-boundary configuration fails generation.
The cleanup runs before villages, caves, camps, resources and appearances, and
updates land/biome counts. Generation version 4 records its statistics in
`generation.coastCleanup`. The preview remains the macro biome overview.
Previously generated maps need rebuilding to receive this correction.

`tools/maps/large-content.cjs` generates 144-cell cores with a 24-cell overlap.
It uses the existing neutral-resource, biome-tree and ambient-animal generators.
The dominant biome of each core selects environment density multipliers. Tree
families and forest probabilities use each cell's macro biome, with global noise
coordinates across cores. Animal selection also receives the cell biome, including
Steppe. Prepared appearances include shorelines and biome transitions.

Each core retains only its own entities and appearances, so the partition adds
no gameplay boundaries. Resource group spacing remains local to generation patches,
not a globally solved spacing constraint. Generation version 6 adds continuous
signed relief before resource and appearance preparation. It shares the original
relief noise and quantile bands, with each cell's biome selecting the existing
`ENVIRONMENT_TERRAIN_PARAMS.reliefAmplitude`: Temperate, BlackForest and Jungle
use 1, Desert uses 0.3, and Steppe uses 0.65. Quantiles are computed per biome;
noise uses global grid coordinates at the original 144-cell region scale.
Packed global buffers and a monotonic topology repair keep slopes continuous
across biome and content-patch boundaries without a continent-sized object grid.
Water and void remain at zero, with a five-cell coast buffer. Settlement sites
reserve a 32-cell flat radius, caves eight cells, camps ten cells, and cave–camp
paths are protected. Resources and wildlife use the final signed elevations and
avoid slope tiles. This generator also authors small bandit camps and cave-linked lairs. Generation version 5 reserves eight anonymous village sites, distributed across
biomes using the preferences in `app/config/civilizationPlacement.json`. The old
macro generator reads the same preferences. Sites have a safe 20-cell land margin
and stay at least 100 cells apart; caves, camps and resources respect their clearings.

At new-game startup, `assignContinentVillages` assigns the complete civilization roster
to these sites. It maximizes biome suitability jointly, then uses geographic preferences
to distinguish equally suitable sites. The chosen human civilization takes its assigned
site and the other seven are AI owners. Missing biomes use the best available alternatives;
legacy maps with already assigned civilizations retain their positions.
Authored wildlife is enabled through the spatial wildlife registry: only nearby
animals become runtime entities. Civilization AI players are enabled. Continents keep the direct introduction flow;
the local village simulation handles distant work without encoding the whole continent
as an inactive economy region. See [wildlife streaming](wildlife-streaming.md).

Outputs include the map, manifest, biome preview and generation metadata (seed,
biome counts and generator version). The map is replaced only after generation
succeeds. Use a **new game** after rebuilding: delta saves refer to the exact
previous blueprint's resource baseline and are not migrated to the new one.
To retain an older playable world, generate into a separate `--out` directory.

## Cave density

The continent generator places approximately one cave per 20,000 land cells,
with at least 80 grid cells between entrances and 40 from village centers.
`--cave-land-cells 40000` halves the requested density. Water and unused cells
do not contribute. The target is rounded to the nearest whole cave.

Placement uses the world seed and a global spatial index, independently of
resource patches. Entrances require land within an 18-cell margin on the
continent; the surrounding 6-cell clearing stays free of resources and animals.
If safe placement cannot reach the target, generation reports the actual count
and keeps only valid sites. Cave identities, interior variants and seeds are
stored in the blueprint. No cave search runs when starting the game.

Bandit camp profiles, generation settings and runtime pursuit rules are described
in [bandit camps](bandit-camps.md).
