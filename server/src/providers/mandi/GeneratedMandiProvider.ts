import { CROPS, type District } from '@farmfair/shared';
import type { MandiPriceProvider, RawMandiRecord } from './types';

/**
 * Deterministic fallback used whenever `DATA_GOV_API_KEY` is unset (or the
 * real provider fails): no network, no state, same inputs always produce the
 * same output. That determinism matters twice over - it keeps a 30-day trend
 * chart stable across repeated requests, and keeps tests free of randomness.
 */
export class GeneratedMandiProvider implements MandiPriceProvider {
  readonly name = 'generated' as const;

  async fetchDay(district: District, date: string): Promise<RawMandiRecord[]> {
    const market = `${district} Regular Market`;
    return CROPS.map((crop) => buildRecord(district, date, crop.key, market));
  }
}

/** Plausible modal price per kg, used as the centre of the generated range. */
const BASE_PRICE_PER_KG: Record<string, number> = {
  tomato: 20,
  onion: 26,
  brinjal: 18,
  banana: 16,
  coconut: 28,
  turmeric: 72,
  tapioca: 12,
  groundnut: 58,
  paddy: 21,
  chilli: 95,
  ladies_finger: 22,
  drumstick: 38,
  sugarcane: 3.5,
  maize: 20,
  cotton: 68,
};

function buildRecord(
  district: District,
  date: string,
  cropKey: string,
  market: string,
): RawMandiRecord {
  const base = BASE_PRICE_PER_KG[cropKey] ?? 25;
  const dayIndex = daysSinceEpoch(date);
  const districtPhase = (hashSeed(district) % 1000) / 1000;
  const rnd = mulberry32(hashSeed(`${date}|${district}|${cropKey}`));

  // A slow wave (different phase per district) plus day-to-day jitter, so a
  // 30-day trend looks like a real market rather than flat or pure noise.
  const seasonal = 1 + Math.sin(dayIndex / 18 + districtPhase * Math.PI * 2) * 0.07;
  const jitter = 1 + (rnd() - 0.5) * 0.12;
  const modalPrice = round2(base * seasonal * jitter);

  const spread = 0.1 + rnd() * 0.08;
  const minPrice = round2(modalPrice * (1 - spread / 2));
  const maxPrice = round2(modalPrice * (1 + spread / 2));

  return { market, cropKey, minPrice, maxPrice, modalPrice };
}

function daysSinceEpoch(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 86_400_000);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** FNV-1a: cheap, deterministic, good enough spread for a seed. */
function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: tiny seeded PRNG, deterministic for a given seed. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
