import express, { Request, Response } from 'express';
import {
  fetchBalloonName,
  fetchBalloonType,
  fetchHistory,
  fetchTotalPopped,
} from '../utils';
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
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }
    const data = matchedData(req) as {
      'start-date': string;
      'end-date'?: string;
    };
    const startDate = new Date(data['start-date']);
    const endDate = new Date(data['end-date'] ?? new Date());

    const history = await fetchHistory(startDate, endDate);

    const uniqueTypes = [
      ...new Set(history.map((node) => node.type.toString())),
    ];
    const types: string[] = [];
    for (const type of uniqueTypes) {
      types.push(await fetchBalloonName(type));
    }

    res.json({
      history: history.map((node) => ({
        date: node._id.getTimestamp(),
        type: types[uniqueTypes.indexOf(node.type.toString())],
      })),
    });
  },
);

export default router;
