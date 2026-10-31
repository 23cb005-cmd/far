import { CROP_KEYS } from '@farmfair/shared';
import { GeneratedMandiProvider } from '../providers/mandi/GeneratedMandiProvider';

describe('GeneratedMandiProvider', () => {
  const provider = new GeneratedMandiProvider();

  it('returns one record per known crop', async () => {
    const records = await provider.fetchDay('Salem', '2026-01-15');
    expect(records).toHaveLength(CROP_KEYS.length);
    expect(new Set(records.map((r) => r.cropKey))).toEqual(new Set(CROP_KEYS));
  });

  it('is deterministic for the same district, date and crop', async () => {
    const first = await provider.fetchDay('Salem', '2026-01-15');
    const second = await provider.fetchDay('Salem', '2026-01-15');
    expect(second).toEqual(first);
  });

  it('varies by date and by district', async () => {
    const day1 = await provider.fetchDay('Salem', '2026-01-15');
    const day2 = await provider.fetchDay('Salem', '2026-01-16');
    const otherDistrict = await provider.fetchDay('Madurai', '2026-01-15');

    const tomatoDay1 = day1.find((r) => r.cropKey === 'tomato');
    const tomatoDay2 = day2.find((r) => r.cropKey === 'tomato');
    const tomatoOtherDistrict = otherDistrict.find((r) => r.cropKey === 'tomato');

    expect(tomatoDay1?.modalPrice).not.toEqual(tomatoDay2?.modalPrice);
    expect(tomatoDay1?.modalPrice).not.toEqual(tomatoOtherDistrict?.modalPrice);
  });

  it('keeps min <= modal <= max and positive prices', async () => {
    const records = await provider.fetchDay('Salem', '2026-01-15');
    for (const record of records) {
      expect(record.minPrice).toBeGreaterThan(0);
      expect(record.minPrice).toBeLessThanOrEqual(record.modalPrice);
      expect(record.modalPrice).toBeLessThanOrEqual(record.maxPrice);
    }
  });

  it('names the market after the district', async () => {
    const records = await provider.fetchDay('Erode', '2026-01-15');
    expect(records.every((r) => r.market === 'Erode Regular Market')).toBe(true);
  });
});
