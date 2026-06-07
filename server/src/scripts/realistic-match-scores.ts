/** tier_id 1 = en güçlü, 5 = en zayıf */
export function tierStrength(tierId: number): number {
  return 6 - tierId;
}

export type MatchOutcome = 'home' | 'draw' | 'away';

export function pickMatchOutcome(homeTierId: number, awayTierId: number): MatchOutcome {
  const tierGap = Math.abs(homeTierId - awayTierId);
  const drawChance = [0.3, 0.27, 0.23, 0.18, 0.13][Math.min(tierGap, 4)] ?? 0.13;

  const homeEdge = tierStrength(homeTierId) + 0.3;
  const awayEdge = tierStrength(awayTierId);
  const homeWinShare = 0.5 + Math.tanh((homeEdge - awayEdge) * 0.45) * 0.44;

  const roll = Math.random();
  if (roll < drawChance) return 'draw';
  if (roll < drawChance + (1 - drawChance) * homeWinShare) return 'home';
  return 'away';
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function scoresForOutcome(outcome: MatchOutcome, tierGap: number): { homeScore: number; awayScore: number } {
  if (outcome === 'draw') {
    const roll = Math.random();
    if (roll < 0.32) return { homeScore: 0, awayScore: 0 };
    if (roll < 0.82) return { homeScore: 1, awayScore: 1 };
    if (roll < 0.97) return { homeScore: 2, awayScore: 2 };
    return { homeScore: 3, awayScore: 3 };
  }

  const blowoutChance = tierGap >= 3 ? 0.34 : tierGap >= 2 ? 0.22 : 0.1;
  let winnerGoals: number;
  let loserGoals: number;

  if (Math.random() < blowoutChance) {
    winnerGoals = tierGap >= 3 ? randomInt(3, 4) : randomInt(2, 3);
    loserGoals = randomInt(0, Math.min(1, winnerGoals - 1));
  } else {
    winnerGoals = randomInt(1, tierGap >= 2 ? 3 : 2);
    loserGoals = randomInt(0, Math.max(0, winnerGoals - 1));
  }

  if (outcome === 'home') {
    return { homeScore: winnerGoals, awayScore: loserGoals };
  }

  return { homeScore: loserGoals, awayScore: winnerGoals };
}

export function generateRealisticMatchScore(
  homeTierId: number,
  awayTierId: number,
): { homeScore: number; awayScore: number } {
  const tierGap = Math.abs(homeTierId - awayTierId);
  const outcome = pickMatchOutcome(homeTierId, awayTierId);
  return scoresForOutcome(outcome, tierGap);
}
