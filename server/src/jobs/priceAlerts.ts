import type { District } from '@farmfair/shared';
import { env } from '../config/env';
import { MandiPrice } from '../models/MandiPrice';
import { User } from '../models/User';
import { getTodayModalPrice, round2 } from '../services/mandiPrices';
import { notify } from '../services/notifications';
import type { JobResult } from './runner';

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Average modal price on the most recent day before `before` that has data, if any. */
async function previousAverageModalPrice(
  district: District,
  cropKey: string,
  before: string,
): Promise<number | undefined> {
  const prior = await MandiPrice.findOne({ district, cropKey, date: { $lt: before } })
    .sort({ date: -1 })
    .exec();
  if (!prior) return undefined;

  const docs = await MandiPrice.find({ district, cropKey, date: prior.date }).exec();
  return round2(docs.reduce((sum, d) => sum + d.modalPrice, 0) / docs.length);
}

/**
 * For every crop/district with a price today, compare it against the most
 * recent prior day and notify farmers growing that crop in that district
 * when the move is big enough to matter (`PRICE_ALERT_THRESHOLD`).
 */
export async function priceAlerts(): Promise<JobResult> {
  const today = todayDateString();

  const combos = await MandiPrice.aggregate<{ _id: { district: string; cropKey: string } }>([
    { $match: { date: today } },
    { $group: { _id: { district: '$district', cropKey: '$cropKey' } } },
  ]);

  let alertedCombos = 0;
  let notifiedFarmers = 0;

  for (const { _id } of combos) {
    const district = _id.district as District;
    const { cropKey } = _id;

    const [todayPrice, yesterdayAvg] = await Promise.all([
      getTodayModalPrice(district, cropKey),
      previousAverageModalPrice(district, cropKey, today),
    ]);
    // `!yesterdayAvg` also catches a stray zero price, which would otherwise
    // divide-by-zero into an Infinity/NaN change below.
    if (!todayPrice || !yesterdayAvg) continue;

    const changePercent = round2(((todayPrice.modalPrice - yesterdayAvg) / yesterdayAvg) * 100);
    if (Math.abs(changePercent) < env.PRICE_ALERT_THRESHOLD) continue;

    const farmers = await User.find({ role: 'farmer', district, crops: cropKey })
      .select('_id')
      .exec();
    if (farmers.length === 0) continue;

    await Promise.all(
      farmers.map((farmer) =>
        notify(farmer._id, 'price_alert', {
          cropKey,
          district,
          changePercent: Math.abs(changePercent),
          direction: changePercent > 0 ? 'up' : 'down',
        }),
      ),
    );
    alertedCombos += 1;
    notifiedFarmers += farmers.length;
  }

  return {
    summary: `${alertedCombos} crop/district move(s) over ${env.PRICE_ALERT_THRESHOLD}%; notified ${notifiedFarmers} farmer(s)`,
  };
}
