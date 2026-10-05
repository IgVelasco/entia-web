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

## Combat, touch and loot corrections (2026-10-05 afternoon)
- Preparing a spell no longer calls the movement-input reset when the inventory drawer is already closed. Held movement continues through preparation and casting, including a second touch pointer. Touch release casts once; synthetic duplicate clicks are suppressed. Game surfaces disable text selection, drag and long-press callouts, while editable fields remain usable.
- Home and demo use one presentation-density function; embedded entry and viewport resize pass the exact Home scale to the demo. Native actor world bounds remain 60×100.
- Added Inmovilizar and targeted Remover parálisis, including clicking yourself, and mobile Strike. Bots self-cleanse after a reaction delay when available and occasionally immobilize the player. Immobilized actors can still cast. Status-free cleanse and repeated immobilization are rejected before resource spending. Short duration, mana costs and simple status effects are explicitly demo adaptations, not production balance/assets.
- Death is handled before healing/banking can erase the zero-health condition. Carried essence is dropped at the death site; banked essence stays secured. Loot is split into separate free tiles, maximum 10 per pile. Bots seek and collect loot, and their recovered/stolen balance drops on defeat. A full map preserves unplaced balance rather than silently losing it.
- Removed the added pickup tile outlines, overhead prompt and bright button style. Drops participate in painter ordering; an eligible pile draws just above the player's feet for visibility. The ordinary contextual Q/tap pickup button remains.
- Verified source semantics read-only at client main44913d6/server7709e2f. Production has no cast movement lock; Inmovilizar movement-only, Remover clears statuses and targets players/NPCs/self. Canonical costs/timers are deliberately not copied into a100mana tutorial.
- Automated model/controller checks cover ten-unit splitting, conservation, safe-zone death, bot theft/recovery, immobilize/cleanse, multi-pointer movement+cast, matching inherited scale and pickup draw order. Real iOS visual/touch behavior remains unverified in an authenticated browser.

## Resume recovery and touch follow-up (2026-10-05)
User supplied Android Chrome screenshot after browser→WhatsApp→browser: actors and props remain but cached terrain is blank. Code-supported likely cause is discarded offscreen-canvas backing pixels with a stale readiness flag; actual Android memory-pressure failure is not reproduced. Both scenes now invalidate and reconstruct cached terrain on visibility resume, pageshow and canvas context restoration, preserving gameplay/selection state. Lost contexts are not marked ready. Paused/reduced-motion recovery is covered by tests.
Mobile Prepare, Strike, macro-cast and pickup bind pointer release directly, with capture/cancel handling and click deduplication, so secondary touch does not rely on synthetic click generation. World casts require a matching canvas-started pointer; canceled gestures cannot cast. Expanded non-selection/non-callout protection to HUD/meta/header/button descendants while editable fields and readable content retain selection.
Damage floats red !amount! over the damaged actor. Existing simplified enemy hit points produce !1!, while enemy spells deal !12!.
Home character taps now call the cast-and-travel route. Removed visible Apocalipsis control. On phone/tablet, zone information uses a native dialog with large close button, backdrop dismissal and readable scrolling; closing does not send the character Home. Desktop content remains in its panel. Automated tests cover all new paths; real iOS device interaction remains unverified.

## Remove old minigame and phone overview (2026-10-05)
Removed Collect the lights from Home/Game, its DOM, handlers, runtime treasure state and obsolete tests. Portal essence combat remains intact. Phone Home camera now fits all four named destinations and their label/head margins; it stays fixed while travelling between them rather than cutting other areas off. Phone zoom controls are hidden to preserve that overview. Zone dialog has a .65-second fade/short upward entrance, lightly transparent backdrop, more opaque high-contrast reading surface, large close control and bounded scrolling; reduced motion skips animation. 104 tests pass, including 320/390/430px overview geometry. No house sprite replacement has been made; comparison awaits user review.

## D-pad release/drag correction (2026-10-05)
Confirmed source defects: keyboard and finger inputs shared one Set, and captured drags retained the original arrow because no coordinate hit test existed. Replaced this with independent keyboard/pointer records and last-pressed ordering, coordinate-based arrow switching, neutral movement outside buttons, idempotent local/global release/cancel, final-touch safety cleanup, and lifecycle resets. Long-press touch defaults are prevented only on the pad; arrow glyphs are now non-text CSS geometry with accessible button labels. Press feedback does not change the button hit box. 107 automated tests pass; real iPhone multi-touch/callout behavior still requires device acceptance. A missed individual pointer-up while another finger remains cannot be inferred from Touch.identifier, whose identity is not guaranteed to match PointerEvent IDs.

## Separate map and control panel (2026-10-05)
Moved every mobile movement, potion, cast and contextual interaction control into an opaque sibling panel below the map. The canvas now ends at the playfield boundary; gaps between buttons cannot target the canvas. Map clicks/releases outside its actual bounds are rejected, control events do not bubble to scene actions, and ResizeObserver keeps bitmap/input geometry current as panel height changes. Added clear bank locked/carrying/depositing/secured status. User confirmed the bank appeared after pickup; original unlock rule is unchanged. Compact landscape rows apply only above560px to avoid clipping controls on narrower screens. 109 automated checks pass; real-phone acceptance remains outstanding.

## Prevent Prepare/cast camera shifts (2026-10-05)
Confirmed layout cause: armed target help used display:none while unarmed inside the auto-height controls panel. Preparing/casting changed panel height and therefore the centered playfield camera. The hint now reserves a fixed32px slot using visibility:hidden; deposit status/top controls also reserve stable rows. Landscape retains identical rows in either state. Coarse-pointer actions no longer focus the canvas, and unchanged ResizeObserver notifications do not reset bitmap dimensions.111 tests pass and independent source review found no remaining armed/disarmed height toggle. Actual iPhone acceptance remains unverified.

## Mobile held-direction correction — October 5
- User clarified that movement suddenly stops while the arrow is still held. The captured pointer previously set its direction to null whenever coordinates left an arrow, including gaps and small thumb drift.
- Preserve the held direction outside arrow bounds until pointer release/cancel/lost capture or existing lifecycle cleanup. Entering a different arrow still switches direction. Secondary casting release cannot clear the movement pointer.
- Mobile notices now sit at the lower playfield edge; long objective prose is hidden to reduce obstruction. Notice geometry remains absolute and bounded, so it does not resize the camera.
- 113 automated tests pass, including drift and secondary-finger release. Physical iPhone acceptance is still pending; this does not prove every possible movement interruption is resolved.

## Mobile joystick and underfoot life bars — October 5
- Added a captured thumb joystick with a 9px centre dead zone, four-direction steering, diagonal-boundary hysteresis, bounded thumb travel and independent pointer ownership. Release, cancellation, lost capture and lifecycle cleanup recenter it; a second casting finger cannot take it over.
- Existing directional controls are visually hidden behind the joystick for the compact presentation. Desktop WASD/arrows remain unchanged.
- Red life bars with a dark outline and muted gold frame now render below the feet for player and living rivals. Names remain above actors. This matches the demo HUD palette; it is not a claim of exact production-client bar geometry.
- 116 automated tests pass, including joystick centre/drag/cancel and health-bar fill geometry. Physical Safari acceptance remains pending.
