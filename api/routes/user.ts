import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

import User from '../schemas/user';
import Count from '../schemas/count';
import { JWTSignature } from '../const';
import { formatUser } from '../utils';

const newUserLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1, // 1 requests per minute per IP
  message: 'Too many requests',
});

const countLimiter = rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: 3, // 10 requests per minute per IP
  message: 'Too many requests',
});

const router = express.Router();

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id;

  const user = await User.findById(id);
  const count = await Count.findById(id);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  } else if (!count) {
    res.status(404).json({ error: 'Count not found' });
    return;
  }

  res.json(formatUser(user, count, req.jwt!));
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
  const { username, email, initialCount } = req.query;
  if (!username) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }

  const user = new User({ username, email: email || '' });

  // Save the user and create a count document
  await user.save();
  // Get the count document
  const count = await Count.findById(user.id);
  if (!count) {
    throw new Error('Something went wrong');
  }

  // If the initialCount query parameter is provided, set the count to that value
  //! Needs to be removed in next version
  if (initialCount) {
    count.count = parseInt(initialCount as string);
    await count.save();
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
  res.json(formatUser(user, count, req.jwt!));
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

  res.json(formatUser(user, count, req.jwt!));
});
export default router;
