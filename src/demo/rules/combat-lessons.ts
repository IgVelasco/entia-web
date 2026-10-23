import type { DemoState } from './state.ts';

export const combatLessons = {
  precision: {
    title: 'Un clic, un casillero',
    text: 'Estos hechizos no se cargan ni cubren un área. Hacé clic sobre la figura visible del rival o el casillero de sus pies. El cursor queda libre.',
    response:
      'Prepará con Lanzar o tu macro y hacé clic. Si errás, prepará de nuevo; la recuperación conserva el apuntado.',
  },
  miss: {
    title: 'El intento no acertó',
    text: 'El casillero no tenía un objetivo válido. Volviste al cursor normal sin gastar maná.',
    response: 'Prepará de nuevo y hacé clic sobre el rival o sus pies, dentro del alcance y sin obstáculos.',
  },
  mana: {
    title: 'Te falta maná',
    text: 'No alcanzó el maná: el hechizo no se aplicó.',
    response: 'Usá la poción de maná resaltada. Después prepará y apuntá otra vez.',
  },
  apocalipsis: {
    title: 'Lanzaste Apocalipsis',
    text: 'Acertaste al rival resaltado: le quitaste vida y gastaste 15 de maná.',
    response: 'Seguí moviéndote y revisá tu maná antes de volver a lanzar.',
  },
  inmovilizar: {
    title: 'Inmovilizaste al rival',
    text: 'Gastaste 20 de maná. Ese rival no puede caminar, pero puede girar y lanzar.',
    response: 'Aprovechá para apuntar. Puede usar Remover sobre sí mismo y volver a moverse.',
  },
  remover: {
    title: 'Te quitaste la inmovilización',
    text: 'Remover sobre tu casillero gastó 10 de maná y recuperaste el movimiento.',
    response: 'Ya podés caminar. Movete para dificultar el siguiente acierto.',
  },
  enemyRemover: {
    title: 'No podés remover a un enemigo',
    text: 'El personaje resaltado es un rival: Remover no lo libera ni gasta maná.',
    response: 'Usalo sobre tus propios pies cuando estés inmovilizado y tengas al menos 10 de maná.',
  },
  receivedApocalipsis: {
    title: 'Te acertaron Apocalipsis',
    text: 'Acertaron tu casillero y perdiste 12 de vida. No queda una zona dañina.',
    response: 'Usá la poción de vida resaltada si hace falta y seguí moviéndote.',
  },
  receivedInmovilizar: {
    title: 'Te inmovilizaron',
    text: 'Tu personaje resaltado no puede avanzar. Todavía podés girar y lanzar.',
    response: 'Elegí Remover parálisis y lanzalo sobre tus pies. Cuesta 10 de maná; si falta, usá primero una poción.',
  },
  enemyMiss: {
    title: 'El rival falló su hechizo',
    text: 'El rival apuntó a otro casillero: no perdiste vida ni quedaste inmovilizado.',
    response: 'Seguí cambiando de posición. El hechizo no afecta los casilleros de alrededor.',
  },
  enemyCleanse: {
    title: 'El rival usó Remover',
    text: 'El rival resaltado se quitó su propia inmovilización y vuelve a caminar.',
    response: 'Seguí sus movimientos con el cursor. Remover libera; no hace daño.',
  },
} as const;
export type CombatLessonId = keyof typeof combatLessons;
export interface CombatCoach {
  enabled: boolean;
  seen: CombatLessonId[];
  current: CombatLessonId | null;
  subject?: string;
  // Gameplay freezes immediately; only the triggering visual plays before the card.
  revealRemaining?: number;
}
export const createCoach = (): CombatCoach => ({ enabled: true, seen: [], current: null });
export function teach(s: DemoState, id: CombatLessonId, subject = 'player') {
  const coach = s.tutorial?.coach;
  if (!coach?.enabled || coach.current || coach.seen.includes(id)) return;
  coach.seen.push(id);
  coach.current = id;
  coach.subject = subject;
  coach.revealRemaining = [
    'apocalipsis',
    'inmovilizar',
    'remover',
    'receivedApocalipsis',
    'receivedInmovilizar',
    'enemyMiss',
    'enemyCleanse',
  ].includes(id)
    ? 0.6
    : 0;
}
export function advanceCombatPresentation(s: DemoState, dt: number) {
  const coach = s.tutorial?.coach;
  if (!coach?.current || !coach.revealRemaining) return;
  const elapsed = Math.min(coach.revealRemaining, Math.max(0, Math.min(dt, 0.05)));
  coach.revealRemaining = Math.max(0, coach.revealRemaining - elapsed);
  for (const effect of s.fx) effect.age += elapsed;
  for (const damage of s.damageTexts) damage.age += elapsed;
}
export function dismissCombatLesson(s: DemoState) {
  if (!s.tutorial?.coach) return;
  s.tutorial.coach.current = null;
  s.tutorial.coach.revealRemaining = 0;
}
export function skipCombatLessons(s: DemoState) {
  if (!s.tutorial?.coach) return;
  s.tutorial.coach.enabled = false;
  s.tutorial.coach.current = null;
  s.tutorial.coach.revealRemaining = 0;
}
export function enableCombatLessons(s: DemoState) {
  if (s.tutorial) s.tutorial.coach = createCoach();
}
