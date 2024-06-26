import mongoose from 'mongoose';
import { MongooseDocumentType } from '../const';

export const name = 'Count';

export type Count = {
  count: number;
  updatedAt?: Date;
};

export const schema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  count: {
    type: Number,
    default: 0,
    min: 0,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});
export type CountDocument = MongooseDocumentType<Count>;

schema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const model = mongoose.model(name, schema);
export default model;
