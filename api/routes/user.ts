import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import User from '../schemas/user';
import Count from '../schemas/count';
import { JWTSignature } from '../const';
import { formatUser } from '../utils';

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

  res.json(formatUser(user, count));
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

router.post('/new', async (req: Request, res: Response) => {
  const { username, email, initialCount } = req.query;
  if (!username) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }

  const user = new User({ username, email });

  // Check if the user already exists
  // User exists if the username or email is already in use
  const userAlreadyExists = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (userAlreadyExists) {
    res.status(400).json({ error: 'User already exists' });
    return;
  }

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
    ...formatUser(user, count),
  });
});

router.put('/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const { username, email } = req.query;

  // Check if the user is the same as the one in the token
  if (id !== req.jwt?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

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
  res.json(formatUser(user, count));
});

export default router;
