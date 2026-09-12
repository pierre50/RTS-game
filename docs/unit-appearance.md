# Unit appearance

`unitIdentity.ts` resolves the identity shared by sprite selection, generated names,
NPC dialogue and voices. Supported fixed-gender sprites take priority, then a saved
`appearanceVariants.gender`, then `gender`, then the hero owner's gender. A new
civilian without a saved gender uses its stable unit label. Position and owner gender
do not affect that choice.

Creation persists the resolved gender in both legacy fields and stores the original
civilization in `assetCiv`. Existing names are preserved. When older saves disagree
about gender, the saved visual identity wins; refreshing synchronizes both fields.
Conversions retain the original civilization.

`applyBakedLpcUnitAssets` calculates sprite aliases and equipment layers. It replaces
the complete activity map when a unit changes role, including promotions. It is for
configuration and preloading; it does not bind the calculated sheets to a live sprite.

`unitSpriteAssets.ts` selects the current activity (falling back to the role's default)
and binds the corresponding sheets. Creation and work changes use this same path.
It also clears obsolete activity sheets, such as harvesting sheets after promotion.

For a live equipment or role change, use `refreshBakedLpcUnitAssets`, or
`ensureAndRefreshBakedLpcUnitAssets` when the required atlas may not be loaded.
These refresh the displayed sprite using the current work, action and animation,
without changing its destination or movement path.

Regression coverage lives in `unit-identity.test.cjs`, `unit-appearance-refresh.test.cjs`,
`appearance-layers.test.cjs` and `player-auto-technologies.test.cjs`.
