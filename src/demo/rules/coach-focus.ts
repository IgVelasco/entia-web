import type { CombatLessonId } from './combat-lessons.ts';
import type { MacroAction } from './macros.ts';
import type { DemoState } from './state.ts';

const focuses: Record<CombatLessonId, { action: MacroAction; resource: 'mana' | 'health'; condition: string }> = {
  precision: { action: 'apocalipsis', resource: 'mana', condition: 'Preparar → clic en el casillero del rival' },
  miss: { action: 'apocalipsis', resource: 'mana', condition: 'Sin objetivo válido → no gasta maná' },
  mana: { action: 'mana', resource: 'mana', condition: 'Maná insuficiente → usar una poción' },
  apocalipsis: { action: 'apocalipsis', resource: 'mana', condition: 'Acierto en el rival → daño y −15 de maná' },
  inmovilizar: { action: 'inmovilizar', resource: 'mana', condition: 'Rival inmovilizado → todavía puede lanzar' },
  remover: { action: 'remover', resource: 'mana', condition: 'Remover sobre vos → movimiento y −10 de maná' },
  enemyRemover: { action: 'remover', resource: 'mana', condition: 'Objetivo enemigo → Remover no permitido' },
  receivedApocalipsis: { action: 'life', resource: 'health', condition: 'Te acertaron → −12 de vida' },
  receivedInmovilizar: {
    action: 'remover',
    resource: 'mana',
    condition: 'Inmovilizado + 10 de maná → Remover sobre vos',
  },
  enemyMiss: { action: 'life', resource: 'health', condition: 'Otro casillero → sin efecto sobre vos' },
  enemyCleanse: { action: 'remover', resource: 'mana', condition: 'Remover propio → el rival vuelve a moverse' },
};
export function coachFocus(s: DemoState, id: CombatLessonId) {
  const focus = { ...focuses[id] };
  if (id === 'miss' && (s.selectedSpell === 'remover' || s.selectedSpell === 'inmovilizar'))
    focus.action = s.selectedSpell;
  if (id === 'receivedInmovilizar' && s.player.mana < 10) {
    focus.action = 'mana';
    focus.condition = 'Inmovilizado y sin maná → poción, después Remover';
  }
  const enemy = s.enemies.find((actor) => actor.name === s.tutorial?.coach?.subject);
  return {
    ...focus,
    actor: enemy || s.player,
    label: enemy
      ? enemy.hp > 0
        ? `Rival: ${enemy.name}`
        : 'Rival derrotado · este casillero'
      : s.player.immobilized > 0
        ? 'Tu personaje · inmovilizado'
        : 'Tu personaje',
  };
}
