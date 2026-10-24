const assert = require('node:assert/strict');

// Combat fixtures complete the actual practice hit before entering the arena.
function completeSpells(M, state) {
  assert(M.startSpellPractice(state));
  state.armed = true;
  assert(M.cast(state, state.enemies[0]));
  for (let i = 0; i < 75; i++) M.update(state, 0.02);
  state.armed = true;
  assert(M.cast(state, state.enemies[0]));
  for (let i = 0; i < 75; i++) M.update(state, 0.02);
  state.armed = true;
  assert(M.cast(state, state.player));
  assert(M.spellPracticeComplete(state));
}
module.exports = function startCombat(M, state) {
  assert(M.startMeleePractice(state));
  state.player.x = 368;
  state.player.dir = 1;
  assert(M.melee(state));
  assert(M.meleePracticeHit(state));
  completeSpells(M, state);
  return M.startFight(state);
};
module.exports.completeSpells = completeSpells;
