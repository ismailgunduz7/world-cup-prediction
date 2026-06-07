const STORAGE_PREFIX = 'selectionDraft:';

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadSelectionDraft(userId: string): number[] | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { teamIds?: unknown };
    if (!Array.isArray(parsed.teamIds)) return null;

    return parsed.teamIds.filter((id): id is number => typeof id === 'number' && Number.isInteger(id));
  } catch {
    return null;
  }
}

export function saveSelectionDraft(userId: string, teamIds: number[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify({ teamIds }));
}

export function clearSelectionDraft(userId: string) {
  localStorage.removeItem(storageKey(userId));
}
