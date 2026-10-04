# Path atlas

`texture.png` is the unmodified `paths_mask_output/paths-transparent.png` supplied
in `isometric-paths-complete`. The Pixi spritesheet wraps its 15 rows × 16 columns
of 80×64 frames; no pixels were recolored, rescaled or regenerated.

Columns use NE=1, SE=2, SW=4, NW=8. The source terrain mask is pasted at (7,7).
`roadAtlasFrame` maps game relief indices to rows, including duplicates 11/19 and
12/20. The sprite origin is (39, 7 + floor(terrainTextureHeight / 2)), matching
the terrain's origin and preserving relief elevation through its parent cell.

Road sprites are baked above terrain and biome borders, below world entities.
They share the ordinary terrain streaming lifecycle. Their network is stored on
the map independently of temporary terrain sprites and compact grid cells.
