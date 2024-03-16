import mongoose from 'mongoose';

export const name = 'Count';

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

schema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});
const model = mongoose.model(name, schema);
export default model;
