import {
  fairPriceCheckSchema,
  priceTrendQuerySchema,
  todayPricesQuerySchema,
  type District,
  type FairPriceCheckResponse,
  type PriceTrendResponse,
  type TodayPricesResponse,
} from '@farmfair/shared';
import { currentUser } from '../middleware/auth';
import { checkFairPrice, getPriceTrend, getTodayPrices } from '../services/mandiPrices';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/respond';

/** GET /prices/today?district= */
export const getTodayPricesHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const query = todayPricesQuerySchema.parse(req.query);
  // `user.district` is plain `string` on the model but is enum-validated by
  // Mongoose at write time, so this narrowing is safe.
  const district = query.district ?? (user.district as District);
  // A farmer sees their own crops first; everyone else sees the full board.
  const cropKeys = user.crops.length > 0 ? user.crops : undefined;

  const body: TodayPricesResponse = await getTodayPrices(district, cropKeys);
  sendSuccess(res, body);
});

/** GET /prices/trend?district=&crop=&days= */
export const getPriceTrendHandler = asyncHandler(async (req, res) => {
  const query = priceTrendQuerySchema.parse(req.query);

  const body: PriceTrendResponse = await getPriceTrend(query.district, query.crop, query.days);
  sendSuccess(res, body);
});

/** POST /prices/fair-check */
export const checkFairPriceHandler = asyncHandler(async (req, res) => {
  const input = fairPriceCheckSchema.parse(req.body);

  const body: FairPriceCheckResponse = await checkFairPrice(
    input.district,
    input.crop,
    input.price,
  );
  sendSuccess(res, body);
});
