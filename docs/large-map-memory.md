# Large blueprint memory

Finalized outdoor blueprints with more than one million internal grid slots use
byte-backed terrain/relief rows and `PackedCellStore`. Small maps, legacy blueprints
and the editor retain their existing generation path.

A packed cell is a stable handle with one numeric index. Coordinates, terrain
properties and deterministic texture variants are computed through a shared
prototype. Terrain, elevation and boolean flags use byte arrays. Occupants,
corpses, decorations and appearance changes are stored only on cells that need
those properties. Runtime terrain bytes are copied from the blueprint to avoid
mutating cached source data. Fractional/out-of-byte-range runtime elevations use
sparse overrides. Existing movement, collisions and entity references continue
using `map.grid[i][j]` and the GenerationCell methods.

Whole-map appearance preparation, rendering initialization, pausing and AI
knowledge restoration avoid allocating empty per-cell state. AI knowledge still
checks exploration and current visibility for each relevant cell; this is not a
change to which entities the AI can observe.

VisionGrid now uses the existing 64x64 exploration bitsets as its authoritative
runtime store, including separate interior spaces. Current visibility is derived
from sparse viewer sets. There are no longer full-size Uint8Array/Uint16Array
pairs per player or interior. Save formats are unchanged.

This is compact in-memory storage, not terrain streaming from disk. There is still
one stable handle per accessed terrain cell. Packed runtime rows now create and
cache handles on first indexed access; untouched terrain does not allocate handles.
Explicit whole-grid iteration still materializes cells, so consumers must keep using
the packed metadata or spatial queries. Blueprint downloads remain monolithic. Some terrain scans and long-distance
path searches remain proportional to world size. Do not evict handles while paths,
occupants or other game systems retain references. A future region loader needs
an explicit cell-access API and reference lifecycle before removing that constraint.

The 5000x5000 stress map has 25,007,501 terrain cells and 56,265,001 internal grid
slots. Test creation, save/reload, pause, movement, terrain visuals, corpse timers,
visibility overlap and interior exploration when changing these storage paths.

## Verification (2026-09-23)

- Chromium: new 5000x5000 game reaches the opening dialogue and gameplay without
  errors; manual save, reload and pause verified.
- Clean browser session, loaded save: `seedSave.mountRuntime` reports 1697.4 MiB
  JS heap; `seedSave.applySavedState` takes 2408 ms. The earlier restore scan took
  20851 ms. These are stage measurements, not total load time or total process RAM.
- Repeated reloads in the same browser session also succeeded, but a sample reached
  3101.5 MiB. Do not treat the clean-session number as a peak-memory guarantee.
- TypeScript and ESLint pass. Final targeted regression run: 75 tests pass.
- Full-suite run: 2509 tests, initially 16 failures. Four import-isolation failures
  introduced by the packed store were fixed and their suites rerun successfully.
  The other twelve failures were reproduced against HEAD in an isolated baseline:
  black-grouse-feather-drop (4), resource-interface (2), villager-horse-capture-action (6).


## Lazy runtime cells and resource zone indices (2026-09-24)

- Packed runtime rows preserve `grid[i][j]` identity, array methods, sparse holes,
  replacement and deletion. The first generation pass indexes terrain bytes and
  chunk bounds without constructing cell objects. Work yields use an 8 ms budget.
- Blueprint resource loading checks packed occupancy/type metadata directly rather
  than materializing a cell for every cold resource. Animated resources keep their
  existing runtime behavior.
- Resource zones retain sparse lists of resource indices. Dense 64x64 lookup tables
  are built on demand and kept in a 64-zone LRU (at most 1 MiB of dense tables).
  Eviction discards only lookup tables, never quantities, deletion state or handles.
- This is not file streaming: the blueprint and compact resource columns are still
  loaded globally. Accessed cell/resource handles are retained for reference safety.
- Browser 5k isolation runs indexed 25,007,501 terrain cells with zero initial cell
  objects in 613–862 ms; resource preparation materialized 141,951 cells and took
  3.8–3.9 seconds. Gameplay rendered successfully. These runs are not a controlled
  benchmark; resource loading has not demonstrated a speed improvement yet.
- Browser autosave hit localStorage quota (`STORAGE_FULL`). No saves were removed.
  Save-format unit tests pass, but successful browser persistence was not verified.
