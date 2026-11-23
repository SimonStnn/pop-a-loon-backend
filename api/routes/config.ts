import express, { Request, Response } from 'express';
import { getSpawnInterval } from '../utils';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  res.json({
    badge: {
      color: '#26282b',
      backgroundColor: '#7aa5eb',
    },
    spawnInterval: getSpawnInterval(),
  });
});

export default router;
