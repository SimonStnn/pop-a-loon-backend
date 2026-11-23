import mongoose from 'mongoose';
import { MongooseDocumentType } from '../const';

export const name = 'users';

export type User = {
  username?: string;
  email?: string;
  recoveryHash?: string;
  recoveryCreatedAt?: Date;
  updatedAt: Date;
};

export const schema = new mongoose.Schema({
  username: {
    type: String,
  },
  email: {
    type: String,
  },
  recoveryHash: {
    type: String,
    unique: true,
    sparse: true,
  },
  recoveryCreatedAt: {
    type: Date,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});
export type UserDocument = MongooseDocumentType<User>;

schema.pre('save', function (next) {
  const now = new Date();
  this.updatedAt = now;
  next();
});

export const model = mongoose.model<User>(name, schema);
export default model;
