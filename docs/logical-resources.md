# Logical resources and disposable views

`Resource.spawn` loads living static resources with a persisted texture as a stable
logical handle. Blueprint loading and saved-resource restoration use this factory.
Animated resources, editor resources and saved dead resources retain the existing
`Resource` implementation.

The handle owns identity, position, quantity, health, texture selection and gameplay
flags. Shared resource definitions supply immutable defaults. Cells, spatial buckets,
AI targets and the save serializer all reference the same handle. Creating or evicting
its view never changes occupancy, quantity or the target's identity.

`ResourceHandle` is a compatibility adapter for the current gameplay API. Gameplay
methods execute on the handle; display operations are delegated to an optional Pixi
container. A visible resource (or an explicit sprite request from an interaction)
materializes the view. Hiding an unselected living resource disposes the container,
sprites, shadows, wind ticker and visual-settings subscription. Selected resources
and death effects keep their views until their existing lifecycle completes.

Texture bounds are shared by resource type/texture/scale. Visibility and saving can
query these bounds without allocating sprites. Display destruction does not emit the
entity's `destroyed` event. Actual entity destruction still does.

Blueprint resource loading checks its 8 ms work budget every 1,024 entries and
logs progress every 16,384. The end log reports compact storage and the number of
materialized entities.

This is the resource step, not full world streaming. Logical terrain and resource
states still reside in memory for the loaded region. Existing small-scale runtime
spawners may still construct regular Resource objects. Animals still use their full
runtime simulation, and animated crop growth is unchanged. Loading logical zones
on demand and distant animal simulation are separate follow-up work.


## Compact resource storage on packed maps

`CompactResourceSet` stores living, static, single-cell resources in typed columns
(position, type, texture, quantity, total quantity, hit points, flags), indexed by
64 × 64 zones. Terrain collision flags are populated immediately. Reading
`cell.has`, resolving a saved target, or interacting with a resource creates one
stable gameplay handle; subsequent access reuses it. Resource visibility still
controls the independent Pixi view. Editor, animated, dead, multi-cell and extended
resource states use the existing implementation.

Read-only consumers (minimap, saves, diagnostics, initial quest counts) use
`resourceReadValues`. These records must be resolved with `resolveResource` before
mutation or interaction. Ordinary Set iteration deliberately materializes handles
for compatibility. New whole-map read-only code must use the data-only API.

Villager queries rank nearby valid records through the zone index, then materialize
only candidates passed to path evaluation. Their existing candidate limit and
Manhattan ordering are preserved. Native economic knowledge, offscreen harvesting,
resource depletion, berry regrowth and save target identities remain supported.
Projectile and perception queries also consult the compact index before a resource
has a runtime spatial-bucket entry.

This does not yet stream resource files: the blueprint JSON cache remains resident,
saves still expand to the existing full JSON format, and materialized gameplay
handles remain resident after visiting an area. The compact collection's fixed
columns use 35 bytes per initial resource, plus 16 KiB for each occupied zone and
interned metadata. Modified objects, source JSON, terrain and rendering are extra.

### Development measurement (2026-09-24)

On the generated 5,000 × 5,000 continent, the Chromium development build loaded
705,534 resources in 3,234 ms. The collection reported 6,336 materialized entities
(animated crops), leaving 699,198 static resources compact at the end of that stage.
Generated minerals/herbs without textureName are assigned their texture using the
existing terrain asset selection and map RNG before packing. This is essential:
leaving those 125,473 entries on the old constructor path dominated an initial run.

This measures the resource stage only, not total startup or movement frame times.
The unchanged mass animal creation stage remains a separate bottleneck. Blueprint
JSON and full-format save costs also remain outside this improvement.

The same 5k browser run completed animal creation in 187,343 ms and subsequently
logged village population completion at about 2,204 MiB used JS heap. The tab then
stopped responding to browser controls before the playable HUD could be verified.
Therefore this run validates the resource-stage improvement, not full-map stability;
the cause of the later stall has not been profiled or established.
The browser subsequently identified the 5k tab as crashed. A separate small Nobatia
map reached the playable HUD after its opening dialogue with no console errors.
