import { Hono } from 'hono';
import { z } from 'zod';
import { supabase } from '../lib/config.js';
import { authMiddleware, participantMiddleware, type AppVariables } from '../middleware/auth.js';
import { areSelectionsLocked } from '../services/tournament-config.js';

const MAX_SELECTIONS = 3;

const selectionRoutes = new Hono<{ Variables: AppVariables }>();

selectionRoutes.use('*', authMiddleware, participantMiddleware);

selectionRoutes.get('/mine', async (c) => {
  const user = c.get('user');
  const locked = await areSelectionsLocked();

  const { data, error } = await supabase
    .from('team_selections')
    .select('team_id')
    .eq('user_id', user.id)
    .order('selected_at');

  if (error) throw error;

  const teamIds = (data ?? []).map((s) => s.team_id);

  return c.json({ teamIds, selectionsLocked: locked, maxSelections: MAX_SELECTIONS });
});

selectionRoutes.put('/', async (c) => {
  const user = c.get('user');
  const locked = await areSelectionsLocked();

  if (locked) {
    return c.json({ error: 'Seçimler kilitlendi, artık değiştirilemez' }, 403);
  }

  const schema = z.object({
    teamIds: z.array(z.number().int().positive()).length(MAX_SELECTIONS),
  });

  const body = await c.req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: `Tam olarak ${MAX_SELECTIONS} takım seçmelisiniz` }, 400);
  }

  const uniqueIds = new Set(parsed.data.teamIds);
  if (uniqueIds.size !== MAX_SELECTIONS) {
    return c.json({ error: 'Aynı takımı birden fazla seçemezsiniz' }, 400);
  }

  const { data: teams, error: teamError } = await supabase
    .from('teams')
    .select('id')
    .in('id', parsed.data.teamIds)
    .eq('is_active', true);

  if (teamError) throw teamError;
  if ((teams ?? []).length !== MAX_SELECTIONS) {
    return c.json({ error: 'Geçersiz takım seçimi' }, 400);
  }

  // Atomic delete + insert via a DB function so a failure can't leave the
  // user with zero selections.
  const { error: rpcError } = await supabase.rpc('set_team_selections', {
    p_user_id: user.id,
    p_team_ids: parsed.data.teamIds,
  });

  if (rpcError) throw rpcError;

  const { data, error } = await supabase
    .from('team_selections')
    .select('team_id')
    .eq('user_id', user.id)
    .order('selected_at');

  if (error) throw error;

  return c.json({ teamIds: (data ?? []).map((s) => s.team_id), selectionsLocked: false });
});

export default selectionRoutes;
