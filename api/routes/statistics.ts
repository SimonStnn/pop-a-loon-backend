import express, { Request, Response } from 'express';
import { fetchTotalPopped } from '../utils';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  res.json({
    totalPopped: await fetchTotalPopped(),
  });
});

export default router;
