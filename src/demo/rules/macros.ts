export const macroActions = ['apocalipsis', 'inmovilizar', 'remover', 'life', 'mana'] as const;
export type MacroAction = (typeof macroActions)[number];
export type MacroBindings = Record<MacroAction, string>;
export const macroLabels: Record<MacroAction, string> = {
  apocalipsis: 'Apocalipsis',
  inmovilizar: 'Inmovilizar',
  remover: 'Remover parálisis',
  life: 'Poción de vida',
  mana: 'Poción de maná',
};
export const emptyBindings = (): MacroBindings => ({
  apocalipsis: '',
  inmovilizar: '',
  remover: '',
  life: '',
  mana: '',
});
export const exampleBindings = (): MacroBindings => ({
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
  ' ',
  'e',
  'q',
  'u',
  'n',
  'p',
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
  return key ? key.toUpperCase() : 'Sin tecla';
}
export function assignMacro(bindings: MacroBindings, action: MacroAction, key: string) {
  key = key.toLowerCase();
  if (reserved.has(key) || !(/^[a-z0-9]$/.test(key) || /^f([1-9]|10)$/.test(key)))
    return 'Esa tecla está reservada. Elegí otra letra, un número o una tecla F disponible.';
  const conflict = macroActions.find((other) => other !== action && bindings[other] === key);
  if (conflict) return `${keyLabel(key)} ya está asignada a ${macroLabels[conflict]}.`;
  bindings[action] = key;
  return '';
}
export function macroForKey(bindings: MacroBindings, key: string) {
  return macroActions.find((action) => bindings[action] && bindings[action] === key.toLowerCase());
}
