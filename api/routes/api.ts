import express from 'express';

import authentication from '../middleware/authentication';
import logging from '../middleware/logging';
import StatusRoutes from './status';
import UserRoutes from './user';
import LeaderboardRoutes from './leaderboard';
import ConfigRoutes from './config';

const ApiRoutes = express.Router();

if (process.env.NODE_ENV === 'development') ApiRoutes.use(logging);
ApiRoutes.use(authentication);
ApiRoutes.use('/status', StatusRoutes);
ApiRoutes.use('/user', UserRoutes);
ApiRoutes.use('/leaderboard', LeaderboardRoutes);
ApiRoutes.use('/configuration', ConfigRoutes);

export default ApiRoutes;
