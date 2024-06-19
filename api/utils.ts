import NodeCache from 'node-cache';
import User, { type UserDocumentType } from './schemas/user';
import Count, { type CountDocumentType } from './schemas/count';
import { JWTSignature, ResponseSchema } from './const';

type LeaderboardUser = CountDocumentType & { user: UserDocumentType };

const cache = new NodeCache();
const cacheLocation = {
  leaderboard: 'leaderboard',
  totalPopped: 'totalPopped',
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

export const formatUser = (
  user: UserDocumentType,
  count: CountDocumentType,
  jwt?: JWTSignature,
): ResponseSchema['user'] => {
  return {
    id: user.id,
    username: user.username,
    email:
      jwt?.id !== undefined && jwt?.id === user.id ? user.email : undefined,
    count: count.count,
    updatedAt: user.updatedAt,
    createdAt: user._id.getTimestamp(),
  };
};

export const fetchLeaderboard = async (
  limit: number,
  skip: number,
): Promise<LeaderboardUser[]> => {
  const cacheKey = `${cacheLocation.leaderboard}-${limit}-${skip}`;

  const cachedLoaderboard: LeaderboardUser[] | undefined = cache.get(cacheKey);
  if (cachedLoaderboard) {
    return cachedLoaderboard;
  }

  const counts: LeaderboardUser[] = await Count.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    { $match: { 'user.username': { $exists: true, $ne: null } } },
    { $sort: { count: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);

  counts.forEach((count) => {
    count.user = User.hydrate(count.user);
  });

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

  const totalPopped = (
    await Count.aggregate([
      { $group: { _id: null, total: { $sum: '$count' } } },
    ]).exec()
  )[0].total;

  cache.set(cacheLocation.totalPopped, totalPopped, 5 * 60);

  console.log('Total popped fetched from MongoDB');
  return totalPopped;
};

export const fetchRank = async (
  userCount: CountDocumentType,
): Promise<number> => {
  return (
    (
      (await Count.aggregate([
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
            counts: { $push: '$count' },
          },
        },
        {
          $project: {
            rank: { $indexOfArray: ['$counts', userCount.count] },
          },
        },
      ]).exec()) as { rank: number }[]
    )[0]?.rank + 1
  );
};
