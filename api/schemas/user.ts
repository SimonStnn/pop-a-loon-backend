import mongoose from 'mongoose';
import { MongooseDocumentType } from '../const';
import Count from './count';

export const name = 'User';

export type User = {
  username?: string;
  email?: string;
  updatedAt: Date;
};

export const schema = new mongoose.Schema({
  username: {
    type: String,
  },
  email: {
    type: String,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});
export type UserDocumentType = MongooseDocumentType<User>;

schema.pre('save', function (next) {
  const now = new Date();
  if (this.isNew) {
    const count = new Count({ _id: this._id });
    count.save();
  }
  this.updatedAt = now;
  next();
});

export const model = mongoose.model<User>(name, schema);
export default model;
