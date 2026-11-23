import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getOrCreateSpawnSchedule } from '../utils';

const router = express.Router();

const spawnTokenLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 20,
  message: { error: 'Too many requests' },
  keyGenerator: (req) => req.jwt!.id,
});

router.use(spawnTokenLimiter);

router.get('/', async (req: Request, res: Response) => {
  // Returns the user's active schedule. Repeated calls while a schedule is
  // active return the same token and spawn time (idempotent).
  const schedule = await getOrCreateSpawnSchedule(req.jwt!.id);

  res.json({
    spawnToken: schedule.token,
    balloonType: schedule.balloonName,
    spawnAt: schedule.spawnAt.getTime(),
    expiresAt: schedule.expiresAt.getTime(),
  });
});

export default router;
