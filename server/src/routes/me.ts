import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, participantMiddleware, type AppVariables } from '../middleware/auth.js';
import { changePassword } from '../services/auth-service.js';
import { getDashboardData } from '../services/dashboard-service.js';

const meRoutes = new Hono<{ Variables: AppVariables }>();

meRoutes.use('*', authMiddleware);

meRoutes.get('/', (c) => c.json({ user: c.get('user') }));

meRoutes.get('/dashboard', participantMiddleware, async (c) => {
  const user = c.get('user');
  const data = await getDashboardData(user.id);
  return c.json(data);
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128),
});

meRoutes.put('/password', async (c) => {
  const body = await c.req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Geçersiz şifre bilgileri' }, 400);
  }

  try {
    const user = c.get('user');
    await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
    return c.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Şifre değiştirilemedi';
    const status = message === 'Mevcut şifre hatalı' ? 401 : 400;
    return c.json({ error: message }, status);
  }
});

export default meRoutes;
