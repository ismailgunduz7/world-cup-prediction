import { getConfigValue } from './tournament-config.js';

/**
 * Global feature flag for random mode, stored under the `random_mode` config key.
 * Defaults to enabled when the row is missing.
 */
export async function isRandomModeEnabled(): Promise<boolean> {
  const value = await getConfigValue<{ enabled: boolean }>('random_mode', { enabled: true });
  return value.enabled !== false;
}
