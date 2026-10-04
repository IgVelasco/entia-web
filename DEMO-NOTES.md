# Portal / essence demo — revised October 4

The real animated portal now stands in the Home town at world (1010,420). Walking through its opening, or using the accessible Walk into the portal button to walk there, loads demo/. The demo starts inside the training ground; its return portal leads back to Home.

## Interaction
- Nix and the demo share cardinal foot-level collision primitives. Pathfinding uses only orthogonal segments. Trees have trunk footprints, buildings have solid base footprints, portal pillars are solid, and actors block each other. Camera centers the player in the usable play area.
- In Nix: C arms a pointer spell, then click the desired ground point. Section buttons open their sections without automatically casting. Click open ground to walk via collision-aware routes.
- In the demo: move with WASD/arrows or the touch directional pad. Aim and click/tap to cast at that position, or hold Space/Cast using the pointer. Clicking a rival's visible body resolves to that rival's foot position. No nearest-rival fallback exists. Range and line of sight apply; strikes are delayed so moving targets can evade them.
- Defeated rivals drop essence as a ground item. Walk over it or press E within pickup reach. Player death also drops carried essence at the death location, allowing recovery. Secured essence remains safe.
- After the first pickup, the new essence-banking reliquary appears south of the return portal. E near it deposits carried essence after 1.5 seconds; movement, casting or damage cancels. Banking controls are absent before unlock.
- Melee bots pursue faster and telegraph attacks. The ranged keeper strafes and marks the ground before casting, giving a dodge window.

## Scope
This is an explicitly labelled single-player tutorial, not production RAO mechanics or a backend integration. Rewards, health, enemies, the 60-essence goal and timings are illustrative. Reload/restart clears the demo, and no account persistence is implied.

## Artwork
Uses the site's approved improved actors, scenery, terrain and Apocalipsis sprites, plus the approved 240×320 portal animation. New transparent essence-bank artwork is generated in the reference style; its emerald center supplies the ground-item icon.

## Validation
Run node --test tests/*.test.cjs (50 tests). Tests cover cardinal motion for player and NPCs, source-driven camera positioning, collision tunnelling and actor occupancy, obstacle-aware pathfinding, portal reachability, pointer targeting, kill drops and exactly-once pickup, death drops/recovery, banking unlock/atomicity/cancellation, bot damage/dodging, pause and restart, and prior navigation regression cases. Controllers execute with mocked DOM/canvas. A deterministic simulation checks long-run bounds and nonnegative counters. Local cloud-browser preview was inaccessible and hosted page requires sign-in; real-browser visual/mobile QA remains unverified.
