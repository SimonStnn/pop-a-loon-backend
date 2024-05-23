import NodeCache from 'node-cache';
import { type UserDocumentType } from './schemas/user';
import Count, { type CountDocumentType } from './schemas/count';
import { JWTSignature } from './const';

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
) => {
  return {
    id: user.id,
    username: user.username,
    email: jwt?.id === user.id ? user.email : undefined,
    count: count.count,
    updatedAt: user.updatedAt,
    createdAt: user._id.getTimestamp(),
  };
};

export const fetchLeaderboard = async (
  limit: number,
): Promise<CountDocumentType[]> => {
  const cachedLoaderboard: CountDocumentType[] | undefined = cache.get(
    cacheLocation.leaderboard,
  );
  if (cachedLoaderboard) {
    console.log('Using cached leaderboard');
    return cachedLoaderboard;
  }

  const counts = await Count.find().sort({ count: -1 }).limit(limit).exec();

  cache.set(cacheLocation.leaderboard, counts, 60);

  console.log('Counts fetched from MongoDB');
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
