import mongoose from 'mongoose';
import { MongooseDocumentType } from '../const';

/**
 * One active spawn schedule per user.
 *
 * The row is created when a user requests their schedule and is deleted when
 * the token is consumed, so the unique userId index effectively allows a
 * single pending balloon per user.
 */
export type SpawnToken = {
  userId: mongoose.Schema.Types.ObjectId;
  balloon: mongoose.Schema.Types.ObjectId;
  balloonName: string;
  nonce: string;
  token: string;
  spawnAt: Date;
  expiresAt: Date;
};

export const schema = new mongoose.Schema<SpawnToken>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  balloon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Balloon',
    required: true,
  },
  balloonName: {
    type: String,
    required: true,
  },
  nonce: {
    type: String,
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  spawnAt: {
    type: Date,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

// TTL index: auto-delete expired schedules
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// One active schedule per user. Consuming the token deletes the row, which
// frees the slot for the next schedule.
schema.index({ userId: 1 }, { unique: true });

export type SpawnTokenDocument = MongooseDocumentType<SpawnToken>;

const model = mongoose.model<SpawnToken>('spawntokens', schema);
export default model;
