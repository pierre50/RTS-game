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

## Campfire sleep

Campfire sleep now uses `SleepSimulation`, rather than the debug fast-forward
speed. The overlay continues rendering while animation time and the action
scheduler are suspended. Each interval is at most one game hour and stops at a
new-day boundary or an interrupting raid deadline. Owner transactions run on
separate frames; cancellation finishes the current interval before waking.

Existing village checkpoints are settled before the hand-off. Daytime work uses
`advanceVillageWork` / `simulateOfflineWorld`; fully sleeping intervals only
integrate scheduled healing and meals, avoiding terrain snapshots. The live
calendar alone dispatches daily events and training completion. On waking, the
rest system reconciles shelters and village activity starts fresh checkpoints.
Ordinary movement and cosmetic timers retain their remaining delay and never
replay the skipped night. Combat movement is not simulated during sleep; nearby
hostiles, active raids and scheduled faction-raid deadlines interrupt the skip.
The developer console's ordinary fast-forward command still uses its prior mode.

To compare, reset the performance report immediately before sleeping and capture
it after waking. `sleep.begin`, `sleep.end` and `runtime.sleep.simulation` identify
the coarse work; `scheduler.catchUp` should no longer report sleep-induced 7200 ms
bursts. Test both uninterrupted sleep and Escape/gamepad cancellation, including
a night crossing 06:00. In-game frame-time improvements still need measurement
on the affected save; automated tests verify clocks, healing, ownership and
resumption rather than GPU performance.


## Chargement différé des villages et offres de quête

Les propriétaires IA sans interaction en cours peuvent conserver leurs bâtiments,
habitants et intérieurs sous forme de données sauvegardées. Le chargement ne crée
pas leurs objets `Unit`/`Building`. Les empreintes des bâtiments sont réservées
sans sprites ni contrôleurs. La caméra avec sa marge, un héros à moins de 80 cases,
ou une référence explicite à une entité provoquent la matérialisation. Une quête
acceptée, un combat ou un compagnon empêchent la mise en attente au chargement.
Après matérialisation, le système de suspension existant reprend la gestion du
village lorsqu'il s'éloigne ; cette étape ne détruit pas les entités déjà visitées.

`DeferredVillageStore` conserve les données faisant autorité jusqu'au réveil.
La sauvegarde les inclut même si le village n'a jamais été visité. Les villages
dynamiques avancent avec la simulation économique sur données et prélèvent les
ressources locales finies ; le moteur de croissance des ressources reste unique.
Les villages fixes conservent leur règle de réapprovisionnement, sans croissance
économique ajoutée. Les événements `village.deferred` et `village.materialized`
permettent de vérifier respectivement le nombre d'IA différées et leur réveil.

Les offres des chefs se préparent à moins de 80 cases du héros, y compris au-delà
de la caméra. Les intérieurs utilisent la position de leur sortie extérieure.
Le choix des demandes parcourt les ressources une seule fois et s'arrête dès que
les trois ressources couvrent les 15 unités maximales d'une demande. Les quêtes
déjà acceptées continuent à être entretenues indépendamment de la proximité.

### Remise à l’heure des routines à l’activation

Les horaires individuels fournissent désormais une phase commune (sommeil, matin,
travail, repas, soirée) et la prochaine échéance. La remise à l’heure des villages
statiques **et dynamiques** intervient avant la reprise des anciennes destinations.
Les villageois sont placés directement dans leur logement disponible ; chefs et
soldats conservent leurs règles de forum, de feu et d’escorte. Les attaques, ordres
prioritaires, conversations et alertes empêchent une nouvelle mise au repos.
Les transitions ordinaires d’un village observé restent animées.

Un saut d’heure applique seulement l’état courant, sans rejouer les déplacements
intermédiaires. Les maisons sont attribuées en une passe par propriétaire. La santé
récupérée pendant le sommeil des villages statiques est calculée sur l’intervalle
écoulé ; les villages suspendus valident leur échéance au flush de sauvegarde et au
réveil, sans recompter le même intervalle. Les villages dynamiques continuent à
utiliser leur simulation économique existante pour cette récupération.

Cela supprime les recherches de chemin du coucher lors de l’activation, mais ne
rend pas gratuite la création des entités et des intérieurs. Le coût total d’une
première visite reste à mesurer dans le jeu, notamment après téléportation.

### Rondes de nuit des garnisons IA

Les soldats ordinaires des avant-postes, villages et villes sont répartis entre
les tours de 22 h–2 h et 2 h–6 h. Les deux gardes du chef restent exclus. Le tour
est porté par `dailySchedule.nightWatch`, sauvegardé et réappliqué au chargement.
Les mêmes horaires servent au repos visible et à la récupération de santé hors
écran. Les trajets locaux de ronde peuvent être interrompus à la relève ; les
combats et les ordres prioritaires gardent leurs règles habituelles.

Les rondes utilisent le système de visites existant, exclusivement à l’extérieur,
dans un rayon de 12/18/24 cases selon le type de village. Il lance au plus un
nouveau trajet par passage de 3 secondes et ignore les propriétaires suspendus.
Aucun déplacement de patrouille n’est simulé pour les villages lointains.
