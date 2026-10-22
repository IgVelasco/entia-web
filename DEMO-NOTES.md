# Saved controls and contextual spotlights — 22 October 2026

- Every accepted assignment, explicit conflict transfer, cleared key, optional example and window-only choice saves the full eleven-action table in this browser's local storage. Reloading or entering again restores it, including deliberately unbound interaction keys when E belongs to a spell. A versioned decoder rejects malformed, incomplete, reserved or duplicate-key snapshots; unavailable storage leaves the tutorial playable and reports failed saves in the editor.
- Combat explanations use shorter copy in a compact side card. A screen overlay keeps the actual affected sprite, relevant hotbar action and life/mana resource visible and outlined. Labels identify the player or the particular rival, while a condition line connects status, target and cost. Insufficient mana during immobilization points at a mana potion before Remover.
- Coaching still pauses simulation and traps focus; continuing, skipping, pausing and hiding the scene release the overlay and inert background. On phones the highlighted hotbar moves above the playfield and the card sits below it. The original spell artwork and game rules remain intact.
- Verification covers reload and a later tab with persisted assignments, blank-key restoration, invalid storage, conditional Remover/potion focus, the actual affected rival, compact geometry, keyboard focus and overlay cleanup. Recovery browser checks use controlled simulation time so test-runner latency cannot move a click outside its recovery interval.

# Rebindable actions and contextual combat coaching — 22 October 2026

- Teclas y macros reopens from the header, safe workshop or pause menu. The editor lists all five spell/potion macros plus interaction, alternative pickup, selected-item use, strike, meditation and pause. Movement and Escape remain visible fixed controls. Conflicts name the current action and offer an explicit transfer of the key; E can therefore become a spell key without also interacting. Banking remains automatic.
- A sent targeting attempt returns the cursor to normal even when the target is empty, invalid, blocked, out of range or lacks mana. Such rejections consume the cast interval but spend no mana. The local recovery gate preserves the prepared cursor because no attempt has been sent yet.
- Reference evidence, read-only: Godot `ClientInputDispatcher._dispatch_spell_action`, `CombatActionController.send_spell_at`, `ArmedActionController.complete_targeted_spell`; server `spells.go` cast-entry/target/cost ordering and `TestCastAtInvalidTargetDoesNotSpendMana` / `TestCastAtRemoveParalysisRejectsFreeTargetAndConsumesInterval`. The tutorial's numeric costs and damage remain rescaled practice values.
- Enemy spells now resolve one occupied tile at launch. Their artwork has no delayed radius or later damage tick. Immobilized players can turn toward all four headings without translating or discarding the current step. Remover accepts the immobilized player itself and rejects hostile bots without spending mana.
- First occurrences pause the actual simulation for contextual explanations: precision, miss, mana shortage, outgoing damage/bind/cleanse, incoming damage/bind, an enemy's miss/self-cleanse and rejected enemy cleansing. Cards show current life/mana and a response. Repeated outcomes use brief notices. Ya he jugado Argentums previamente skips current and future combat explanations while preserving the optional control workshop.
- Regression evidence: the three cursor/enemy-cleanse/turn-in-place checks fail on the preceding commit and pass after these changes. Node tests also exercise frozen lessons, skip behavior, costs, one-tile enemy hits, remapped E dispatch and the real DOM's incoming-bind/self-cleanse flow. Browser checks cover reopening all bindings, explicit E reassignment, the actual miss card and experienced-player opt-out.

# Free aiming, tile occupancy and control workshop — 22 October 2026

