export const macroActions = ['apocalipsis', 'inmovilizar', 'remover', 'life', 'mana'] as const;
export type MacroAction = (typeof macroActions)[number];
export const otherActions = ['interact', 'pickup', 'use', 'strike', 'meditate', 'pause'] as const;
export const bindingActions = [...macroActions, ...otherActions] as const;
export type BindingAction = (typeof bindingActions)[number];
export type MacroBindings = Record<BindingAction, string>;
export const macroLabels: Record<BindingAction, string> = {
  apocalipsis: 'Apocalipsis',
  inmovilizar: 'Inmovilizar',
  remover: 'Remover parálisis',
  life: 'Poción de vida',
  mana: 'Poción de maná',
  interact: 'Hablar / recoger / interactuar',
  pickup: 'Recoger esencia (alternativa)',
  use: 'Usar objeto seleccionado',
  strike: 'Golpear',
  meditate: 'Meditar',
  pause: 'Pausar',
};
export const emptyBindings = (): MacroBindings => ({
  apocalipsis: '',
  inmovilizar: '',
  remover: '',
  life: '',
  mana: '',
  interact: 'e',
  pickup: 'q',
  use: 'u',
  strike: ' ',
  meditate: 'n',
  pause: 'p',
});
export const exampleBindings = (): MacroBindings => ({
  ...emptyBindings(),
  apocalipsis: 'c',
  inmovilizar: 'v',
  remover: 'r',
  life: 'f1',
  mana: 'f2',
});
const reserved = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'escape',
  'tab',
  'enter',
  'shift',
  'control',
  'alt',
  'meta',
  'f5',
  'f11',
  'f12',
]);
export function keyLabel(key: string) {
  return key === ' ' ? 'Espacio' : key ? key.toUpperCase() : 'Sin tecla';
}
export function bindingConflict(bindings: MacroBindings, action: BindingAction, key: string) {
  return bindingActions.find((other) => other !== action && bindings[other] === key.toLowerCase());
}
export function assignMacro(bindings: MacroBindings, action: BindingAction, key: string) {
  key = key.toLowerCase();
  if (reserved.has(key) || !(/^[a-z0-9]$/.test(key) || /^f([1-9]|10)$/.test(key) || key === ' '))
    return 'Esa tecla está reservada. Elegí otra letra, un número o una tecla F disponible.';
  const conflict = bindingConflict(bindings, action, key);
  if (conflict) return `${keyLabel(key)} ya está asignada a ${macroLabels[conflict]}.`;
  bindings[action] = key;
  return '';
}
export function macroForKey(bindings: MacroBindings, key: string) {
  return bindingActions.find((action) => bindings[action] && bindings[action] === key.toLowerCase());
}
