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
import {
  JWTSignature,
  MongooseDocumentType,
  ResponseSchema,
  SpawnTokenPayload,
} from './const';
import SpawnToken, { SpawnTokenDocument } from './schemas/spawn-token';

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

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET must be at least 32 characters');
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
  return jwt.sign({ id } as JWTSignature, process.env.JWT_SECRET!, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRATION || '30d',
  });
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
  nameOrId: string,
): Promise<BalloonDocument> => {
  const cacheKey = `${balloonCollection}-${nameOrId}`;

  // Cache a plain object, not the Mongoose document — node-cache clones on
  // set, and cloning a document with nested subdocuments (e.g. season) crashes.
  const cachedBalloon: Record<string, unknown> | undefined =
    cache.get(cacheKey);
  if (cachedBalloon) {
    return Balloon.hydrate(cachedBalloon) as BalloonDocument;
  }

  // Accept either a balloon name or an ObjectId
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(nameOrId);
  const balloon: BalloonDocument | null = isObjectId
    ? await Balloon.findById(nameOrId)
    : await Balloon.findOne({ name: nameOrId });

  if (!balloon) {
    throw new Error('Balloon not found');
  }

  cache.set(cacheKey, balloon.toObject(), 60 * 60); // cache for 1 hour

  return balloon;
};

export const fetchBalloonName = async (id: string): Promise<string> => {
  const cacheKey = `${balloonCollection}-${id}`;
  const cachedBalloon: Record<string, unknown> | undefined =
    cache.get(cacheKey);
  if (cachedBalloon) {
    return cachedBalloon.name as string;
  }

  const balloon = await Balloon.findById(id);
  if (!balloon) {
    throw new Error('Balloon not found');
  }

  cache.set(cacheKey, balloon.toObject(), 60 * 60); // cache for 1 hour
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

// ─── Spawn Token Utilities ────────────────────────────────────────────────

// How long a balloon stays poppable after its scheduled spawn time.
const SPAWN_TOKEN_TTL_MS = 30 * 1000;

/**
 * The delay range between balloon spawns. The backend is the single source of
 * truth for this so the schedule it hands out matches the published config.
 */
export const getSpawnInterval = (): { min: number; max: number } =>
  process.env.NODE_ENV === 'development'
    ? { min: 10 * 1000, max: 15 * 1000 }
    : { min: 1000, max: 10 * 60000 };

const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Returns the user's active spawn schedule, creating one if none exists or the
 * previous one expired.
 *
 * Idempotent: while a schedule is active, repeated calls return the same
 * token and spawn time, so a client cannot obtain extra balloons by polling.
 */
export const getOrCreateSpawnSchedule = async (
  userId: string,
): Promise<SpawnTokenDocument> => {
  const now = Date.now();

  let schedule = await SpawnToken.findOne({ userId });

  // The TTL monitor runs about once a minute, so replace expired rows here.
  if (schedule && schedule.expiresAt.getTime() <= now) {
    await SpawnToken.deleteOne({ _id: schedule._id });
    schedule = null;
  }

  if (schedule) return schedule;

  const balloon = await selectBalloonType();
  const { min, max } = getSpawnInterval();
  const spawnAt = now + randomBetween(min, max);
  const expiresAt = spawnAt + SPAWN_TOKEN_TTL_MS;
  const nonce = crypto.randomUUID();

  const payload: SpawnTokenPayload = {
    sub: userId,
    type: 'spawn',
    nonce,
    spawnAt,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    // nbf keeps the token unusable before the scheduled spawn time; exp ends
    // the poppable window. jwt.verify enforces both.
    notBefore: Math.max(0, Math.floor((spawnAt - now) / 1000)),
    expiresIn: Math.ceil((expiresAt - now) / 1000),
  });

  try {
    return await SpawnToken.create({
      userId: new mongoose.Types.ObjectId(userId),
      balloon: balloon._id,
      balloonName: balloon.name,
      nonce,
      token,
      spawnAt: new Date(spawnAt),
      expiresAt: new Date(expiresAt),
    });
  } catch (e) {
    // A concurrent request won the race; return the schedule it created.
    const existing = await SpawnToken.findOne({ userId });
    if (existing) return existing;
    throw e;
  }
};

export const verifySpawnToken = (token: string): Promise<SpawnTokenPayload> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(decoded as SpawnTokenPayload);
    });
  });
};

export const consumeSpawnToken = async (
  token: string,
  userId: string,
): Promise<{ balloon: string }> => {
  const payload = await verifySpawnToken(token);

  if (payload.type !== 'spawn') {
    throw new Error('Invalid token type');
  }
  if (payload.sub !== userId) {
    throw new Error('Token does not belong to user');
  }

  // Atomically delete the schedule so the token can only be redeemed once.
  // Deleting also frees the user's slot for the next schedule.
  const result = await SpawnToken.findOneAndDelete({
    userId: new mongoose.Types.ObjectId(userId),
    nonce: payload.nonce,
  });

  if (!result) {
    throw new Error('Spawn token already used or expired');
  }

  return { balloon: result.balloon.toString() };
};

type BalloonPlain = {
  _id: mongoose.Types.ObjectId;
  name: string;
  value: number;
  spawn_chance: number;
  season?: {
    start: { month: number; day: number };
    end: { month: number; day: number };
    timeZone?: string;
  };
};

export const selectBalloonType = async (
  now: Date = new Date(),
): Promise<BalloonPlain> => {
  const balloons = await Balloon.find({}).lean();
  const eligible = balloons.filter((b) => {
    if (!b.season) return true;
    return isInSeason(b.season, now);
  });

  if (eligible.length === 0) {
    // Fall back to all balloons if none are in season
    return balloons[Math.floor(Math.random() * balloons.length)];
  }

  const totalWeight = eligible.reduce((sum, b) => sum + b.spawn_chance, 0);
  let random = Math.random() * totalWeight;
  for (const balloon of eligible) {
    random -= balloon.spawn_chance;
    if (random <= 0) return balloon;
  }
  return eligible[eligible.length - 1];
};

export const isInSeason = (
  season: {
    start: { month: number; day: number };
    end: { month: number; day: number };
    timeZone?: string;
  },
  date: Date = new Date(),
): boolean => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: season.timeZone,
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const current = month * 100 + day;
  const start = season.start.month * 100 + season.start.day;
  const end = season.end.month * 100 + season.end.day;

  return start <= end
    ? current >= start && current <= end
    : current >= start || current <= end;
};