- Actors reserve only their destination tile during a step; sprites and swept circles do not block adjacent tiles. NPCs finish a step before preparing another cast, and immobilization pauses rather than discards the current endpoint. The HUD distinguishes paralysis (with time remaining) from an occupied tile or obstacle.
- Spells use the raw clicked world position and resolve hits from the occupied tile. Hovering over a sprite never snaps the cursor. Player aim rings and NPC target-area indicators have been removed; original spell artwork remains.
- After the three guides, a safe four-step workshop highlights the actual spell window, inventory and macro bar. Simulation and potion spending stay frozen until the player explicitly enters combat.
- Five optional macros can be assigned individually, with duplicate/reserved-key validation, clearing and an optional example. No macro is assigned implicitly. A window-only route explains selecting a spell, Lanzar and clicking, plus selecting and using potions.
- Regression checks cover moving actor occupancy, adjacent rows, interrupted steps, free aiming, absent target rings, custom potion keys and the entire workshop-to-combat browser flow.

# Original spell artwork — 22 October 2026

- The tutorial uses the client's original particle 127 (GRH 20133) for Apocalipsis, including the swapped color channels, four-corner tint, five additive sprites, 60 moves/s, 6 degrees per move and 50-move lifetime. The tint is baked once into the cropped source texture; playback requires only sprite transforms and compositing.
- Inmovilizar uses FX 12: all 15 original 128px frames at 12 FPS with the catalog's 50px offset, -8px presentation nudge and 0.7 intensity. Enemy Inmovilizar now uses this artwork too, instead of displaying Apocalipsis for every incoming spell.
- Effects track the moving target; death clears effects attached to the player. Reduced motion displays a still original sprite with the same bounded lifetime instead of substituting a circle.
- Remover has no Particle or FXgrh in Hechizos.dat. Its invented ring has been removed; the original magic words accompany removal of paralysis. All three spells show their authored magic words over the caster.
- Source sprite regions and frame order are recorded in `src/demo/spell-art.json`. Only the two needed transparent PNGs ship (under 48 KiB total); the full client atlases are not copied. The existing melee/meditation visuals are unchanged.

# Godot gameplay adaptation — 21 October 2026

- The hallway and arena share the same cardinal footstep controller: 32 pixels in 200 ms, finishing a tile after release and turning at its boundary. Straight movement carries unused frame time into the next tile, eliminating cadence gaps at 30/60/144 FPS.
- Preparing and casting preserve existing walking orders. WASD/arrows and touch movement work while aiming. Sent attempts clear the cursor; a local recovery rejection leaves it ready for retry without spending mana.
- Combat uses the Godot client's default intervals: 1.48 s between strikes, 1.38 s between casts, 650 ms from hit to magic, and 625 ms from magic to hit. Melee accepts one input during the last 100 ms of recovery. These are the generic defaults, not class/race-specific server balance.
- Space, E and U execute on release. E picks up essence and talks; Q remains a practice pickup alias. Potion macros retain their shared 260 ms cadence and 310 ms post-attack lockout. Pause, focus loss and dialogs clear pending actions.
- Read-only behavior references: `IgVelasco/rao-client` at `635a4ab4a987e5db51b710358135288ff8f124d9` and the available working tree: `MovementController.gd`, `InputController.gd`, `ControlBindings.gd`, `ActionRateController.gd`, `CombatActionController.gd`, `ClientInputDispatcher.gd` and `ArmedActionController.gd`.
- The existing browser artwork, click-to-walk convenience, practice health/mana/damage values, bots, three-guide progression and essence banking remain tutorial-specific. This is an offline TypeScript adaptation; it neither embeds Godot nor connects to the live server.
- Regression coverage includes cadence across frame rates, tap/turn behavior, collision at tile boundaries, movement while casting, recovery retry, combat cross gates, attack buffering, release actions and cleanup. Seven new model regressions fail against the unmodified base and pass with the adaptation.

# Chunkier readable heads — 6 October 2026

- Redrew all six modular heads with fuller facial planes and stronger features, normalized within 28 x 30 pixels and aligned by the neck rather than the hair bounding box. Clothing and feet anchors are unchanged; the three outfit redesigns remain in this draft.
- Updated independent head layers, native 32 x 24 head cells, composites, metadata and previews. Added new v3 runtime filenames and cache keys.
- New faces and previous outfits are draft changes pending publication approval. The live audience is preserved.

