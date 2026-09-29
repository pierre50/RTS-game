# Wildlife and natural resource renewal

The 5000 continent now enables its authored animals. Other factions and raids
remain disabled by the large-map test settings. Start a new game to populate a
world whose previous save was created with animals disabled; empty saved animal
lists are deliberately not repopulated during loading.

## Wildlife

`WildlifeStore` indexes plain persistent animal records in 32-cell zones.
`WildlifeSystem` checks nearby zones every 250 ms and creates at most 16 animals
per update. Activation follows the camera, hero, and live outdoor units/buildings,
with a minimum radius of 32 cells. Suspended NPC units and buildings belonging to
an abstract distant faction no longer activate wildlife. Live workers (including
trainees), player units, the hero and camera still activate it. Dormant anchors
retain their sight exclusion for replacements, and existing interaction/return
pins remain in force. Sleep uses an extra 16-cell margin to prevent
repeated creation at the boundary. Camera zoom can increase the activation radius.

Streaming reconciliation runs at most once per frame during fast-forward or a
stall, retaining the fractional interval remainder. Pending renewal work stays
queued and corpse decay still uses elapsed game time. Movement, combat and
production retain their normal scheduler catch-up. Animal threat searches skip
compact resources, since only units and buildings can be threats.

Distant animals keep identity, position and health but do not walk or own display
objects or behavior timers. Combat, fleeing, selection and direct unit targets
keep an animal active. Displaced survivors also remain active until they return;
loading a displaced dormant record resumes it at its saved position, in the same
16-animal activation batches. Tamed companions and trap prey stay outside this
system. Saved encounter participants are restored before resolving unit targets.

Each original animal provides one persistent population slot and an eight-cell
home area. Together these slots preserve a habitat's initial population without
spawning more animals when survivors flee. Idle destinations stay inside the home
area and avoid building clearance. Fleeing can go beyond it. After ten seconds
without fleeing or a nearby threat, displaced wildlife walks back using a real
path. Return routes avoid human units and buildings within the animal's sight
range. Blocked routes retry at the normal ambient cadence, up to eight candidate
paths per attempt. Home and calm-down clocks survive saves.

Home suitability is checked at most once per game day for active animals and due
replacement slots. Passing units do not change it. A partially usable home stays
put; a wholly unusable home must remain blocked across a day boundary before it
can relocate. Relocation chooses nearby suitable land within 24 cells of the
original anchor, so repeated displacement cannot move the habitat across the map.
If no suitable land exists, it stays pending. Survivors and replacements use the
same persistent home metadata.

Death records a replenishment date three game days later. Corpses retain loot
and decay while dormant. Once the corpse expires and the date is reached, a new
animal of the same type can occupy a free home-area cell. Each slot gets at most
one renewal attempt per daily event, with that attempt date preserved in saves;
blocked attempts wait for the next day. Startup also processes overdue saved
slots. Replacement locations avoid building clearance, camera view and unit or
building sight ranges, rather than the much larger streaming radius. This lets
village hunting grounds replenish without spawning animals in plain sight.
Replacement identities remain distinct even when slots share home coordinates.
Pending corpse/replenishment work is processed in batches of 16; a new day does
not scan all animals. Time here means game time, not time while the application
is closed.

Saves include dormant records plus current active state once per identity.
Startup logs `[wildlife]` with record, active and pending-renewal counts.
Every five game seconds, `wildlife.activity` records active/persistent counts,
dormant anchors, new activations and retained animals by reason (interaction,
return home, units, buildings, hero or camera). Reasons are exclusive, with
interaction and return taking precedence over proximity.

## Resources

Berry and wheat quantity changes register the resource for daily growth. Intact
compact resources stay compact. Depleted sites are indexed by their due day and
renewal jobs run in batches of 32 every 50 ms. A save finishes queued renewal
jobs before taking its snapshot.

Existing resource growth rates and respawn delays are retained. A blocked
original resource site waits until a later day instead of searching the continent
for another location. Static renewed resources use logical handles with visuals
created on demand. This does not add new tree regrowth rules or change which
resource types are renewable.

## Validation

`tests/wildlife-streaming.test.cjs` covers distant populations, wake/sleep,
health persistence, interactions, delayed replacement, daily retries, returning
survivors, blocked sites and outside spaces. Habitat and behavior tests cover
bounded wandering, calm-down timing, persistent occupation and pets. Serializer tests cover dormant and active records without duplication.
Resource tests cover batched renewal, save flushing and compact berry growth.
These are behavioral checks; actual frame time on the full 5000 map still needs
a gameplay profiling run.
