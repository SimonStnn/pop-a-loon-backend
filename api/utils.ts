import { Request, Response } from 'express';
import NodeCache from 'node-cache';
import jwt from 'jsonwebtoken';
import mongoose, { PipelineStage } from 'mongoose';
import { ValidationChain } from 'express-validator';
import User, {
  name as userCollection,
  type UserDocument,
} from './schemas/user';
import Count, { name as countCollection } from './schemas/count';
import Balloon, {
  name as balloonCollection,
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
enum CacheLocation {
  LEADERBOARD,
  TOTAL_POPPED,
}

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
  const count = await getUserCount(id);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    throw new Error('User not found');
  }

  return formatUser(user, count, req.jwt!);
};

export const getUserCount = async (id: string) => {
  const count: {
    count: number;
  } = (
    await CountHistory.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(id),
        },
      },
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
          from: balloonCollection,
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
          _id: null,
          user: {
            $first: '$_id.user',
          },
          count: {
            $sum: '$count',
          },
        },
      },
      {
        $lookup: {
          from: countCollection,
          localField: 'user',
          foreignField: '_id',
          as: 'userCount',
        },
      },
      {
        $addFields: {
          count: {
            $add: [
              '$count',
              {
                $ifNull: [{ $arrayElemAt: ['$userCount.count', 0] }, 0],
              },
            ],
          },
        },
      },
    ])
  )[0] ?? { count: 0 };

  return count;
};

export const fetchLeaderboard = async (
  limit: number,
  skip: number,
  userId: string,
  startDate?: Date | null,
  endDate?: Date | null,
): Promise<{
  leaderboard: LeaderboardUser[];
  userRank: { rank: number }[];
}> => {
  const cacheKey = `${CacheLocation.LEADERBOARD}-${limit}-${skip}-${userId}-${startDate?.getTime()}-${endDate?.getTime()}`;

  const cachedLoaderboard:
    | {
        leaderboard: LeaderboardUser[];
        userRank: { rank: number }[];
      }
    | undefined = cache.get(cacheKey);
  if (cachedLoaderboard) {
    return cachedLoaderboard;
  }

  const matchStages: PipelineStage[] = [];
  if (startDate) {
    const startObjectId = new mongoose.Types.ObjectId(
      Math.floor(startDate.getTime() / 1000).toString(16) + '0000000000000000',
    );
    matchStages.push({ $match: { _id: { $gte: startObjectId } } });
  }
  if (endDate) {
    const endObjectId = new mongoose.Types.ObjectId(
      Math.floor(endDate.getTime() / 1000).toString(16) + 'ffffffffffffffff',
    );
    matchStages.push({ $match: { _id: { $lte: endObjectId } } });
  }

  // If there is no start date, we need to take the old counts into consideration
  const oldCounts: PipelineStage[] = [];
  if (!startDate) {
    oldCounts.push(
      {
        $lookup: {
          from: countCollection,
          localField: '_id',
          foreignField: '_id',
          as: 'userCount',
        },
      },
      {
        $addFields: {
          count: {
            $add: [
              '$count',
              {
                $ifNull: [{ $arrayElemAt: ['$userCount.count', 0] }, 0],
              },
            ],
          },
        },
      },
    );
  }

  const counts: {
    leaderboard: LeaderboardUser[];
    userRank: { rank: number }[];
  } = (
    await CountHistory.aggregate([
      // 1. Match the date range if applicable
      ...matchStages,
      // 2. Group by user and balloon type
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
      // 3. Take balloon values into consideration
      {
        $lookup: {
          from: balloonCollection,
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
      // 4. Calculate the total count for each user
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
          from: userCollection,
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      // 5. Filter out users without a username
      {
        $match: {
          'user.username': {
            $ne: null,
          },
        },
      },
      // 6. Take old counts into consideration if applicable
      ...oldCounts,
      // Sort by count in descending order
      {
        $sort: {
          count: -1,
        },
      },
      // 7. Add a rank to each user
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
      // 8. Split the result into the leaderboard and the user's rank
      {
        $facet: {
          leaderboard: [
            { $skip: skip }, // only return the requested number of documents
            { $limit: limit },
          ],
          userRank: [
            { $match: { 'user._id': new mongoose.Types.ObjectId(userId) } },
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
    CacheLocation.TOTAL_POPPED,
  );
  if (cachedTotalPopped) {
    return cachedTotalPopped;
  }

  const countSum: { total: number } = (
    await Count.aggregate([
      { $group: { _id: null, total: { $sum: '$count' } } },
    ]).exec()
  )[0];

  const totalPopped = countSum.total + (await CountHistory.countDocuments());

  cache.set(CacheLocation.TOTAL_POPPED, totalPopped, 5 * 60);

  return totalPopped;
};

export const fetchBalloonType = async (
  name: string,
): Promise<BalloonDocument> => {
  const cacheKey = `${balloonCollection}-${name}`;

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
  const cacheKey = `${balloonCollection}-${id}`;
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

export const fetchScores = async (
  id: string,
): Promise<
  {
    name: string;
    count: number;
  }[]
> => {
  const scores = (await CountHistory.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(id),
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
    {
      $lookup: {
        from: 'balloons',
        localField: '_id',
        foreignField: '_id',
        as: 'balloon',
      },
    },
    {
      $unwind: '$balloon',
    },
    {
      $project: {
        _id: 0,
        name: '$balloon.name',
        count: 1,
      },
    },
  ]).exec()) as { name: string; count: number }[];

  return scores;
};
