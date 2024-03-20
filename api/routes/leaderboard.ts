import express, { Request, Response } from 'express';

import User from '../schemas/user';
import Count from '../schemas/count';
import { formatUser } from '../utils';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 10;
  if (limit && (limit < 1 || limit > 10)) {
    return res
      .status(400)
      .json({ message: 'Invalid limit, limit must be 1 < limit < 10' });
  }

  const userId = req.jwt?.id;
  const user = await User.findById(userId).exec();
  const userCount = await Count.findById(userId).exec();

  if (!user || !userCount) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Get the top 10 users with the highest count
  const counts = await Count.find().sort({ count: -1 }).limit(limit).exec();

  // Get the position of the user in the database
  const position = await Count.find({ count: { $gt: userCount.count } })
    .countDocuments()
    .exec();

  const response = {
    user: formatUser(user, userCount),
    rank: position + 1,
    topUsers: [] as ReturnType<typeof formatUser>[],
  };
  for (const count of counts) {
    const user = await User.findById(count.id).exec();
    if (!user) {
      return;
    }
    response.topUsers.push(formatUser(user, count));
  }

  res.json(response);
});

export default router;
