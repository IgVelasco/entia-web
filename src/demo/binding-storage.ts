import { assignMacro, bindingActions, emptyBindings, type MacroBindings } from './rules/macros.ts';

export const BINDINGS_STORAGE_KEY = 'entia-demo-bindings-v1';

export function decodeBindings(raw: string | null): MacroBindings {
  if (!raw) return emptyBindings();
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('bindings' in data))
      return emptyBindings();
    const source = data.bindings;
    if (!source || typeof source !== 'object' || Array.isArray(source)) return emptyBindings();
    const next = emptyBindings();
    for (const action of bindingActions) next[action] = '';
    for (const action of bindingActions) {
      if (!(action in source)) return emptyBindings();
      const key = (source as Record<string, unknown>)[action];
      if (typeof key !== 'string' || (key && assignMacro(next, action, key))) return emptyBindings();
    }
    return next;
  } catch {
    return emptyBindings();
  }
}
export function loadBindings(storage?: Pick<Storage, 'getItem'>): MacroBindings {
  try {
    return decodeBindings((storage || window.localStorage).getItem(BINDINGS_STORAGE_KEY));
  } catch {
    return emptyBindings();
  }
}
export function saveBindings(bindings: MacroBindings, storage?: Pick<Storage, 'setItem'>): boolean {
  try {
    (storage || window.localStorage).setItem(BINDINGS_STORAGE_KEY, JSON.stringify({ version: 1, bindings }));
    return true;
  } catch {
    return false;
  }
}
