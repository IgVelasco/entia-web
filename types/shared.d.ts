// Globals shared by the site (index.html) and the demo (demo/index.html).
// world-physics.js also exports its API through module.exports, so its type is derived from the source.
declare var WorldPhysics: typeof import('../public/world-physics.js');

// character.js is a plain browser script with no module export, so its API is described here;
// the assignment in character.js is checked against this shape.
interface EntiaCharacterChoice { name: string; body: string }
interface EntiaCharacterLook { id: string; name: string; detail: string }
declare var EntiaCharacter: {
  get(): EntiaCharacterChoice;
  normalize(value: unknown): EntiaCharacterChoice;
  save(value: EntiaCharacterChoice): boolean;
  mount(options: { assets: string; onChange(value: EntiaCharacterChoice): void; onOpen(): void; onClose(): void }): void;
  looks: EntiaCharacterLook[];
};

interface Window {
  // Images the site has already decoded, keyed by asset name; the embedded demo reuses them through window.parent.
  EntiaArtwork?: Record<string, HTMLImageElement>;
}
