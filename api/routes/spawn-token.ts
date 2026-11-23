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
  // The extension forwards the user's spawnRate slider. Clamp it so a modified
  // client can only slow spawning down, never speed it up. An active schedule
  // is returned unchanged, so a rate change applies from the next balloon.
  const rawRate = req.query['spawn-rate'];
  const parsedRate = typeof rawRate === 'string' ? Number(rawRate) : NaN;
  const spawnRate =
    Number.isFinite(parsedRate) && parsedRate > 0
      ? Math.min(1, Math.max(0.1, parsedRate))
      : 1;

  // Returns the user's active schedule. Repeated calls while a schedule is
  // active return the same token and spawn time (idempotent).
  const schedule = await getOrCreateSpawnSchedule(req.jwt!.id, spawnRate);

  res.json({
    // Lets the client correct for clock skew: all timestamps below are on the
    // server's clock, while browser alarms run on the client's clock.
    serverTime: Date.now(),
    spawnToken: schedule.token,
    balloonType: schedule.balloonName,
    spawnAt: schedule.spawnAt.getTime(),
    expiresAt: schedule.expiresAt.getTime(),
  });
});

export default router;
