import express, { Request, Response } from 'express';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  const isDev = process.env.NODE_ENV === 'development';
  res.json({
    badge: {
      color: '#26282b',
      backgroundColor: '#7aa5eb',
    },
    spawnInterval: isDev
      ? { min: 10 * 1000, max: 15 * 1000 }
      : { min: 1000, max: 10 * 60000 },
  });
});

export default router;
