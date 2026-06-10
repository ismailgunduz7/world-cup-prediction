import { supabase } from '../lib/config.js';

/**
 * Whether random mode is enabled for a given competition. Random mode is now a
 * per-competition toggle (`competitions.random_mode_enabled`). Users not
 * assigned to any competition can never use random mode.
 */
export async function isRandomModeEnabledForUser(competitionId: string | null): Promise<boolean> {
  if (!competitionId) return false;

  const { data, error } = await supabase
    .from('competitions')
    .select('random_mode_enabled')
    .eq('id', competitionId)
    .maybeSingle();

  if (error) throw error;
  return data?.random_mode_enabled === true;
}
