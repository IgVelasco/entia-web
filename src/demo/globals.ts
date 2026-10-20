// demo.js is still a classic script that reads the game rules as a global.
// The demo entry imports this before that deferred script runs.
import rules from './rules/navigation.ts';

declare global {
  var EssenceDemo: typeof rules;
}
window.EssenceDemo=rules;
