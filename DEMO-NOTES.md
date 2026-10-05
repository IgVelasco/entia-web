# Entia web demo — current behavior

## Entry and UI
The actual animated portal stands in Home. Walking into it opens an embedded demo view in the same page (#demo) with an emerald transition; reduced motion skips the effect. Browser Back clears the entry lock. Demo starts with a how-to-play popup. P opens the same pause/controls menu.

The right-hand HUD contains life, mana, carried/secured essence, Spells and Inventory. Mobile uses a right-hand Character drawer and compact vitals. The existing Entia look and improved RAO artwork are retained.

## Play
- WASD/arrows: cardinal 32-unit steps; latest direction wins
- C or Prepare: arm Apocalipsis; point and release-click a target to cast once. Every attempt disarms, including rejections. Bare clicks inspect. Escape cancels aiming before pausing
- Space: strike a nearby actor in the facing direction
- Q or contextual touch button: pick up essence underfoot
- N: meditate to recover mana; movement cancels
- E: interact with the return portal
- Bot spell markers telegraph incoming strikes. Their casts do 12 health damage; they take 2–3 targeted hits

## Essence and bank
Kills and player death produce ground drops. Items snap to the same 32-unit tile centers as actors and props; blocked centers choose a nearby free tile. Drops on the same tile merge. The pickup sprite is drawn centered on that point, not offset above it.

The compact stone bank appears after the first pickup. Remain within its radius for one second and essence transfers automatically at 12 per second. Tiny crystal particles arc from the player to the bank. Leaving stops further transfers; already secured essence remains safe. The animation is cosmetic feedback for atomic balance transfers. There is no amount/confirmation popup. Pausing suspends the simulation and animation. Reach 60 secured essence to complete the tutorial.

The demo has no trees or tree collisions. Nix is unchanged. Ground textures, actor/prop anchors and item placement share a 32-unit grid. Portal pillars, bank footprint, world bounds and actors remain solid.

## References and limits
This is a single-player browser simulation. It does not connect to RAO accounts or a game server; reloading or restarting clears progress. Balance, timing and banking rules are tutorial choices, not claims of production parity.

Read-only reference sources:
- https://github.com/dcatanzaro/aoweb/blob/main/frontend/components/game/core/useRendererBootstrap.ts
- https://github.com/dcatanzaro/aoweb/blob/main/frontend/lib/hotkeys.ts
- https://github.com/dcatanzaro/aoweb/blob/main/frontend/components/game/core/useMovementSync.ts
- Locally available RAO InputController, InputEventController, CombatActionController and commerce UI snapshots

No AO Web code or artwork was copied; its root licence was not verified. Approved RAO artwork and newly generated coffer/crystal assets are used. The coffer renderer uses a tight source-object crop to avoid most of its generated outer halo; original alpha is preserved.

## Validation
node --test tests/*.test.cjs: 78 passing tests covering navigation, cardinal movement, collision/pathfinding, camera positioning, input modes, spell targeting, mana, bot spell/dodge behavior, essence pickup/drop/recovery, shared tile centers, sprite draw anchoring, proximity banking conservation/interruption, stream rendering, pause/help and restart. Controller tests use mocked DOM/canvas. Real-browser visual/mobile QA remains unverified because local preview access and hosted authentication were unavailable.

## Home anchors and RAO-style HUD
Home uses the same 32-unit tile centers for characters, keeper destinations, scenery and light pickups. The player name stays horizontally anchored but moves above the head near overlapping keeper labels. Demo actor feet align to logical anchors and its view is closer for readability.

The supplied screenshot is the visual reference: separate stacked six-by-six inventory and spell windows on the right, dark frames and gold edging, horizontal resources below, and a compact macro bar. Inventory and spells are simultaneously visible. The third gold meter is honestly labelled secured essence, not an unimplemented energy system. Items select on click; U, Use or double-click consumes a selected potion.

## Verified held auto-pot behavior
This replaces the earlier percentage-based approximation. Global Auto-pot starts enabled. Hold an assigned potion macro to repeat, with a shared 260 ms cadence; the latest pressed held potion wins. Successful melee and casts impose a 310 ms potion lockout. A repeat claims release, preventing an extra use; with Auto-pot disabled, release uses once. Focus loss/pause clear held state without consuming. Holding at full health/mana still consumes stock, matching normal-area server semantics. BattleServer/fight-zone reusable-potion behavior is not represented.

F1 life and F2 mana are explicit demo assignments, not RAO factory bindings (real macros start empty and are character-configured). Practice stock is 100 per type; heal amounts remain illustrative. Real source-verified HUD potion icons are reused from client 44913d6003f3bbae9792f3a74cf781bdb6680847.

Behavior sources inspected:
- https://github.com/IgVelasco/rao-client/blob/44913d6003f3bbae9792f3a74cf781bdb6680847/scripts/MacroController.gd
- https://github.com/IgVelasco/rao-client/blob/44913d6003f3bbae9792f3a74cf781bdb6680847/scripts/MacroRuntimeController.gd
- https://github.com/IgVelasco/rao-client/blob/44913d6003f3bbae9792f3a74cf781bdb6680847/scripts/InputController.gd
- https://github.com/IgVelasco/rao-client/blob/44913d6003f3bbae9792f3a74cf781bdb6680847/scripts/ClientCommandBookkeepingAdapter.gd
- https://github.com/IgVelasco/rao-client/blob/44913d6003f3bbae9792f3a74cf781bdb6680847/scripts/AutoPotController.gd

## Same-page lifecycle
Home remains mounted behind a same-origin iframe. The portal transitions into it; returning preserves Home's character position and content. Browser Back/Forward is supported. A return cooldown prevents immediate accidental re-entry. Loading/failure messaging keeps a return option available. Parent/child messages require matching origin and exact frame identity. Hidden gameplay pauses; first entry shows instructions. Standalone /demo/ still works. Real-browser embedding/visual QA is not yet verified; automated state-machine coverage passes.

## Return-flow correction and phone layout
Explicit return now closes the embedded view immediately in state and restores Home without waiting for history.back. This removes the joint iframe history dependency that could leave exit pending forever. The iframe navigates with location.replace and stays mounted between visits. Returning fades the demo away; entering has a shorter portal transition. Walking into the demo's portal now exits automatically, with re-entry spawn moved clear of the trigger. An always-reachable Home button provides a second route.

Phone layout uses dynamic viewport height and safe-area insets, including coarse-pointer landscape screens. Touch buttons are at least 44 px where space permits; inventory uses larger scrollable slots and a five-column fallback on the narrowest phones. The Character drawer has a dismissible backdrop and pauses the local combat simulation while open. Portrait/landscape geometry, entry activation, return-once guards and preserved Home state are covered by tests.

Final suite: 84 automated checks pass. Live visual testing remains blocked at the site's ChatGPT login; a current phone screenshot was requested. No claim of a completed real-device visual check is made.

## Character editor and essence pickup clarity (2026-10-05)
Header Character opens a shared accessible native dialog in Nix and the demo, with name, two actual improved sprite appearances, four-direction animated preview, draft Cancel and explicit Save. The original complete looks include their baked-in staff; independent weapon selection is not implied. Browser-local storage synchronizes the retained iframe/Home; storage failure preserves this visit. No account integration or combat-stat changes. Demo combat and held inputs stop while editing. Inventory drawer retains its own separate button.
Pickup eligibility now has a shared readiness+distance predicate. The exact eligible crystal tile and pickup button highlight, with an overhead amount/Q label. Drop settling cooldown is respected; highlights do not promise a premature pickup. No automatic pickup added.
Validation: 90 automated tests including real controller character rendering, edit pause, draft/save/cancel, invalid storage, cross-document updates, and eligibility boundaries. Browser/mobile visual verification remains unavailable behind the existing preview access limitation.
