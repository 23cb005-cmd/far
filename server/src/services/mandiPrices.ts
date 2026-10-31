import {
  CROP_KEYS,
  FAIR_PRICE_TOLERANCE_PERCENT,
  getCrop,
  type CropPriceDto,
  type District,
  type FairPriceCheckResponse,
  type FairPriceVerdict,
  type MandiPriceSource,
  type PriceTrendPoint,
  type PriceTrendResponse,
  type TodayPricesResponse,
} from '@farmfair/shared';
import { logger } from '../config/logger';
import { MandiPrice, type MandiPriceDocument } from '../models/MandiPrice';
import { getMandiPriceProvider } from '../providers/mandi';
import { AppError } from '../utils/AppError';

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Fetch and cache one district's day, if it is not already in the database.
 *
 * Never throws: both providers already fall back on their own failures, but a
 * bug here should degrade to "no price for that day" rather than a 500 on a
 * page a farmer depends on.
 */
async function ensureDayIngested(district: District, date: string): Promise<void> {
  const exists = await MandiPrice.exists({ district, date });
  if (exists) return;

  try {
    const provider = getMandiPriceProvider();
    const records = await provider.fetchDay(district, date);
    if (records.length === 0) return;

    await MandiPrice.bulkWrite(
      records.map((record) => ({
        updateOne: {
          filter: { date, district, cropKey: record.cropKey, market: record.market },
          update: {
            $setOnInsert: {
              date,
              district,
              cropKey: record.cropKey,
              market: record.market,
              ...(record.variety ? { variety: record.variety } : {}),
              minPrice: record.minPrice,
              maxPrice: record.maxPrice,
              modalPrice: record.modalPrice,
              unit: 'kg',
              source: provider.name,
            },
          },
          upsert: true,
        },
      })),
    );
  } catch (error) {
    logger.error(
      { district, date, err: error instanceof Error ? error.message : String(error) },
      '[mandi] failed to ingest prices',
    );
  }
}

/** Bounded concurrency so a cold trend request does not fire 90 requests at once. */
const INGEST_BATCH_SIZE = 5;

async function ensureRangeIngested(district: District, dates: string[]): Promise<void> {
  for (let i = 0; i < dates.length; i += INGEST_BATCH_SIZE) {
    const batch = dates.slice(i, i + INGEST_BATCH_SIZE);
    await Promise.all(batch.map((date) => ensureDayIngested(district, date)));
  }
}

function aggregateByCrop(
  docs: MandiPriceDocument[],
  date: string,
  district: District,
): Map<string, CropPriceDto> {
  const grouped = new Map<string, MandiPriceDocument[]>();
  for (const doc of docs) {
    const list = grouped.get(doc.cropKey) ?? [];
    list.push(doc);
    grouped.set(doc.cropKey, list);
  }

  const result = new Map<string, CropPriceDto>();
  for (const [cropKey, group] of grouped) {
    result.set(cropKey, {
      cropKey,
      unit: 'kg',
      date,
      district,
      minPrice: Math.min(...group.map((g) => g.minPrice)),
      maxPrice: Math.max(...group.map((g) => g.maxPrice)),
      modalPrice: round2(group.reduce((sum, g) => sum + g.modalPrice, 0) / group.length),
      markets: [...new Set(group.map((g) => g.market))],
      source: group[0]!.source,
    });
  }
  return result;
}

/**
 * Today's price per crop for a district, with the day-over-day change where
 * yesterday's price is available. `cropKeys` narrows the result (a farmer's
 * own crops); omit it to return every crop.
 */
export async function getTodayPrices(
  district: District,
  cropKeys?: string[],
): Promise<TodayPricesResponse> {
  const date = todayDateString();
  const yesterday = addDays(date, -1);

  await Promise.all([ensureDayIngested(district, date), ensureDayIngested(district, yesterday)]);

  const [todayDocs, yesterdayDocs] = await Promise.all([
    MandiPrice.find({ district, date }).exec(),
    MandiPrice.find({ district, date: yesterday }).exec(),
  ]);

  const todayByCrop = aggregateByCrop(todayDocs, date, district);
  const yesterdayByCrop = aggregateByCrop(yesterdayDocs, yesterday, district);

  const keys = cropKeys && cropKeys.length > 0 ? cropKeys : CROP_KEYS;
  const crops: CropPriceDto[] = [];
  for (const key of keys) {
    const today = todayByCrop.get(key);
    if (!today) continue;
    const previous = yesterdayByCrop.get(key);
    const changePercent = previous
      ? round2(((today.modalPrice - previous.modalPrice) / previous.modalPrice) * 100)
      : undefined;
    crops.push(changePercent === undefined ? today : { ...today, changePercent });
  }

  return { district, date, crops };
}

/** Daily modal price for one crop in one district, over the trailing `days`. */
export async function getPriceTrend(
  district: District,
  cropKey: string,
  days: number,
): Promise<PriceTrendResponse> {
  const today = todayDateString();
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) dates.push(addDays(today, -i));

  await ensureRangeIngested(district, dates);

  const docs = await MandiPrice.find({ district, cropKey, date: { $in: dates } })
    .sort({ date: 1 })
    .exec();

  const byDate = new Map<string, MandiPriceDocument[]>();
  for (const doc of docs) {
    const list = byDate.get(doc.date) ?? [];
    list.push(doc);
    byDate.set(doc.date, list);
  }

  const points: PriceTrendPoint[] = [];
  let source: MandiPriceSource = getMandiPriceProvider().name;
  for (const date of dates) {
    const group = byDate.get(date);
    if (!group || group.length === 0) continue;
    points.push({
      date,
      modalPrice: round2(group.reduce((sum, g) => sum + g.modalPrice, 0) / group.length),
    });
    source = group[0]!.source;
  }

  const crop = getCrop(cropKey);
  return { district, cropKey, unit: crop?.unit ?? 'kg', source, points };
}

export interface TodayModalPrice {
  modalPrice: number;
  source: MandiPriceSource;
}

/**
 * Today's modal price for a crop/district, or `undefined` when none is
 * available yet. Shared by the fair-price checker and by offers, which
 * snapshot it to show "this offer is N% below market" (Phase 3).
 */
export async function getTodayModalPrice(
  district: District,
  cropKey: string,
): Promise<TodayModalPrice | undefined> {
  const date = todayDateString();
  await ensureDayIngested(district, date);

  const docs = await MandiPrice.find({ district, date, cropKey }).exec();
  if (docs.length === 0) return undefined;

  return {
    modalPrice: round2(docs.reduce((sum, d) => sum + d.modalPrice, 0) / docs.length),
    source: docs[0]!.source,
  };
}

/** How a quoted price compares with today's modal price for that crop/district. */
export async function checkFairPrice(
  district: District,
  cropKey: string,
  price: number,
): Promise<FairPriceCheckResponse> {
  const date = todayDateString();
  const today = await getTodayModalPrice(district, cropKey);
  if (!today) {
    throw AppError.notFound("Today's price for this crop is not available yet");
  }
  const { modalPrice, source } = today;

  const diffPercent = round2(((price - modalPrice) / modalPrice) * 100);
  const verdict: FairPriceVerdict =
    diffPercent < -FAIR_PRICE_TOLERANCE_PERCENT
      ? 'below_market'
      : diffPercent > FAIR_PRICE_TOLERANCE_PERCENT
        ? 'above_market'
        : 'fair';

  const crop = getCrop(cropKey);
  return {
    district,
    cropKey,
    unit: crop?.unit ?? 'kg',
    date,
    modalPrice,
    yourPrice: price,
    diffPercent,
    verdict,
    source,
  };
}