# Distinct fuller NPC outfits — 6 October2026

- Redrew Game, Rankings and Download clothes from source art, preserving all existing registered heads. Game now uses broad full plate without a cape; Rankings uses wide parchment/rust scholar robes; Download uses a short olive jacket, roomy breeches and heavy boots.
- Front clothing silhouettes are49/58/51pixels wide at88pixels tall. Outfit extraction follows transparent column gaps so wide sleeves and gloves are not clipped at equal-quarter boundaries.
- Retained four-direction idle exports, independent heads/clothes, shared anchors and native game import metadata. Other three designs are unchanged. New versioned filenames and manifest/script keys prevent stale keeper artwork.

# Reusable role character kit — 6 October 2026

- Generated six separate four-direction face/outfit designs: movement assassin, fatherly Home mentor, battle-ready Game veteran, Rankings chronicler, Download courier and bank steward.
- New compact96x640 idle sheets replace the matching website keepers and tutorial guides. NPC consumers explicitly use one idle column; existing player/enemy walk sheets remain unchanged. Home/demo share loaded NPC images when possible. All six runtime sheets total about1.4MiB decoded RGBA.
- Delivered separate head/clothing layers, per-direction images, combined previews and native60x64 body/32x24 head cells with direction/anchor manifests. Body/head anchors(30,64)/(16,24), proposed head_offset_y=-54. Production import still needs GRH IDs and engine verification.
- These are idle sets only; no fake repeated walk frames. Sources and normalization scripts are included in the reusable kit.
- Checked all cardinal previews, source alpha/feet alignment, exact layer recomposition, runtime asset identities and native registration. Full Node suite and canvas renders checked; no live engine import or physical-browser QA claimed.

# Keyboard focus on entry — 6 October 2026

- The parent hands desktop focus to the visible loaded demo iframe on cold entry and reentry. The demo focuses its canvas when ready/activated and after finishing an NPC conversation or closing the character editor.
- Focus is guarded while hidden, suspended, paused, returning, inside a modal or using coarse-pointer controls. No keyboard forwarding or extra timers were added.
- Regression coverage includes activation before/after artwork loads, movement without clicking, NPC continuation, reentry, hidden-frame readiness and modal/phone safeguards.

# Hallway alignment correction — 6 October 2026

- One shared hallway geometry now drives the floor, carpet, columns, portal and traversal bounds. The carpet is vertically centered on the floor and horizontally centered on the floor.
- All four column bases are inside the floor, clear of the outside wall caps. The one-tile upward placement is retained.
- A newly generated orthographic edge-on portal replaces the diagonal design. The straight sprite is 36 x 276, rendered at native proportions within the room; every row crosses at x528.
- Hall camera framing fits the full vertical scene on short windows. Pointer-to-world conversion follows that camera, while arena camera and casting behavior remain unchanged. Removed the redundant world title that could clip.
- Regression checks include column/base bounds, carpet margins, portal bounds, short-window framing and transformed floor clicks. Native-canvas views at desktop, short and phone dimensions were inspected; full browser/device QA remains separate.

# Enclosed hallway and guided prompts — 6 October 2026

- Follow-up correction: unseen guides now prompt automatically only when movement reaches their position. Floor clicks still issue walking orders and never directly open the nearest unrelated guide. Learned guides do not interrupt again; explicit clicks/E can replay them.
- The surrounding extension is solid masonry with a bounded recessed floor and raised wall edges. Removed the flat green strips. Column sprites sit exactly one 32-unit tile higher.
- Corridor-spanning side-facing portal revision uses a newly generated sprite rather than stretching the old narrow door.

# Hallway sprites and click navigation — 6 October 2026

