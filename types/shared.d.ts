// Globals shared by the site (index.html) and the demo (demo/index.html).
// WorldPhysics and EntiaCharacter are declared by src/shared/globals.ts, which each project includes.

interface Window {
  // Images the site has already decoded, keyed by asset name; the embedded demo reuses them through window.parent.
  EntiaArtwork?: Record<string, HTMLImageElement>;
}
