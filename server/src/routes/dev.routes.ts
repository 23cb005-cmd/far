import { devBotSimulateSchema } from '@farmfair/shared';
import { Router } from 'express';
import { simulateBotMessageHandler } from '../controllers/dev.controller';
import { validate } from '../middleware/validate';

export const devRouter = Router();

devRouter.post('/bot', validate({ body: devBotSimulateSchema }), simulateBotMessageHandler);
