import { Request, Response } from 'express';
import NodeCache from 'node-cache';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { ValidationChain } from 'express-validator';
import User, {
  name as userCollection,
  type UserDocument,
} from './schemas/user';
import Count, { name as countCollection } from './schemas/count';
import Balloon, {
  name as baloonCollection,
  BalloonDocument,
} from './schemas/balloon';
import CountHistory from './schemas/counthistory';
import { JWTSignature, MongooseDocumentType, ResponseSchema } from './const';

type LeaderboardUser = MongooseDocumentType<{
  count: number;
  additionalCount: number;
  rank: number;
  user: UserDocument;
}>;

const cache = new NodeCache();
const cacheLocation = {
  leaderboard: 'leaderboard',
  totalPopped: 'totalPopped',
  rank: 'rank',
};

export const validateEnv = () => {
  if (!process.env.DATABASE_URL) {
    console.error('No database URL provided');
    process.exit(1);
  }

  if (!process.env.JWT_SECRET) {
    console.error('No secret key provided');
    process.exit(1);
  }

  if (!process.env.JWT_EXPIRATION) {
    console.error('No token expiration provided');
    process.exit(1);
  }
};

export const testOrigin = (origin: string) => {
  return (
    origin === 'chrome-extension://pahcoancbdjmffpmfbnjablnabomdocp' ||
    origin.startsWith('moz-extension://')
  );
};

export const validation = {
  username: (chain: ValidationChain) =>
    chain
      .optional()
      .isString()
      .trim()
      .isLength({ min: 4, max: 20 })
      .matches(/^[a-zA-Z0-9_]+$/),
  objectId: (id: string) => mongoose.Types.ObjectId.isValid(id),
};

export const generateToken = (id: string): string => {
  return jwt.sign({ id } as JWTSignature, process.env.JWT_SECRET!);
};

export const formatUser = (
  user: UserDocument,
  count: Record<'count', number>,
  jwt?: JWTSignature,
): ResponseSchema['user'] => {
  return {
    id: user.id || user._id.toString(),
    username: user.username,
    email:
      jwt?.id !== undefined && jwt?.id === user.id ? user.email : undefined,
    count: count.count,
    updatedAt: user.updatedAt,
    createdAt: user._id.getTimestamp(),
  };
};

export const getUserAndCount = async (
  id: string,
  req: Request,
  res: Response,
): Promise<ResponseSchema['user']> => {
  const user = await User.findById(id);
  const count = await getUserCount(id, res);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    throw new Error('User not found');
  }

  return formatUser(user, count, req.jwt!);
};

export const getUserCount = async (id: string, res: Response) => {
  const count = (await Count.findById(id)) || { count: 0 };

  // Get the number of documents in the count history collection
  count.count += await CountHistory.countDocuments({ user: id });

  return count;
};