- Replaced flat carpet, column and gate primitives with generated, transparent dark-fantasy pixel-art sprites. The portal faces the left-to-right approach, rather than facing the viewer. The runtime crops occupy under 250 KiB RGBA; the full source atlas is not deployed.
- Hall masonry now fills the current viewport on wide and tall displays, eliminating the empty dark bands without enlarging the canvas backing store or adding a second scene canvas.
- Normal floor clicks/taps queue bounded cardinal navigation. Keyboard/thumbstick input overrides it. Prepared spell clicks cast exclusively, including failed casts; Prepare again or Escape cancels aiming.
- Guide dialogues open through an explicit NPC sprite click, E, or Talk. Distant NPC clicks approach before talking; passive proximity never opens a modal.
- Click routes use existing model footsteps/collisions and respect the revealed bank. Per-click path search is bounded, and obstruction cancels rather than continuously replanning. Lifecycle interruptions, conversations, preparation and death clear orders.
- Tutorial copy and Controls explain walking versus casting. Generated assets and their brief are also delivered as a ZIP.
- Validation: full Node suite, JS syntax checks and diff whitespace checks; native-canvas renders examined at desktop and phone dimensions. This is not full browser/device interaction or memory profiling.

# Motion and presentation refinement — 6 October 2026

User requested better animations and fluidity, with animejs.com as inspiration. Consulted its Timeline and Easings documentation. This version uses native Web Animations rather than downloading the library: speaker/page-keyed staggered dialogue, portrait cards, stable text areas, progress rail, an opening beat, coordinated arena reveal, localized bank materialization, and an essence-secured completion beat before the final Keeper explanation. Hall masonry, alcoves, runner and torch pools are drawn with existing art and one canvas.

Motion handles are bounded by animated elements, cancelled on return/suspension/recovery/replay, and honor reduced motion. No extra render loop, full-screen blur, snapshot canvas or animation dependency was added. Combat/input pause during the short arena cue; clear resume rules keep repeated visits working.

144 automated checks pass, including animation cancellation, reduced motion, dialogue-key idempotence and simulation pause/release. Headless browser visual QA could not launch: the cloud runtime rejects Chromium's process socket even on the approved execution path. This is not rendered acceptance or a real-iPhone crash test. Existing memory hardening and sharing remain intact.

References: https://animejs.com/documentation/timeline/ and https://animejs.com/documentation/easings/

# Current update — guided tutorial and transition memory (6 October 2026)

The published demo now starts in a safe stone hallway, with three NPC conversations for movement, combat and essence. Walking through the far entrance after all three conversations enters the arena. After two defeats a bank appears at the closest reviewed, unoccupied candidate. A 90-second arena-time fallback prevents quiet-round banking from staying locked. Complete a positive transfer of all carried essence to finish; dying after a partial deposit does not count. The Keeper then explains the provisional match rules. Replay and Home remain available.

Source re-read: user-supplied rao-diseno-pvp.pdf, especially pages 9–10, 14 and 21. Generation, pickup/transfer, carried and deposited value remain distinct. The generation budget, deposited target and match timeout are described as proposed/TBD, not fixed production rules. This update does not implement a multiplayer economy or permanently credit any account.

Memory hardening: one reused iframe; Home canvas/ground released while demo is active; demo surfaces released on host suspension; embedded startup suspended until activation; Home unchanged-size resize guards; each visible world canvas limited to roughly 2 million backing pixels and DPR 1.5; sequential demo asset loads; shared Home sprite objects reused; bank/crystal cropped and reduced to small ImageBitmaps when supported; opaque scene-filter transitions replaced with opacity-only effects; no animation loop while paused/in NPC dialogue or idle at completion; character editor duplicate-open guard. Fallback browsers retain original images. These are verified code/allocation changes, not measured iOS peak-memory savings or a reproduced fix of the reported browser crash.

Validation: 138 automated model, mocked-DOM and lifecycle checks passing, including tutorial traversal, bank reveal/time fallback, interrupted transfer/death, positive completion, phone controls and repeated Home/demo navigation. JavaScript syntax and whitespace checks pass. Real browser/iPhone visual and memory-pressure testing remains unverified: this environment has no supported cloud browser preview capability for this static Site. No assertion of zero crashes.

Earlier notes below are historical and may describe superseded onboarding.

