import type { BracketMatch, BracketStage, BracketTeam, ResolvedMatch } from '@/types/bracket';

export const STAGE_ORDER: BracketStage[] = [
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
];

export const STAGE_LABELS: Record<BracketStage, string> = {
  round_of_32: 'Son 32',
  round_of_16: 'Son 16',
  quarter_final: 'Çeyrek Final',
  semi_final: 'Yarı Final',
  third_place: '3.lük Maçı',
  final: 'Final',
};

/**
 * Bracket'i, kullanıcının kazanan tahminlerini (winners: maçNo → takımId)
 * uygulayarak çözer. Maçlar numara sırasına göre işlenir; her tur bir önceki
 * turun çıktısına dayandığı için tek geçiş yeterlidir.
 */
export function resolveBracket(
  matches: BracketMatch[],
  winners: Record<number, number>,
): Map<number, ResolvedMatch> {
  const resolved = new Map<number, ResolvedMatch>();
  const ordered = [...matches].sort((a, b) => a.number - b.number);

  function fromSlot(slot: string): { team: BracketTeam | null; label: string } {
    const winMatch = slot.match(/^W(\d+)$/);
    if (winMatch) {
      const n = Number(winMatch[1]);
      const prev = resolved.get(n);
      const winnerId = winners[n];
      if (prev && winnerId != null) {
        const team =
          prev.home?.teamId === winnerId ? prev.home : prev.away?.teamId === winnerId ? prev.away : null;
        return { team, label: `M${n} kazananı` };
      }
      return { team: null, label: `M${n} kazananı` };
    }

    const lossMatch = slot.match(/^L(\d+)$/);
    if (lossMatch) {
      const n = Number(lossMatch[1]);
      const prev = resolved.get(n);
      const winnerId = winners[n];
      if (prev && winnerId != null && prev.home && prev.away) {
        const loser = prev.home.teamId === winnerId ? prev.away : prev.home;
        return { team: loser, label: `M${n} mağlubu` };
      }
      return { team: null, label: `M${n} mağlubu` };
    }

    return { team: null, label: slot };
  }

  for (const match of ordered) {
    const homeRes = match.home ? { team: match.home, label: match.home.name } : fromSlot(match.homeSlot);
    const awayRes = match.away ? { team: match.away, label: match.away.name } : fromSlot(match.awaySlot);

    const participants = [homeRes.team?.teamId, awayRes.team?.teamId];
    const declared = winners[match.number];
    const winnerTeamId = declared != null && participants.includes(declared) ? declared : null;

    resolved.set(match.number, {
      number: match.number,
      stage: match.stage,
      home: homeRes.team,
      away: awayRes.team,
      homeLabel: homeRes.label,
      awayLabel: awayRes.label,
      winnerTeamId,
    });
  }

  return resolved;
}

/** Tüm eleme maçlarında iki takım belli ve kazanan seçilmiş mi? */
export function isBracketFullyPicked(resolved: ResolvedMatch[]): boolean {
  if (resolved.length === 0) return false;
  return resolved.every((m) => m.home != null && m.away != null && m.winnerTeamId != null);
}

export function countUnpickedBracketMatches(resolved: ResolvedMatch[]): number {
  return resolved.filter((m) => m.home == null || m.away == null || m.winnerTeamId == null).length;
}

/**
 * Geçersiz kalan kazanan tahminlerini temizler: bir üst turdaki değişiklik
 * sonucu artık o maçta yer almayan bir takım "kazanan" olarak işaretliyse silinir.
 * Yalnızca eleme yaptığı için yinelemeli olarak kararlı noktaya yakınsar.
 */
export function pruneWinners(
  matches: BracketMatch[],
  winners: Record<number, number>,
): Record<number, number> {
  let current = { ...winners };
  for (;;) {
    const resolved = resolveBracket(matches, current);
    let changed = false;
    for (const match of matches) {
      if (current[match.number] != null && resolved.get(match.number)?.winnerTeamId == null) {
        delete current[match.number];
        changed = true;
      }
    }
    if (!changed) return current;
  }
}
