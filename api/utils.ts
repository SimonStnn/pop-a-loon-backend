import { type UserDocumentType } from './schemas/user';
import { type CountDocumentType } from './schemas/count';
import { JWTSignature } from './const';

export const validateEnv = () => {
  if (!process.env.DATABASE_URL) {
    console.error('No database URL provided');
    process.exit(1);
  }

  if (!process.env.JWT_SECRET) {
    console.error('No secret key provided');
    process.exit(1);
  }

  if (!process.env.SSL_KEY) {
    console.error('No SSL key provided');
    process.exit(1);
  }

  if (!process.env.SSL_CERT) {
    console.error('No SSL certificate provided');
    process.exit(1);
  }
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
