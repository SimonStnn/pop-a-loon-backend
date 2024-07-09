import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { query, param, matchedData, validationResult } from 'express-validator';
import User from '../schemas/user';
import Count from '../schemas/count';
import CountHistory from '../schemas/counthistory';
import { balloonTranslation, JWTSignature, ResponseSchema } from '../const';
import {
  formatUser,
  getUserAndCount,
  getUserCount,
  validation,
} from '../utils';

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

router.get('/', async (req: Request, res: Response) => {
  const id = req.jwt!.id;
  res.json(await getUserAndCount(id, req, res));
});

router.get(
  '/:id',
  param('id').isString().trim().custom(validation.objectId),
  async (req: Request, res: Response) => {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }
    const data = matchedData(req);
    const id = data.id;
    res.json(await getUserAndCount(id, req, res));
  },
);

router.use('/count/increment', countLimiter);
router.post('/count/increment', async (req: Request, res: Response) => {
  const id = req.jwt!.id;
  const balloonType: keyof typeof balloonTranslation =
    req.query.type && req.query.type?.toString() in balloonTranslation
      ? (req.query.type.toString() as keyof typeof balloonTranslation)
      : 'default';

  const countHistory = new CountHistory({
    user: id,
    type: balloonTranslation[balloonType],
  });
  await countHistory.save();

  res.json({
    id: id,
    count: (await getUserCount(id, res)).count,
  });
});

router.use('/new', newUserLimiter);
router.post(
  '/new',
  validation.username(query('username')),
  query('email').isEmail().normalizeEmail(),
  async (req: Request, res: Response) => {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      res.status(400).json({ error: 'Invalid username or email' });
      return;
    }
    const { username, email } = matchedData(req);

    const user = new User({ username, email });

    // Save the user and create a count document
    await user.save();

    // Send the user and count documents with token
    res.json({
      token: jwt.sign({ id: user.id } as JWTSignature, process.env.JWT_SECRET!),
      ...formatUser(user, { count: 0 }, req.jwt),
    });
  },
);

router.put(
  '/',
  validation.username(query('username')),
  query('email').isEmail().normalizeEmail(),
  async (req: Request, res: Response) => {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      res.status(400).json({ error: 'Invalid username or email' });
      return;
    }
    const id = req.jwt!.id;
    const { username, email } = matchedData(req);

    // Update the user and count document
    const user = await User.findByIdAndUpdate(
      id,
      { username, email },
      { new: true },
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Save the user document
    await user.save();

    // Send the updated user and count documents
    res.json(
      formatUser(
        user,
        await getUserCount(id, res),
        req.jwt!,
      ) as ResponseSchema['user'],
    );
  },
);

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
