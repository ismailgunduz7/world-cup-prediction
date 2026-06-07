import { Hono } from 'hono';
import { z } from 'zod';
import { supabase } from '../lib/config.js';
import { authMiddleware, participantMiddleware, type AppVariables } from '../middleware/auth.js';
import {
  WC2026_KNOCKOUT_BRACKET,
  type BracketSlot,
  type ThirdPlaceWinnerSlot,
} from '../data/wc2026-knockout-bracket.js';
import { getCombinationNumber, lookupThirdPlaceAssignments } from '../services/third-place-combinations.js';

const bracketRoutes = new Hono<{ Variables: AppVariables }>();

bracketRoutes.use('*', authMiddleware, participantMiddleware);

const previewSchema = z.object({
  // Her grup için 1. → 4. sırada takım id'leri (4 takım).
  groupRankings: z.record(z.string().length(1), z.array(z.number().int().positive()).length(4)),
  // 3.lükten çıkan 8 grubun kodu.
  thirdGroupCodes: z
    .array(z.string().length(1))
    .length(8)
    .refine((codes) => new Set(codes.map((c) => c.toUpperCase())).size === codes.length, {
      message: 'Aynı grup birden fazla seçilemez',
    }),
});

/**
 * Skorlardan tamamen bağımsız, salt-okunur bracket önizlemesi.
 * Kullanıcının tahmin ettiği grup sıralamaları + en iyi 8 üçüncüye göre
 * Son 32 eşleşmelerini çözer. Veritabanına hiçbir şey yazmaz, puanları etkilemez.
 */
bracketRoutes.post('/preview', async (c) => {
  const body = await c.req.json();
  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Geçersiz bracket verisi' }, 400);
  }

  const groupRankings = Object.fromEntries(
    Object.entries(parsed.data.groupRankings).map(([code, ids]) => [code.toUpperCase(), ids]),
  );
  const thirdGroupCodes = parsed.data.thirdGroupCodes.map((code) => code.toUpperCase());

  let thirdAssignments: Record<ThirdPlaceWinnerSlot, string>;
  let combinationNo: number;
  try {
    thirdAssignments = lookupThirdPlaceAssignments(thirdGroupCodes);
    combinationNo = getCombinationNumber(thirdGroupCodes);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Kombinasyon çözülemedi' }, 400);
  }

  const allIds = new Set<number>();
  for (const ids of Object.values(groupRankings)) ids.forEach((id) => allIds.add(id));

  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name_tr')
    .in('id', [...allIds]);

  if (error) throw error;
  const nameMap = new Map((teams ?? []).map((t) => [t.id, t.name_tr]));

  const winners = new Map<string, number>();
  const runnersUp = new Map<string, number>();
  const thirds = new Map<string, number>();
  for (const [code, ids] of Object.entries(groupRankings)) {
    if (ids[0] != null) winners.set(code, ids[0]);
    if (ids[1] != null) runnersUp.set(code, ids[1]);
    if (ids[2] != null) thirds.set(code, ids[2]);
  }

  function resolveTeam(slot: BracketSlot): { teamId: number; name: string } | null {
    if (/^W\d+$/.test(slot) || /^L\d+$/.test(slot)) return null;

    if (slot.startsWith('3@')) {
      const winnerSlot = slot.slice(2) as ThirdPlaceWinnerSlot;
      const group = thirdAssignments[winnerSlot];
      const teamId = thirds.get(group);
      return teamId != null ? { teamId, name: nameMap.get(teamId) ?? '—' } : null;
    }

    const rank = Number(slot[0]);
    const group = slot.slice(1);
    const teamId = rank === 1 ? winners.get(group) : runnersUp.get(group);
    return teamId != null ? { teamId, name: nameMap.get(teamId) ?? '—' } : null;
  }

  const matches = WC2026_KNOCKOUT_BRACKET.map((t) => ({
    number: t.number,
    stage: t.stage,
    roundLabel: t.roundLabel,
    homeSlot: t.homeSlot,
    awaySlot: t.awaySlot,
    home: resolveTeam(t.homeSlot),
    away: resolveTeam(t.awaySlot),
  }));

  return c.json({ combinationNo, thirdAssignments, matches });
});

export default bracketRoutes;
