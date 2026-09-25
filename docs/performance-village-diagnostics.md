# Capturing a village teleport freeze

After loading the updated game, run `perf-report reset`, teleport to a village and
run `perf-report` soon after the freeze. Copy the complete report. Repeat from a
reset for a second teleport to the same village to distinguish first-visit work.

- `perf-report spikes` shows the worst frames and diagnostic events in their vicinity.
- `perf-report events` shows the most recent 40 events from a bounded 128-event history.
- `perf-report json` exports all retained measurements and event details.

AI stage metrics separate knowledge refresh, defense, economy, strategy snapshots,
production and building placement. Economy metrics further separate scouting,
carcass searches, builders, food, horses and resource assignment. Slow AI steps
(16 ms or more) identify the civilization, owner, duration and entity counts.

Minimap teleports record origin/destination. Village events record detailed/distant
transitions and periodic state (observed, supported, activity types). Wake and
simulation have separate CPU timings. Significant scheduler catch-up records the
incoming delta, callback count, extra invocations and most repeated task; it does
not alter task execution. Normal small catch-ups are omitted to keep the timeline useful.

Slow frames retain nearby events even if the rolling event history later expires.
Timestamps use the same monotonic wall clock. Events indicate temporal proximity,
not proof that a teleport caused every associated measurement. Reset clears them.

Scheduler timing is nested with its tasks. Manual synchronous timings such as
pathfinding are attributed to their measured parent, so they are not also counted
as parent exclusive work. Inclusive totals still overlap. These are CPU timings,
not GPU timings; sampled totals remain estimates. No gameplay scheduling budgets,
AI behavior or activation policy are changed by this instrumentation.

## Local economic knowledge

AI economic candidates now come from independent Town Center territories using
`VILLAGE_ACTIVITY_RADIUS` (30 cells). Multiple villages merge their local candidates
without duplicating a shared node. Existing exploration/native familiarity checks
still decide which of these candidates the AI knows. Wildlife and carcasses use
local instance buckets each economic step; there is no Gaia-wide search.

A village's initial resource index reads at most its 61 × 61 cell square, filtered
to the activity circle. Compact blueprint records stay unmaterialized until a unit
receives a gathering order. Warm reads consult current quantities, including an
already materialized shared handle, so depletion and berry regrowth do not require
index invalidation. Deleted compact records cannot become gathering targets again.

Resource creation/destruction queues the changed cell only for nearby indexes.
Repeated changes to the same cell are coalesced; each village consumes at most 64
changed cells per step. A local reconciliation every 15–20 seconds catches missed
structural updates, with at most one periodic reconciliation per map per 250 ms.
Initial village creation and moving an anchor rebuild their bounded area immediately.
Daily events and animal spawns no longer invalidate every faction's knowledge.
Indexes are runtime-only and rebuild for a loaded/new map.

Compare `ai.knowledge`, `ai.economy.food` and worst frames on the same teleport
route before/after this change. These changes do not address building placement
cost or the synchronized scheduling of the seven AI steps.
