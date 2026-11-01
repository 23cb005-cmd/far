import {
  cancelOrderSchema,
  createRatingSchema,
  paginationSchema,
  type OrderDto,
  type Paginated,
  type RatingDto,
} from '@farmfair/shared';
import { currentUser } from '../middleware/auth';
import {
  cancelOrder,
  confirmPickup,
  getMyOrders,
  payOrder,
  submitRating,
} from '../services/orders';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/respond';

/** GET /orders/mine */
export const getMyOrdersHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const { page, limit } = paginationSchema.parse(req.query);
  const body: Paginated<OrderDto> = await getMyOrders(user, page, limit);
  sendSuccess(res, body);
});

/** PATCH /orders/:id/pay */
export const payOrderHandler = asyncHandler(async (req, res) => {
  const buyer = currentUser(req);
  const order: OrderDto = await payOrder(buyer, req.params.id!);
  sendSuccess(res, order);
});

/** PATCH /orders/:id/confirm */
export const confirmPickupHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const order: OrderDto = await confirmPickup(user, req.params.id!);
  sendSuccess(res, order);
});

/** PATCH /orders/:id/cancel */
export const cancelOrderHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const input = cancelOrderSchema.parse(req.body);
  const order: OrderDto = await cancelOrder(user, req.params.id!, input);
  sendSuccess(res, order);
});

/** POST /orders/:id/rating */
export const submitRatingHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const input = createRatingSchema.parse(req.body);
  const rating: RatingDto = await submitRating(user, req.params.id!, input);
  sendSuccess(res, rating, 201);
});
