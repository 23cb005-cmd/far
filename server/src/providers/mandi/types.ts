import type { District, MandiPriceSource } from '@farmfair/shared';

export interface RawMandiRecord {
  market: string;
  cropKey: string;
  variety?: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
}

/**
 * Source of daily mandi prices. Swapping the data source should mean adding
 * one file here and changing `DATA_GOV_API_KEY`, nothing else.
 */
export interface MandiPriceProvider {
  readonly name: MandiPriceSource;
  /** `date` is `YYYY-MM-DD`. One call covers every crop for that district/day. */
  fetchDay(district: District, date: string): Promise<RawMandiRecord[]>;
}
