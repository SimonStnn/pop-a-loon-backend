import mongoose from 'mongoose';
import { MongooseDocumentType } from '../const';

export const name = 'balloons';

export type Balloon = {
  name: string;
};

export const schema = new mongoose.Schema<Balloon>({
  name: {
    type: String,
    required: true,
  },
});
export type BalloonDocument = MongooseDocumentType<Balloon>;

const model = mongoose.model<Balloon>(name, schema);
export default model;
