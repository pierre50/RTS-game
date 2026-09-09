# Final map files

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
