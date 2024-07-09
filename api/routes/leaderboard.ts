import express, { Request, Response } from 'express';

import User from '../schemas/user';
import {
  fetchLeaderboard,
  fetchRank,
  formatUser,
  getUserCount,
} from '../utils';
import { matchedData, query, validationResult } from 'express-validator';

const router = express.Router();

router.get(
  '/',
  query('limit').isInt({ min: 1, max: 10 }).optional(),
  query('skip').isInt({ min: 0 }).optional(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }
    const data = matchedData(req) as { limit?: number; skip?: number };
    const limit = data.limit || 10;
    const skip = data.skip || 0;
    const userId = req.jwt!.id;
    const user = await User.findById(userId).exec();
    const userCount = await getUserCount(userId, res);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get the top 10 users with the highest count
    const counts = await fetchLeaderboard(limit, skip);

    // Get the rank of the user in the database
    const rank = await fetchRank(userId);

    const response = {
      user: formatUser(user, userCount, req.jwt!),
      rank: user.username && rank ? rank : null,
      topUsers: [] as ReturnType<typeof formatUser>[],
    };
    for (const count of counts) {
      response.topUsers.push(formatUser(count.user, count));
    }

    res.json(response);
  },
);

export default router;
