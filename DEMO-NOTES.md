# Portal / essence demo

Open dist/demo/index.html through an HTTP server. The existing homepage links into it.

Artwork reuses Entia's shipped improved actor, terrain, scenery and Apocalipsis assets. Portal uses the previously approved 240×320, eight-frame animation.

This is an explicitly labelled single-player tutorial, not production RAO mechanics or a backend integration. Enemy values, rewards, full carried loss and the 60-essence tutorial target are demonstrative. Secured essence survives defeat, but resets on reload/restart; no account persistence is represented.

Player movement uses radius-expanded scenery/arch footprints with substeps and axis sliding. Actors also block each other. Tree crowns overlap visually and are not solid walls. Spell targeting checks range and line of sight. Banking cancels on movement, distance or casting; completion transfers once. Losing focus or hiding the page pauses gameplay and clears held input. Keyboard and touch controls are supported.

Validation: node --test tests/*.test.cjs. Includes pre-existing navigation regression tests, collision tunnelling, actor occupancy, line-of-sight, reward deduplication, deposit cancellation/atomicity, death/secured preservation, restart and a deterministic 240-second simulation. Controller smoke executes actual loading, draw, HUD and pause/restart code with mocked DOM/canvas.
