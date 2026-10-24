export const CLICK_MOVEMENT_STORAGE_KEY = 'entia-demo-click-movement-v1';

export function loadClickMovementChoice(storage?: Pick<Storage, 'getItem'>): boolean | null {
  try {
    const choice: unknown = JSON.parse((storage || window.localStorage).getItem(CLICK_MOVEMENT_STORAGE_KEY) || 'null');
    return typeof choice === 'boolean' ? choice : null;
  } catch {
    return null;
  }
}

export function loadClickMovement(storage?: Pick<Storage, 'getItem'>): boolean {
  return loadClickMovementChoice(storage) ?? true;
}

export function saveClickMovement(enabled: boolean, storage?: Pick<Storage, 'setItem'>): boolean {
  try {
    (storage || window.localStorage).setItem(CLICK_MOVEMENT_STORAGE_KEY, JSON.stringify(enabled));
    return true;
  } catch {
    return false;
  }
}
