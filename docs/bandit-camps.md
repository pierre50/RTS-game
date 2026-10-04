# Generated bandit camps and bounded pursuit

The continent generator (`pnpm world:generate-large`) now authors two profiles:

- `lair`: approximately 40% of caves, 5–8 guards including a chief; chest and 1–3 neutral villagers inside.
- `small`: approximately one camp per 40,000 land cells, 2–4 guards, outdoor fire, decorations and chest.

Use `--lair-fraction 0.4` and `--camp-land-cells 40000` to adjust these defaults.
Positions, identities, profiles, rosters and seeds are written into the blueprint;
per-camp random choices do not depend on the order of the other camps or hero level.
Camps respect village clearance and an 80-cell separation. Resource and animal
placement reserves the approaches, including patch boundaries. Unsuitable sites
are omitted, never forced. Counts are reported in generation output and metadata.
The 5000-map isolation mode retains these authored camps while other factions
remain isolated. Existing saves keep their existing camps; regenerate and start
a new game to use new placements.

## Runtime behavior

`CampLeashController` uses a serializable `campBehavior` and the existing camp
anchor. Its defaults are a 20-cell target range, 30-cell home tether, three seconds
to search after losing sight, and arrival within four cells of home. Distances
are measured in grid coordinates, with an interior projected through its home exit.
It does not consult a hidden target's position to extend its search.

The states are `guard`, `pursue`, and `return`. Returning guards do not reacquire
or retaliate into a new chase. Routes retry at most every two seconds if blocked;
there is no teleport or health reset. Guards may enter their assigned cave and
return through its exit. They do not pursue through unrelated interiors or into
another world region. Player-owned units are excluded from automatic camp rules.

Attack orders, retaliation and door pursuit share `canCampPursue`. A future raid
can use a rally anchor, `homeSpaceId`, `chaseRange` and `tetherRange`; existing tribute
raids have not been migrated to this controller.

One shared patrol task updates a registry of guards. Active guards use a bounded round-robin queue; distant idle guards are paused. Registry reconciliation
also runs every five seconds to include newly spawned quest camps. Units remain
runtime entities; this is not full camp streaming.

## Lazy cave contents and saves

An authored occupied cave stores `banditContent` with its owner, inventory and
initialization state. Furnishing runs when an interior is first requested, through
either interior creation entrypoint. Stable object labels and the saved generated
flag prevent respawning loot or recruited villagers. Interior layout generation
keeps passages connected. Legacy regional camp furnishing remains supported.

Generation tests cover profiles, spacing, seed determinism, water exclusion and
resource patch seams. Behavior tests cover target/home limits, lost sight, return
routes and retries, portal exits and world-region exclusion; cave tests cover all
interior variants and saved initialization state.

## Camp respawns

Initial camp generation records each occupied fire's actual guard roster and fixed
position. Once all its bandit guards are dead or converted, a three-game-day
cooldown begins (`BANDIT_CAMP_RESPAWN_DAYS` in `app/config/campActivity.ts`). The shared
patrol task checks camps every five simulation seconds. Living guards still count
when fleeing, chasing, or inside their linked cave, so they never gain duplicate
reinforcements. Legacy quest-created camps are excluded from automatic respawns. New chief quests reuse occupied camps or immediately repopulate a saved empty site through the same respawn function; they no longer generate new camp sites.

Respawns reuse the original sites and roster limits. Existing fires, decorations
and loot are reused; a destroyed fire can be rebuilt if its original cell is free.
Blocked sites retry later, and limited free unit cells may produce a smaller roster.
No additional sites or loot are generated. New guards restore the minimap marker.

`runtime.banditCamps` saves the initial limits, respawn generation and elapsed-game-time
cooldowns. Loading does not reset the delay. Older continent saves without this field
recover their authored camp sites and rosters; already empty camps start their delay
when first checked after loading. Older non-authored saves have no recoverable initial
roster and do not receive new respawn sites.

## Distant camp pause and bounded nearby checks

`CampPatrolSystem` pauses distant guards rather than simulating their patrols offline. Hero proximity, the camera and nearby combat determine interest, with 80/110-cell hysteresis and space-aware cave coordinates. While paused, movement/action callbacks, patrol searches, animations, passive energy and sleep healing stop. There is no elapsed-time catch-up when returning. Existing camp respawn rules remain separate.

An attack wakes a guard immediately through the existing unit wake hook. Ongoing combat, portal routes and rest transitions finish in the live runtime before a camp can pause. Converted units and destroyed runtimes release their pause markers. Nearby acquisition/patrol/leash checks use a round-robin queue: at most four guards per 100 ms callback, with at least 500 ms between checks for one guard. The callback allows one execution per tick, so a slow frame cannot trigger a burst of overdue checks. Movement and combat callbacks still run normally for active guards.

`camp.activity` reports active and paused guards every five seconds. This is a guard count, not a camp count.

### Suspension ownership and camp interest

`unitSuspension` is the shared runtime registry for stopped callbacks and wake requests. Its explicit reasons are `camp-paused` (frozen, no catch-up) and `distant-work` (settled by the economic simulation before waking). The old village-named suspension API and the duplicate camp pause registry have been removed. `isCampPaused` only reads the reason from the shared registry. Wake callbacks are protected against recursive wake requests; a failed settlement remains retryable.

`CampInterest` groups guards by owner, home space and anchor. Spatial interest and hysteresis are evaluated once per camp; a guard's combat, portal or rest transition remains an individual exception. The group cache is replaced on each refresh, removing vanished camps.

A blocked return tries one of the four nearest candidate cells per two-second retry, rotating through the alternatives. It no longer tries four routes synchronously. Losing a target and starting a return cannot both issue a movement request in the same leash update. The queue bounds guard decisions and return-route attempts; it does not impose a global time budget on every internal pathfinding operation.
