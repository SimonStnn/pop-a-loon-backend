import mongoose from 'mongoose';
import { MongooseDocumentType } from '../const';

export type SpawnToken = {
  userId: mongoose.Schema.Types.ObjectId;
  balloon: mongoose.Schema.Types.ObjectId;
  nonce: string;
  used: boolean;
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
  nonce: {
    type: String,
    required: true,
  },
  used: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

// TTL index: auto-delete expired tokens
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Unique partial index: one unused nonce per user
schema.index(
  { userId: 1, nonce: 1 },
  {
    unique: true,
    partialFilterExpression: { used: false },
  },
);

export type SpawnTokenDocument = MongooseDocumentType<SpawnToken>;

const model = mongoose.model<SpawnToken>('spawntokens', schema);
export default model;
