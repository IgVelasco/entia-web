export const CLICK_MOVEMENT_STORAGE_KEY = 'entia-demo-click-movement-v1';

export function loadClickMovement(storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    return JSON.parse((storage || window.localStorage).getItem(CLICK_MOVEMENT_STORAGE_KEY) || 'true') !== false;
  } catch {
    return true;
  }
}

export function saveClickMovement(enabled: boolean, storage?: Pick<Storage, 'setItem'>): boolean {
  try {
    (storage || window.localStorage).setItem(CLICK_MOVEMENT_STORAGE_KEY, JSON.stringify(enabled));
    return true;
  } catch {
    return false;
  }
}