---

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

## Underfoot mana bar — October 5

- Added blue mana immediately beneath player life bar, reading the live mana value. Reuses the same bounded resource-bar drawing as life; bots do not fabricate a mana resource they do not simulate.
- 117 automated tests pass including position, fill fraction and blue colour. User explicitly requested publication.

## Softer home popup — October 5

- Zone dialog/backdrop reveal 650ms to 1100ms; panel-content transition 220ms to 650ms.
- Mobile popup background opacity 94% to 84%; lighter backdrop. Text remains opaque and reduced-motion overrides remain intact.
- 118 tests pass. User requested publication alongside the change.

## Redesigned houses and floors — October 5

- Replaced the two Home buildings with the approved stone-step house and a muted slate-blue roof variant. Both use 480×683 art at the same 60-source-pixels/32-world-unit density (256×364.267 world footprint); no disproportionate stretching or smaller second house.
- Independent 60×60 wood tile fills the floor and two-tile entrance on the town grid. Building baselines use tile edges, while actor anchors stay on tile centres.
- Website obstacles now leave a two-tile entrance/steps recess between solid front walls, stopping before the roofed building body. This is a website collision model, not imported RAO game map collision or a new explorable interior.
- 119 automated tests pass, including house scale and blocked-wall/open-door checks; all referenced assets verified present, both house alpha masks identical. No physical iPhone/browser visual acceptance claimed.

## Walkable house and roof reveal — October 5

- Lowered entrance hood/lintel by 40 source pixels to roughly 9 world units over actual visible character height at the threshold. Main roof unchanged in proportion; exact separate roof, facade and stairs overlays recompose the full sprite.
- The accessible house has perimeter walls and a walkable 7×4 room, joined by its two-tile doorway. Generated warm-log interior includes a back-left stone fireplace based on RAO source references, with no invented furniture.
- Roof opacity follows player tile entry/exit, linearly to 0/1 in 0.22s, matching RAO RoofPresentationState duration and full fade. Local website region approximates the corresponding room/upper-door trigger zone, not a general RAO trigger importer. Reduced motion snaps.
- Ground floor/interior/stairs paint before actors; structural facade remains sorted; independent roof overlays fade. Fixes stair pixels occluding character.
- Moved decorative second house from east to x432,y640 so Game character/route stay clear; it remains closed/background while primary house is accessible.
- 122 automated tests pass including route through entrance, wall blocking, roof timing/reversal and reduced motion. Offline layered composition visually inspected. No live browser/iPhone acceptance claimed.

## Grounded house style — October 5

- Replaced the approved house surface art with muted weathered umber and slate variants, flatter shingles and more restrained wood/stone. Interior/floor palette adjusted to match, geometry/alpha preserved there.
- Door clearance reconciled to x270–389,y495–638; steps remain ground-layer y639 onward. Roof/facade/stair recomposition exact. Canvas480×683 remains; source-style candidate silhouette retains minor roof-peak differences from the previous artwork.
- Existing movement, collision, roof fade and accessibility behavior retained; 122 tests pass. Asset split and visual style inspected; no physical device acceptance claimed.

## Approved dark-slate replacement — October 6

- Supersedes the held, unpublished brown/chunky style candidate. Uses the approved thinner charcoal-slate / flat aged-timber / rough-stone design with fitted lintel sourcey503, exactly120px-wide clear opening and stairs639–682.
- Primary house maps to approved slate; decorative second uses restrained warmer variant. Full/roof/facade/stairs splits recombine exactly per staging QA; approved source comparison has identical visible pixels and alpha (one hidden RGB pixel differs).
- Independent source audit confirms original480×683 reference canvas, floor origin(30,322.5),7×4 interior topology and2tile door. Site uniform60/32 raster scaling retains0.5sourcepixel vertical rounding relative to original364worldheight. Website perimeter is simplified/clipped compared to original full-cell blocking extending30sourcepixels outsidecanvas; no actualRAO map changes or exactcollision-parity claim.
- 122 regression tests pass. Manifest assets verified and door/steps layering checked; no physical device visual acceptance.

