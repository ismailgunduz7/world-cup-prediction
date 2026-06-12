import { Hono } from 'hono';
import { getBetProgressSummary } from '../services/bet-progress-service.js';

const betProgressRoutes = new Hono();

betProgressRoutes.get('/', async (c) => {
  const summary = await getBetProgressSummary();
  return c.json(summary);
});

export default betProgressRoutes;
