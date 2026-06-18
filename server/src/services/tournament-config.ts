import { supabase } from '../lib/config.js';
import type { TournamentConfigRow } from '../lib/types.js';

const CONFIG_CACHE_TTL_MS = 60_000;

let tournamentStartAtCache: { value: Date | null; expiresAt: number } | null = null;
let selectionLockAtCache: { value: Date | null; expiresAt: number } | null = null;

export function invalidateTournamentConfigCache(): void {
  tournamentStartAtCache = null;
  selectionLockAtCache = null;
}

export async function getConfigValue<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await supabase
    .from('tournament_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  if (!data) return fallback;
  return data.value as T;
}

export async function setConfigValue(key: string, value: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('tournament_config')
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) throw error;
  invalidateTournamentConfigCache();
}

async function computeSelectionLockAt(): Promise<Date | null> {
  const lockConfig = await getConfigValue<{ mode: string; offset_hours: number }>(
    'selection_lock',
    { mode: 'before_first_match', offset_hours: 1 },
  );

  if (lockConfig.mode === 'manual') {
    const manual = await getConfigValue<{ locked_at: string | null }>('selection_lock_manual', {
      locked_at: null,
    });
    return manual.locked_at ? new Date(manual.locked_at) : null;
  }

  const { data: firstMatch, error } = await supabase
    .from('matches')
    .select('scheduled_at')
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (firstMatch?.scheduled_at) {
    const lockAt = new Date(firstMatch.scheduled_at);
    lockAt.setHours(lockAt.getHours() - (lockConfig.offset_hours ?? 1));
    return lockAt;
  }

  const tournamentStart = await getConfigValue<{ scheduled_at: string }>('tournament_start', {
    scheduled_at: '2026-06-11T19:00:00Z',
  });
  const lockAt = new Date(tournamentStart.scheduled_at);
  lockAt.setHours(lockAt.getHours() - (lockConfig.offset_hours ?? 1));
  return lockAt;
}

export async function getSelectionLockAt(): Promise<Date | null> {
  const now = Date.now();
  if (selectionLockAtCache && selectionLockAtCache.expiresAt > now) {
    return selectionLockAtCache.value;
  }

  const value = await computeSelectionLockAt();
  selectionLockAtCache = { value, expiresAt: now + CONFIG_CACHE_TTL_MS };
  return value;
}

export async function areSelectionsLocked(): Promise<boolean> {
  const lockAt = await getSelectionLockAt();
  if (!lockAt) return false;
  return Date.now() >= lockAt.getTime();
}

async function computeTournamentStartAt(): Promise<Date | null> {
  const { data: firstMatch, error } = await supabase
    .from('matches')
    .select('scheduled_at')
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (firstMatch?.scheduled_at) {
    return new Date(firstMatch.scheduled_at);
  }

  const tournamentStart = await getConfigValue<{ scheduled_at: string }>('tournament_start', {
    scheduled_at: '2026-06-11T19:00:00Z',
  });
  return new Date(tournamentStart.scheduled_at);
}

export async function getTournamentStartAt(): Promise<Date | null> {
  const now = Date.now();
  if (tournamentStartAtCache && tournamentStartAtCache.expiresAt > now) {
    return tournamentStartAtCache.value;
  }

  const value = await computeTournamentStartAt();
  tournamentStartAtCache = { value, expiresAt: now + CONFIG_CACHE_TTL_MS };
  return value;
}

export async function hasTournamentStarted(): Promise<boolean> {
  const startAt = await getTournamentStartAt();
  if (!startAt) return false;
  return Date.now() >= startAt.getTime();
}

export async function getAllConfig(): Promise<TournamentConfigRow[]> {
  const { data, error } = await supabase.from('tournament_config').select('*').order('key');
  if (error) throw error;
  return data ?? [];
}
