import express, { Request, Response } from 'express';

import User from '../schemas/user';
import Count from '../schemas/count';
import { fetchLeaderboard, formatUser } from '../utils';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = parseInt(req.query.skip as string) || 0;

  if (limit < 1 || limit > 10) {
    return res
      .status(400)
      .json({ message: 'Invalid limit, limit must be 1 < limit < 10' });
  }
  if (skip < 0) {
    return res.status(400).json({ message: 'Invalid skip, skip must be > 0' });
  }

  const userId = req.jwt?.id;
  const user = await User.findById(userId).exec();
  const userCount = await Count.findById(userId).exec();

  if (!user || !userCount) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Get the top 10 users with the highest count
  const counts = await fetchLeaderboard(limit, skip);

  // Get the position of the user in the database
  const position = (
    await Count.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $match: {
          'user.username': { $exists: true, $ne: null },
          count: { $gt: userCount.count },
        },
      },
    ])
      .count('count')
      .exec()
  )[0].count;

  const response = {
    user: formatUser(user, userCount, req.jwt!),
    rank: user.username && position ? position + 1 : null,
    topUsers: [] as ReturnType<typeof formatUser>[],
  };
  for (const count of counts) {
    response.topUsers.push(formatUser(count.user, count));
  }

  res.json(response);
});

export default router;
