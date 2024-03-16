import express from 'express';

import authentication from '../middleware/authentication';
import UserRoutes from './user';
import LeaderboardRoutes from './leaderboard';

const ApiRoutes = express.Router();

ApiRoutes.use(authentication);
ApiRoutes.use('/user', UserRoutes);
ApiRoutes.use('/leaderboard', LeaderboardRoutes);

export default ApiRoutes;
