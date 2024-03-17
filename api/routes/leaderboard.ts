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

  // Get the top 10 users with the highest count
  const counts = await Count.find().sort({ count: -1 }).limit(limit).exec();

  const response = { users: [] as ReturnType<typeof formatUser>[] };
  for (const count of counts) {
    const user = await User.findById(count.id).exec();
    if (!user) {
      return;
    }
    response.users.push(formatUser(user, count));
  }

  res.json(response);
});

export default router;
