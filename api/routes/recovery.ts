import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { body, matchedData, validationResult } from 'express-validator';
import User from '../schemas/user';
import {
  formatUser,
  generateToken,
  getUserCount,
  hashRecoveryCode,
  isValidRecoveryCode,
} from '../utils';

const recoverLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests' },
});

const router = express.Router();

router.use('/recover', recoverLimiter);
router.post(
  '/recover',
  body('code').isString().trim().custom(isValidRecoveryCode),
  async (req: Request, res: Response) => {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      res.status(400).json({ error: 'Invalid recovery code' });
      return;
    }

    const { code } = matchedData(req) as { code: string };
    const user = await User.findOne({ recoveryHash: hashRecoveryCode(code) });
    if (!user) {
      res.status(401).json({ error: 'Invalid recovery code' });
      return;
    }

    res.json({
      token: generateToken(user.id),
      ...formatUser(user, await getUserCount(user.id), { id: user.id }),
    });
  },
);

export default router;
