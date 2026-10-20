// The site's page scripts in public/ are still classic scripts that read these modules as globals.
// The site entry imports this before those deferred scripts run.
import * as character from './character.ts';
import * as physics from './physics.ts';

declare global {
  var WorldPhysics: typeof physics;
  var EntiaCharacter: typeof character;
}
window.WorldPhysics=physics;
window.EntiaCharacter=character;
