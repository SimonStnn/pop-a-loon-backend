import mongoose from 'mongoose';
import { MongooseDocumentType } from '../const';

export const name = 'balloons';

export type Season = {
  start: { month: number; day: number };
  end: { month: number; day: number };
  timeZone?: string;
};

export type Balloon = {
  name: string;
  value: number;
  spawn_chance: number;
  season?: Season;
};

export const schema = new mongoose.Schema<Balloon>({
  name: {
    type: String,
    required: true,
  },
  value: {
    type: Number,
    required: true,
  },
  spawn_chance: {
    type: Number,
    required: true,
    default: 1,
    min: 0,
    max: 1,
  },
  season: {
    start: {
      month: { type: Number, required: false },
      day: { type: Number, required: false },
    },
    end: {
      month: { type: Number, required: false },
      day: { type: Number, required: false },
    },
    timeZone: { type: String, required: false },
  },
});
export type BalloonDocument = MongooseDocumentType<Balloon>;

const model = mongoose.model<Balloon>(name, schema);
export default model;
