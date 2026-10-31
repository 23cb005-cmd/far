import { isCropKey, type District } from '@farmfair/shared';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { GeneratedMandiProvider } from './GeneratedMandiProvider';
import type { MandiPriceProvider, RawMandiRecord } from './types';

/**
 * "Variety-wise Daily Market Prices Data for Commodity" on data.gov.in
 * (the Agmarknet mandi feed). Resource id is stable and public.
 */
const RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const REQUEST_TIMEOUT_MS = 8000;

interface DataGovRecord {
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  variety?: string;
  min_price?: string;
  max_price?: string;
  modal_price?: string;
}

interface DataGovResponse {
  records?: DataGovRecord[];
}

/**
 * The feed's commodity names are free text and do not match our crop keys
 * ("Bhindi(Ladies Finger)", "Chilly Red", "Paddy(Dhan)(Common)", ...). Matched
 * by substring against the lowercased name; first match wins.
 */
const COMMODITY_NEEDLES: ReadonlyArray<readonly [string, string]> = [
  ['tomato', 'tomato'],
  ['onion', 'onion'],
  ['brinjal', 'brinjal'],
  ['banana', 'banana'],
  ['coconut', 'coconut'],
  ['turmeric', 'turmeric'],
  ['tapioca', 'tapioca'],
  ['groundnut', 'groundnut'],
  ['paddy', 'paddy'],
  ['bhindi', 'ladies_finger'],
  ['ladies finger', 'ladies_finger'],
  ['drumstick', 'drumstick'],
  ['sugarcane', 'sugarcane'],
  ['maize', 'maize'],
  ['cotton', 'cotton'],
  ['chilly', 'chilli'],
  ['chilli', 'chilli'],
];

function matchCropKey(commodity: string | undefined): string | undefined {
  if (!commodity) return undefined;
  const normalised = commodity.toLowerCase();
  const match = COMMODITY_NEEDLES.find(([needle]) => normalised.includes(needle));
  return match && isCropKey(match[1]) ? match[1] : undefined;
}

function toDdMmYyyy(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function toRawRecord(record: DataGovRecord): RawMandiRecord | null {
  const cropKey = matchCropKey(record.commodity);
  if (!cropKey || !record.market) return null;

  const minPrice = Number(record.min_price);
  const maxPrice = Number(record.max_price);
  const modalPrice = Number(record.modal_price);
  if (![minPrice, maxPrice, modalPrice].every((n) => Number.isFinite(n) && n > 0)) return null;

  return {
    market: record.market,
    cropKey,
    ...(record.variety ? { variety: record.variety } : {}),
    minPrice,
    maxPrice,
    modalPrice,
  };
}

/**
 * Real data source. Falls back to the generated provider rather than
 * throwing whenever the feed is unreachable, empty for that day (common on
 * mandi holidays) or the key is rejected - a farmer should never see a broken
 * page because a government API had a bad day.
 */
export class DataGovMandiProvider implements MandiPriceProvider {
  readonly name = 'data_gov' as const;

  constructor(private readonly fallback: GeneratedMandiProvider) {}

  async fetchDay(district: District, date: string): Promise<RawMandiRecord[]> {
    try {
      const records = await this.fetchFromApi(district, date);
      if (records.length > 0) return records;
      logger.warn(
        { district, date },
        '[mandi] data.gov.in returned no usable records; using generated fallback',
      );
    } catch (error) {
      logger.warn(
        { district, date, err: error instanceof Error ? error.message : String(error) },
        '[mandi] data.gov.in fetch failed; using generated fallback',
      );
    }
    return this.fallback.fetchDay(district, date);
  }

  private async fetchFromApi(district: District, date: string): Promise<RawMandiRecord[]> {
    const url = new URL(`https://api.data.gov.in/resource/${RESOURCE_ID}`);
    url.searchParams.set('api-key', env.DATA_GOV_API_KEY ?? '');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '500');
    url.searchParams.set('filters[state]', env.DATA_GOV_STATE);
    url.searchParams.set('filters[district]', district);
    url.searchParams.set('filters[arrival_date]', toDdMmYyyy(date));

    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
      throw new Error(`data.gov.in responded with ${response.status}`);
    }

    const body = (await response.json()) as DataGovResponse;
    const byMarketAndCrop = new Map<string, RawMandiRecord>();

    for (const raw of body.records ?? []) {
      const record = toRawRecord(raw);
      if (!record) continue;
      // The feed can list the same market/crop more than once (different
      // grades); keep the first, which is what a shopper sees first too.
      const key = `${record.market}|${record.cropKey}`;
      if (!byMarketAndCrop.has(key)) byMarketAndCrop.set(key, record);
    }

    return [...byMarketAndCrop.values()];
  }
}
