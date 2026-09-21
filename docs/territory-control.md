# Territory control

A region belongs to the faction owning its living, completed TownCenter. Houses,
other buildings, armies and construction sites do not claim land. Destroying the
TownCenter immediately releases the region, even while its owner's other buildings
and units survive. They keep their owners. Capturing the TownCenter transfers the
territorial claim with that building.

Each faction may have at most one living TownCenter site in a region. Different
factions may start competing sites while the region is unclaimed. The first site
to finish destroys every other unfinished TownCenter in that region, without
refunding construction costs or changing ownership of other assets. Completion
callbacks run sequentially; a destroyed site cannot finish later in the same
update. A completed TownCenter prevents any additional TownCenter placement in
that region, including by another instance of its own faction.

The same completion and territorial rules apply to saved regions simulated while
the hero is elsewhere. The world map uses the actual TownCenter owner for active
and saved regions; regions never instantiated still display their initial village
or city owner.

Existing construction permissions follow the territorial owner: other factions
cannot place new buildings until the TownCenter is destroyed. Existing non-center
projects can still finish. AI elimination and its existing building-transfer rule
remain separate: losing territorial control alone does not eliminate a faction
or trigger conversion.
