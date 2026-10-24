const assert = require('node:assert/strict');

// Combat fixtures complete the actual practice hit before entering the arena.
module.exports = function startCombat(M, state) {
  assert(M.startMeleePractice(state));
  state.player.x = 368;
  state.player.dir = 1;
  assert(M.melee(state));
  assert(M.meleePracticeHit(state));
  return M.startFight(state);
};
