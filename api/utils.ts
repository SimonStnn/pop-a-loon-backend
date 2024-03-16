import { type UserDocumentType } from './schemas/user';
import { type CountDocumentType } from './schemas/count';

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

export const formatUser = (
  user: UserDocumentType,
  count: CountDocumentType,
) => {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    count: count.count,
    updatedAt: user.updatedAt,
    createdAt: user._id.getTimestamp(),
  };
};
