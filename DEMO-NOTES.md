# Portal / essence demo — revised October 4

The real animated portal now stands in the Home town at world (1010,420). Walking through its opening, or using the accessible Walk into the portal button to walk there, loads demo/. The demo starts inside the training ground; its return portal leads back to Home.

## Interaction
- Nix and the demo share cardinal foot-level collision primitives. Pathfinding uses only orthogonal segments. Trees have trunk footprints, buildings have solid base footprints, portal pillars are solid, and actors block each other. Camera centers the player in the usable play area.
- In Nix: C arms a pointer spell, then click the desired ground point. Section buttons open their sections without automatically casting. Click open ground to walk via collision-aware routes.
- In the demo: move with WASD/arrows or the touch directional pad. Aim and click/tap to cast at that position, or press Space/Cast once using the pointer. Clicking a rival's visible body resolves to that rival's foot position. No nearest-rival fallback exists. Range and line of sight apply; a clicked actor receives damage immediately; ground clicks do not select a nearby actor. Each click/key press casts once, without hold-to-repeat.
- Defeated rivals drop essence as a ground item. Walk over it or press E within pickup reach. Player death also drops carried essence at the death location, allowing recovery. Secured essence remains safe.
- After the first pickup, the new essence-banking reliquary appears south of the return portal. E near it deposits carried essence after 1.5 seconds; movement, casting or damage cancels. Banking controls are absent before unlock.
- All three bots approach the player and telegraph melee attacks. They take two or three targeted hits and deal gentler damage.

## Scope
This is an explicitly labelled single-player tutorial, not production RAO mechanics or a backend integration. Rewards, health, enemies, the 60-essence goal and timings are illustrative. Reload/restart clears the demo, and no account persistence is implied.

## Artwork
Uses the site's approved improved actors, scenery, terrain and Apocalipsis sprites, plus the approved 240×320 portal animation. New transparent essence-bank artwork is generated in the reference style; its emerald center supplies the ground-item icon.

## Validation
Run node --test tests/*.test.cjs (59 tests). Tests cover cardinal motion for player and NPCs, source-driven camera positioning, collision tunnelling and actor occupancy, obstacle-aware pathfinding, portal reachability, pointer targeting, kill drops and exactly-once pickup, death drops/recovery, banking unlock/atomicity/cancellation, bot damage/dodging, pause and restart, and prior navigation regression cases. Controllers execute with mocked DOM/canvas. A deterministic simulation checks long-run bounds and nonnegative counters. Local cloud-browser preview was inaccessible and hosted page requires sign-in; real-browser visual/mobile QA remains unverified.

Portal entry expands an emerald light from its on-screen position before navigating; the demo reveals itself with a short matching dissolve. Reduced-motion skips both effects. Repeated entry is guarded.


## AO / RAO interaction alignment
Current website layout and improved RAO art are retained. Apocalipsis is prepared with C or the visible button, then cast on release-click at the explicitly targeted actor. Bare clicks inspect; successful and rejected targeting attempts disarm, and Escape cancels before pausing. Each attempt is one shot. Demo mana cost is 15, with sanctuary recovery and N meditation. Space strikes the facing neighbour, Q deliberately picks up nearby ground essence, WASD/arrows use latest-direction cardinal 32-unit steps. E remains a clearly labelled demo deposit/return convenience.

References inspected read-only:
- https://github.com/dcatanzaro/aoweb/blob/main/frontend/components/game/core/useRendererBootstrap.ts (release-click and clear targeting)
- https://github.com/dcatanzaro/aoweb/blob/main/frontend/lib/hotkeys.ts (WASD, Q, Space, N)
- https://github.com/dcatanzaro/aoweb/blob/main/frontend/components/game/core/useMovementSync.ts (cardinal tile movement)
- Local pinned RAO InputController.gd / InputEventController.gd / CombatActionController.gd: macro arms cursor; bare click does not attack; Escape cancels and facing governs melee

No AO Web code or artwork was copied. The supplied aoweb repository had no verified root licence; its runtime combat settings were not assumed to equal the older argentumonlineweb-cliente defaults. Tutorial cost, cooldown and bot balance remain illustrative rather than claimed server parity.

## Right-hand HUD, banking and casting rivals
Life/mana, carried/secured balances, a Spells/Inventory tabset and action buttons now live in the right-hand character panel. On narrow phones that panel is a right-hand drawer opened with Character; compact life/mana remains on the playfield. Full controls and instructions are in the pause/how-to-play dialog, automatically shown on entry. Gameplay pauses while those instructions are open.

Banking now opens a modal only within the shrine's demo range. It shows both balances, an editable integer amount, All and Confirm deposit. Pending deposits block repeat submissions. Partial deposits preserve the remainder; invalid/excess amounts and remote submissions are rejected. Closing before completion cancels without transferring essence. This adapts RAO's selection/quantity/feedback pattern; it is not a production essence-bank port or real server confirmation.

Bots launch telegraphed Apocalipsis casts at the player's marked location, for gentle 12-health hits with a 2.4-second recovery. The safe refuge remains protected. Player targets still take 2–3 successful hits. New low stone coffer and independent crystal assets replace the tall shrine and cropped crystal. The wide green sanctuary overlay is removed. The coffer is rendered from its tight source-object crop to avoid most of the generated outer halo; source alpha remains unchanged.

Final automated suite: 62 passing tests. Real-browser visual/mobile QA remains unverified. No connected multiplayer backend has been built or implied.
