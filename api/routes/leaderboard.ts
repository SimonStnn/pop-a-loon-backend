import express, { Request, Response } from 'express';

import User from '../schemas/user';
import { fetchLeaderboard, formatUser, getUserCount } from '../utils';
import { matchedData, query, validationResult } from 'express-validator';

const router = express.Router();

router.get(
  '/',
  query('limit').isInt({ min: 1, max: 100 }).optional(),
  query('skip').isInt({ min: 0 }).optional(),
  query('start-date')
    .isISO8601()
    .custom((value, { req }) => {
      if (!req.query) return false;
      if (new Date(value) > new Date(req.query['end-date']))
        throw new Error('Start date must be before end date');

      if (new Date(value) < new Date(2024, 6, 1))
        throw new Error('Start date must be after 2024-07-01');
      return true;
    })
    .optional(),
  query('end-date').optional().isISO8601(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }
    const data = matchedData(req) as {
      limit?: any;
      skip?: any;
      'start-date'?: string;
      'end-date'?: string;
    };
    const limit = Number(data.limit) || 10;
    const skip = Number(data.skip) || 0;
    const startDate = data['start-date'] ? new Date(data['start-date']) : null;
    const endDate = data['end-date'] ? new Date(data['end-date']) : null;
    const userId = req.jwt!.id;
    const user = await User.findById(userId).exec();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [userCount, counts] = await Promise.all([
      getUserCount(userId),
      // Get the top 10 users with the highest count
      fetchLeaderboard(limit, skip, userId, startDate, endDate),
    ]);
    return res.json({
      user: formatUser(user, userCount, req.jwt!),
      topUsers: counts.leaderboard.map((count) =>
        formatUser(count.user, count),
      ),
      rank: counts.userRank[0]?.rank ?? null,
    });
  },
);

export default router;
