import mongoose from 'mongoose';
import { MongooseDocumentType } from '../const';

export const name = 'balloons';

export type Balloon = {
  id: number;
  name: string;
};

export const schema = new mongoose.Schema<Balloon>({
  id: {
    type: Number,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    unique: true,
  },
});
export type BalloonDocument = MongooseDocumentType<Balloon>;

const model = mongoose.model<Balloon>(name, schema);
export default model;
