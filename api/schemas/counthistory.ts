import mongoose from 'mongoose';
import { MongooseDocumentType } from '../const';

export const name = 'counthistories';

export type CountHistory = {
  user: mongoose.Schema.Types.ObjectId;
  type: number;
};

export const schema = new mongoose.Schema<CountHistory>({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  type: {
    type: Number,
    default: 0,
  },
});
export type CountHistoryDocument = MongooseDocumentType<CountHistory>;

const model = mongoose.model<CountHistory>(name, schema);
export default model;
