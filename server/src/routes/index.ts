import { Router } from 'express';
import { adminRouter } from './admin.routes';
import { authRouter } from './auth.routes';
import { healthRouter } from './health.routes';
import { listingsRouter } from './listings.routes';
import { notificationsRouter } from './notifications.routes';
import { offersRouter } from './offers.routes';
import { ordersRouter } from './orders.routes';
import { pricesRouter } from './prices.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/prices', pricesRouter);
apiRouter.use('/listings', listingsRouter);
apiRouter.use('/offers', offersRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/admin', adminRouter);
