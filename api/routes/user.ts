import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import User from '../schemas/user';
import Count from '../schemas/count';
import { JWTSignature } from '../const';
import { formatUser } from '../utils';

const router = express.Router();

router.get('/:id', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id/count', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/:id/count/increment', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const user = await Count.findById(id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (id !== req.jwt?.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    user.count++;
    await user.save();

    res.json({
      id: user.id,
      count: user.count,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/new', async (req: Request, res: Response) => {
  try {
    const { username, email, password, initialCount } = req.query;

    const user = new User({ username, email, password });

    // Check if the user already exists
    // User exists if the username or email is already in use
    const userAlreadyExists = await User.findOne({
      $or: [{ username }, { email }],
    });
    if (userAlreadyExists) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    await user.save();
    const count = await Count.findById(user.id);

    if (!count) {
      throw new Error('Something went wrong');
    }

    if (initialCount) {
      count.count = parseInt(initialCount as string);
      await count.save();
    }

    res.json({
      token: jwt.sign({ id: user.id } as JWTSignature, process.env.JWT_SECRET!),
      ...formatUser(user, count),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { username, email, password } = req.query;

    if (id !== req.jwt?.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { username, email, password },
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

    await user.save();

    res.json(formatUser(user, count));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
