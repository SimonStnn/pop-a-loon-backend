import express, { Request, Response } from 'express';
import { fetchHistory, fetchScores, fetchTotalPopped } from '../utils';
import { matchedData, query, validationResult } from 'express-validator';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  res.json({
    totalPopped: await fetchTotalPopped(),
  });
});

router.get(
  '/history',
  query('start-date')
    .isISO8601()
    .custom((value, { req }) => {
      if (!req.query) return false;
      if (new Date(value) > new Date(req.query['end-date']))
        throw new Error('Start date must be before end date');

      if (new Date(value) < new Date(2024, 6, 1))
        throw new Error('Start date must be after 2024-07-01');
      return true;
    }),
  query('end-date').optional().isISO8601(),
  query('id').optional().isMongoId(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }
    const data = matchedData(req) as {
      'start-date': string;
      'end-date'?: string;
      id?: string;
    };
    const startDate = new Date(data['start-date']);
    const endDate = new Date(data['end-date'] ?? new Date());
    const id = data.id === req.jwt!.id ? data.id : undefined;

    res.json(await fetchHistory(startDate, endDate, id));
  },
);

router.get('/scores', async (req: Request, res: Response) => {
  const id = req.jwt!.id;
  const scores = await fetchScores(id.toString());

  res.json({
    scores,
  });
});

export default router;
