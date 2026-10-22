import type { DemoState } from './state.ts';

export const combatLessons = {
  precision: {
    title: 'Un clic, un casillero',
    text: 'Estos hechizos son de puntería: no se cargan ni cubren un área. Prepará uno con Lanzar o su macro y hacé clic en el casillero que ocupa el personaje en ese instante. El cursor queda libre y no sigue al rival.',
    response:
      'Si errás, el cursor vuelve a normal. Prepará el hechizo otra vez para volver a intentar. Durante la recuperación todavía no se envía el intento y conservás el apuntado.',
  },
  miss: {
    title: 'El intento no acertó',
    text: 'El casillero elegido no tenía un objetivo válido. El intento terminó y el cursor volvió a normal; el hechizo no busca personajes cercanos ni afecta una zona.',
    response:
      'Volvé a preparar el hechizo y apuntá al casillero de los pies del rival. Un intento rechazado no gasta maná; un lanzamiento válido sí lo consume.',
  },
  mana: {
    title: 'Te falta maná',
    text: 'No se aplicó el hechizo porque tu maná no alcanza. Cada lanzamiento válido consume el costo que muestra la ventana de hechizos.',
    response:
      'Usá una poción de maná desde Inventario o su macro. También podés meditar estando quieto. Después prepará el hechizo nuevamente.',
  },
  apocalipsis: {
    title: 'Lanzaste Apocalipsis',
    text: 'Acertaste el casillero del rival: le quitaste vida y gastaste 15 de maná. El efecto aparece sobre el objetivo, sin carga ni daño de área.',
    response:
      'Seguí moviéndote. Revisá tu maná, usá una poción si hace falta y volvé a preparar el hechizo cuando termine su recuperación.',
  },
  inmovilizar: {
    title: 'Inmovilizaste al rival',
    text: 'Gastaste 20 de maná y el rival quedó sin poder desplazarse. Todavía puede mirar en las cuatro direcciones y lanzar hechizos, incluido Remover sobre sí mismo.',
    response:
      'Aprovechá para apuntar, pero seguí atento: inmovilizar no impide que el rival te ataque y puede liberarse.',
  },
  remover: {
    title: 'Te quitaste la inmovilización',
    text: 'Remover parálisis consumió 10 de maná y te devolvió el movimiento. Lo lanzaste sobre tu propio casillero.',
    response:
      'Movete para evitar el siguiente ataque. Si te falta maná, primero usá una poción: Remover también tiene un costo.',
  },
  enemyRemover: {
    title: 'No podés remover a un enemigo',
    text: 'Ese personaje es tu rival. Remover no puede quitarle la inmovilización: el intento fue rechazado, el cursor volvió a normal y no gastaste maná.',
    response:
      'En esta práctica, usá Remover sobre tu propio casillero cuando estés inmovilizado. Contra el enemigo, elegí Apocalipsis o Inmovilizar.',
  },
  receivedApocalipsis: {
    title: 'Te acertaron Apocalipsis',
    text: 'El rival acertó tu casillero y perdiste 12 de vida. Es daño directo: no deja una zona peligrosa en el suelo.',
    response:
      'Revisá tu vida y usá una poción de vida desde Inventario, Usar o su macro. Seguí moviéndote para dificultar el próximo acierto.',
  },
  receivedInmovilizar: {
    title: 'Te inmovilizaron',
    text: 'Tu posición quedó detenida. WASD o las flechas todavía permiten mirar en las cuatro direcciones, pero no avanzar. Podés seguir lanzando hechizos.',
    response:
      'Elegí Remover parálisis, apretá Lanzar o su macro y hacé clic en tu propio casillero. Cuesta 10 de maná: si no alcanza, usá primero una poción de maná.',
  },
  enemyMiss: {
    title: 'El rival falló su hechizo',
    text: 'El rival apuntó a otro casillero. No perdiste vida ni quedaste inmovilizado: los hechizos no afectan los casilleros de alrededor.',
    response:
      'Seguí cambiando de posición y controlá tu vida y maná. No hay una zona que debas esperar a que desaparezca.',
  },
  enemyCleanse: {
    title: 'El rival usó Remover',
    text: 'El rival se quitó su propia inmovilización y puede volver a caminar. Estar inmovilizado no le impedía lanzar.',
    response: 'Volvé a seguir sus movimientos con el cursor. Remover es para liberarse; no le hace daño a nadie.',
  },
} as const;
export type CombatLessonId = keyof typeof combatLessons;
export interface CombatCoach {
  enabled: boolean;
  seen: CombatLessonId[];
  current: CombatLessonId | null;
}
export const createCoach = (): CombatCoach => ({ enabled: true, seen: [], current: null });
export function teach(s: DemoState, id: CombatLessonId) {
  const coach = s.tutorial?.coach;
  if (!coach?.enabled || coach.current || coach.seen.includes(id)) return;
  coach.seen.push(id);
  coach.current = id;
}
export function dismissCombatLesson(s: DemoState) {
  if (s.tutorial?.coach) s.tutorial.coach.current = null;
}
export function skipCombatLessons(s: DemoState) {
  if (!s.tutorial?.coach) return;
  s.tutorial.coach.enabled = false;
  s.tutorial.coach.current = null;
}
