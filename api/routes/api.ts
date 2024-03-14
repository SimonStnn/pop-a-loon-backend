import express from 'express';

import authentication from '../middleware/authentication';
import UserRoutes from './user';

const ApiRoutes = express.Router();

ApiRoutes.use(authentication);
ApiRoutes.use('/user', UserRoutes);

export default ApiRoutes;
