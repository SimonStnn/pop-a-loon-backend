import express, { Request, Response } from 'express';

import User from '../schemas/user';
import { fetchLeaderboard, formatUser, getUserCount } from '../utils';
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
    const data = matchedData(req) as { limit?: any; skip?: any };
    const limit = Number(data.limit) || 10;
    const skip = Number(data.skip) || 0;
    const userId = req.jwt!.id;
    const user = await User.findById(userId).exec();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [userCount, counts] = await Promise.all([
      getUserCount(userId),
      // Get the top 10 users with the highest count
      fetchLeaderboard(limit, skip, userId),
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
