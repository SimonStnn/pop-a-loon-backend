import express, { Request, Response } from 'express';
import {
  fetchBalloonName,
  fetchBalloonType,
  fetchHistory,
  fetchTotalPopped,
} from '../utils';
import { matchedData, query, validationResult } from 'express-validator';
import { HistoryNode } from '@/const';

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

    const history = await fetchHistory(req.jwt!.id, startDate, endDate);

    const uniqueTypes = [
      ...new Set(history.map((node) => node.type.toString())),
    ];
    const types: string[] = [];
    for (const type of uniqueTypes) {
      types.push(await fetchBalloonName(type));
    }

    const filledData: HistoryNode[] = [];
    for (
      let currentDate = new Date(startDate);
      currentDate <= endDate;
      currentDate.setDate(currentDate.getDate() + 1)
    ) {
      // Get the data in history with the same day as currentDate
      const currentData = history.filter((node) => {
        const date = node._id.getTimestamp();
        return (
          date.getDate() === currentDate.getDate() &&
          date.getMonth() === currentDate.getMonth() &&
          date.getFullYear() === currentDate.getFullYear()
        );
      });

      const fill: { [key: string]: number } = {};
      for (const node of currentData) {
        const balloonName = types[uniqueTypes.indexOf(node.type.toString())];
        fill[balloonName] = fill[balloonName] ? fill[balloonName] + 1 : 1;
      }

      filledData.push({
        date: new Date(currentDate),
        pops: fill,
      });
    }

    res.json({
      history: filledData,
    });
  },
);

export default router;
