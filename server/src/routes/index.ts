import { Router } from 'express';
import { isProduction } from '../config/env';
import { adminRouter } from './admin.routes';
import { authRouter } from './auth.routes';
import { devRouter } from './dev.routes';
import { healthRouter } from './health.routes';
import { listingsRouter } from './listings.routes';
import { notificationsRouter } from './notifications.routes';
import { offersRouter } from './offers.routes';
import { ordersRouter } from './orders.routes';
import { pricesRouter } from './prices.routes';
import { webhooksRouter } from './webhooks.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/prices', pricesRouter);
apiRouter.use('/listings', listingsRouter);
apiRouter.use('/offers', offersRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/webhooks', webhooksRouter);

// Simulates inbound WhatsApp messages without a Twilio account; available in
// development and in tests (which exercise it directly), never in production.
if (!isProduction) {
  apiRouter.use('/dev', devRouter);
}