export const fetchLeaderboard = async (
  limit: number,
  skip: number,
  userId: string,
): Promise<{
  leaderboard: LeaderboardUser[];
  userRank: { rank: number }[];
}> => {
  const cacheKey = `${cacheLocation.leaderboard}-${limit}-${skip}`;

  const cachedLoaderboard:
    | {
        leaderboard: LeaderboardUser[];
        userRank: { rank: number }[];
      }
    | undefined = cache.get(cacheKey);
  if (cachedLoaderboard) {
    return cachedLoaderboard;
  }

  const counts: {
    leaderboard: LeaderboardUser[];
    userRank: { rank: number }[];
  } = (
    await CountHistory.aggregate([
      {
        $group: {
          _id: {
            user: '$user',
            type: '$type',
          },
          popCount: {
            $sum: 1,
          },
        },
      },
      {
        $lookup: {
          from: 'balloons',
          localField: '_id.type',
          foreignField: '_id',
          as: 'balloonDetails',
        },
      },
      {
        $unwind: '$balloonDetails',
      },
      {
        $addFields: {
          count: {
            $multiply: ['$popCount', '$balloonDetails.value'],
          },
        },
      },
      {
        $group: {
          _id: '$_id.user',
          count: {
            $sum: '$count',
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $match: {
          'user.username': {
            $ne: null,
          },
        },
      },
      {
        $lookup: {
          from: 'counts',
          localField: '_id',
          foreignField: '_id',
          as: 'userCount',
        },
      },
      {
        $addFields: {
          userCount: {
            $arrayElemAt: ['$userCount.count', 0],
          },
        },
      },
      {
        $addFields: {
          count: {
            $add: [
              '$count',
              {
                $ifNull: ['$userCount', 0],
              },
            ],
          },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
      {
        $group: {
          _id: null,
          users: {
            $push: {
              user: '$user',
              count: '$count',
            },
          },
        },
      },
      {
        $unwind: {
          path: '$users',
          includeArrayIndex: 'rank',
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            user: '$users.user',
            count: '$users.count',
            rank: {
              $add: ['$rank', 1],
            },
          },
        },
      },
      {
        $facet: {
          leaderboard: [
            { $skip: skip }, // only return the requested number of documents
            { $limit: limit },
          ],
          userRank: [
            { $match: { user: new mongoose.Types.ObjectId(userId) } },
            { $project: { rank: 1 } },
          ],
        },
      },
    ])
  )[0];

  cache.set(cacheKey, counts, 60);
  return counts;
};

export const fetchTotalPopped = async (): Promise<number> => {
  const cachedTotalPopped: number | undefined = cache.get(
    cacheLocation.totalPopped,
  );
  if (cachedTotalPopped) {
    console.log('Using cached totalPopped');
    return cachedTotalPopped;
  }

  const countSum: { total: number } = (
    await Count.aggregate([
      { $group: { _id: null, total: { $sum: '$count' } } },
    ]).exec()
  )[0];

  const totalPopped = countSum.total + (await CountHistory.countDocuments());

  cache.set(cacheLocation.totalPopped, totalPopped, 5 * 60);

  console.log('Total popped fetched from MongoDB');
  return totalPopped;
};

export const fetchBalloonType = async (
  name: string,
): Promise<BalloonDocument> => {
  const cacheKey = `${baloonCollection}-${name}`;

  const cachedBalloon: BalloonDocument | undefined = cache.get(cacheKey);
  if (cachedBalloon) {
    return cachedBalloon;
  }

  const balloon: BalloonDocument | null = await Balloon.findOne({ name });
  if (!balloon) {
    throw new Error('Balloon not found');
  }

  cache.set(cacheKey, balloon, 60 * 60); // cache for 1 hour

  return balloon;
};

export const fetchBalloonName = async (id: string): Promise<string> => {
  const cacheKey = `${baloonCollection}-${id}`;
  const cachedBalloon: BalloonDocument | undefined = cache.get(cacheKey);
  if (cachedBalloon) {
    return cachedBalloon.name;
  }

  const balloon = await Balloon.findById(id);
  if (!balloon) {
    throw new Error('Balloon not found');
  }

  cache.set(cacheKey, balloon, 60 * 60); // cache for 1 hour
  return balloon.name;
};

export const fetchHistory = async (
  startDate: Date,
  endDate: Date,
  id?: string,
) => {
  // Convert startDate and endDate to their equivalent ObjectId representations
  const startObjectId =
    Math.floor(startDate.getTime() / 1000).toString(16) + '0000000000000000';
  const endObjectId =
    Math.floor(endDate.getTime() / 1000).toString(16) + 'ffffffffffffffff';

  return await CountHistory.find({
    _id: {
      $gte: startObjectId,
      $lte: endObjectId,
    },
    ...(id ? { user: id } : {}),
  }).exec();
};

export const fetchScores = async (id: string) => {
  const rawScores = (await CountHistory.aggregate([
    {
      $lookup: {
        from: userCollection,
        localField: 'user',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: {
        path: '$user',
      },
    },
    {
      $match: {
        'user._id': new mongoose.Types.ObjectId(id),
      },
    },
    {
      $group: {
        _id: '$type',
        count: {
          $sum: 1,
        },
      },
    },
  ]).exec()) as { _id: string; count: number }[];

  const scores = [];
  for (const score of rawScores) {
    const name = await fetchBalloonName(score._id);
    scores.push({ name, count: score.count });
  }

  return scores;
};