# Modular registration and eyes — 6 October 2026

- Baked NPC images use a shared collar socket, rather than body bounding-box centres. Heads sit 4 source pixels lower into the collar; body scale and feet baseline are unchanged.
- Native kit export is generated from the same registered pixel grid, eliminating independently resampled heads. All 144 face/outfit/direction combinations have opaque neck overlap and exact full/native raster agreement.
- Reusable kit includes an independent face/outfit mixer and transparent layered exports. The website keeps compact precomposed idle sheets, adding no selection-related image allocations or per-frame composition.
- Stronger sclera/pupil clusters are evaluated after downscaling, not just in source portraits. All NPCs remain four-direction idle poses. This is not a RAO engine asset installation.
- Native-size eye QA remains incomplete: source whites improved, but some E/S/W views still lose them. This version is a saved draft, not a completed eye pass or production publication.

# Approved character publication — 6 October 2026

The user approved publishing the six corrected guides and their supplied mohawk as one roaming NPC. The mohawk walker uses the original body156 and staff17 layers, retaining idle plus all seven real walking drawings. The original combined rogue sheet was reconstructed with zero visible RGBA differences before substituting the head. Direction-specific staff ordering and per-frame origins are retained. The new head has at least36opaque overlap pixels at the collar in all32frames, with no new walk-frame generation.

The new walker uses body156's documented two-tile gait cycle. Other roaming actors are unchanged. Six guide images already contain the approved corrected alignment, faces and distinct clothing. This publication does not claim every eye refinement is complete or install any asset in the RAO repository.

The mohawk sheet is93,298compressed bytes and1,966,080decodedRGBA bytes, loaded once with existing scene assets; no extra timer or per-frame compositing is added.

# Mohawk fringe cleanup — 7 October 2026 Mallorca

Removed the neutral pale exterior residue from the user head source without repainting retained pixels. All eye regions and head geometry are unchanged. Pale boundary count is48→0 across four direction heads. Rebuilt all32walking cells from the same originalbody/staff; non-head pixels are byte-identical. Collar overlap remains at least35opaque pixels. The new cached sheet is93,067bytes and retains the same decoded memory budget.

# Outer world and the Wayfarer — 7 October 2026 Mallorca

The visible terrain now continues beyond the playable town instead of stopping at a dark rectangle. Source60PPT grass/path retain32world-unit tile size. Two tiny32×32 pattern canvases and a bounded/cullable set of exterior trees are used; the main ground bitmap remains1440×900, and the scene retains its2Mpixel/DPR cap. The ambient shade applies across the full view, avoiding an edge-colour seam. Physics bounds remain unchanged.

The Wayfarer appears once per page visit on deliberate outward exploration near the boundary, including blocked outward keys/clicks and reduced-motion/paused endpoints. Idle proximity, remote outside clicks, ordinary section navigation, portals, hidden pages and other dialogs do not summon it. The encounter cancels movement without old completion callbacks, can be dismissed with Escape or Stay, and offers one explicit View downloads action. The existing unavailable-download notice is truthful; no installer URL is invented. Mobile briefly frames the player and wizard, then restores the keeper overview.

The approved bearded user head is preserved byte-for-byte in its registered layer. A new generated dark-teal/gold magical tunic is fitted beneath it. The wizard is stationary, using four genuine idle views; no walking frames are claimed.

The mohawk’s body156 anatomical neck axes required X offsetsN/E/S/W=0,+2,+1,-4 rather than a universal centre. Its face pixels and vertical position are unchanged. All32walking views retain at least34opaque overlap pixels and their original body/staff composition.

Manual movement returns focus to the canvas. Keeper keyboard focus keeps underline/reticle cues without drawing the unwanted square around its label. All209tests pass; native-canvas desktop/mobile renders were inspected. Full browser/device layout QA remains unavailable in this environment.
