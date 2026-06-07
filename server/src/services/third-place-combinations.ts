import combinations from '../data/wc2026-third-place-combinations.json' with { type: 'json' };
import type { ThirdPlaceWinnerSlot } from '../data/wc2026-knockout-bracket.js';

type CombinationRow = {
  no: number;
  advancing: string[];
  key: string;
  assignments: Record<ThirdPlaceWinnerSlot, string>;
};

const COMBINATIONS = combinations as CombinationRow[];

export function lookupThirdPlaceAssignments(advancingThirdGroups: string[]): Record<ThirdPlaceWinnerSlot, string> {
  if (advancingThirdGroups.length !== 8) {
    throw new Error('En iyi 8 üçüncü belirlenmeden bracket çözülemez');
  }

  const key = [...advancingThirdGroups].sort().join('');
  const row = COMBINATIONS.find((combo) => combo.key === key);
  if (!row) {
    throw new Error(`En iyi 3.ler kombinasyonu bulunamadı: ${advancingThirdGroups.join(', ')}`);
  }

  return row.assignments;
}

export function getCombinationNumber(advancingThirdGroups: string[]): number {
  const key = [...advancingThirdGroups].sort().join('');
  const row = COMBINATIONS.find((combo) => combo.key === key);
  if (!row) {
    throw new Error(`En iyi 3.ler kombinasyonu bulunamadı: ${advancingThirdGroups.join(', ')}`);
  }
  return row.no;
}
