import express, { Request, Response } from 'express';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  res.json({
    spawnInterval: {
      min: 1000,
      max: 10 * 60000,
    },
  });
});

export default router;
