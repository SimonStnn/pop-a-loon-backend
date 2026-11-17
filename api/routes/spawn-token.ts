import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { generateSpawnToken, selectBalloonType } from '../utils';

const router = express.Router();

const SPAWN_TOKEN_TTL_MS = 30 * 1000; // 30 seconds (balloon lifetime)
const DEFAULT_NEXT_SPAWN_MS = 10 * 60 * 1000; // 10 minutes

const spawnTokenLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 5,
  message: { error: 'Too many requests' },
  keyGenerator: (req) => req.jwt!.id,
});

router.use(spawnTokenLimiter);

router.get('/', async (req: Request, res: Response) => {
  const userId = req.jwt!.id;

  // Select a balloon type based on spawn_chance and season
  const balloon = await selectBalloonType();

  const now = Date.now();
  const nextSpawnAt = now + DEFAULT_NEXT_SPAWN_MS;

  // Generate spawn token
  const token = await generateSpawnToken(userId, balloon._id, nextSpawnAt);

  res.json({
    spawnToken: token,
    balloonType: balloon.name,
    expiresAt: now + SPAWN_TOKEN_TTL_MS,
    nextSpawnAt,
  });
});

export default router;
