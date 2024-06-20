import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

import User from '../schemas/user';
import Count from '../schemas/count';
import CountHistory from '../schemas/counthistory';
import { JWTSignature, ResponseSchema } from '../const';
import { formatUser } from '../utils';

const toManyRequestsResponse = { error: 'Too many requests' };

const newUserLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1, // 1 requests per minute per IP
  message: toManyRequestsResponse,
});

const countLimiter = rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: 3, // 3 requests per 30 seconds per IP
  message: toManyRequestsResponse,
  keyGenerator: function (req: Request) {
    // Use the user's jwt as the key for rate limiting
    return req.jwt!.id;
  },
});

const router = express.Router();

const getUserAndCount = async (
  id: string,
  req: Request,
  res: Response,
): Promise<ResponseSchema['user']> => {
  const user = await User.findById(id);
  const count = await Count.findById(id);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    throw new Error('User not found');
  } else if (!count) {
    res.status(404).json({ error: 'Count not found' });
    throw new Error('Count not found');
  }

  return formatUser(user, count, req.jwt!);
};

router.get('/', async (req: Request, res: Response) => {
  const id = req.jwt!.id;
  res.json((await getUserAndCount(id, req, res)) as ResponseSchema['user']);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  res.json((await getUserAndCount(id, req, res)) as ResponseSchema['user']);
});

router.get('/:id/count', async (req: Request, res: Response) => {
  const id = req.params.id;

  const user = await Count.findById(id);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    count: user.count,
    updatedAt: user.updatedAt,
  });
});

router.use('/count/increment', countLimiter);
router.post('/count/increment', async (req: Request, res: Response) => {
  const id = req.jwt!.id;
  const count = await Count.findById(id);

  const countHistory = new CountHistory({ user: id });
  await countHistory.save();

  // Check if the user exists
  if (!count) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Increment the count and save the document
  count.count++;
  await count.save();

  res.json({
    id: count.id,
    count: count.count,
    updatedAt: count.updatedAt,
  });
});

router.use('/new', newUserLimiter);
router.post('/new', async (req: Request, res: Response) => {
  const { username, email } = req.query;

  const user = new User({ username, email });

  // Save the user and create a count document
  await user.save();
  // Get the count document
  const count = await Count.findById(user.id);
  if (!count) {
    throw new Error('Something went wrong');
  }

  // Send the user and count documents with token
  res.json({
    token: jwt.sign({ id: user.id } as JWTSignature, process.env.JWT_SECRET!),
    ...formatUser(user, count, req.jwt!),
  });
});

router.put('/', async (req: Request, res: Response) => {
  const id = req.jwt!.id;
  const { username, email } = req.query;

  // Update the user and count document
  const user = await User.findByIdAndUpdate(
    id,
    { username, email },
    { new: true },
  );
  const count = await Count.findById(id);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  } else if (!count) {
    res.status(404).json({ error: 'Count not found' });
    return;
  }

  // Save the user document
  await user.save();

  // Send the updated user and count documents
  res.json(formatUser(user, count, req.jwt!) as ResponseSchema['user']);
});

router.delete('/', async (req: Request, res: Response) => {
  const id = req.jwt!.id;

  const user = await User.findByIdAndDelete(id);
  const count = await Count.findByIdAndDelete(id);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  } else if (!count) {
    res.status(404).json({ error: 'Count not found' });
    return;
  }

  res.json(formatUser(user, count, req.jwt!) as ResponseSchema['user']);
});
export default router;
