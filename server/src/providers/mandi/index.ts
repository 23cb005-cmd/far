import { env } from '../../config/env';
import { DataGovMandiProvider } from './DataGovMandiProvider';
import { GeneratedMandiProvider } from './GeneratedMandiProvider';
import type { MandiPriceProvider } from './types';

export * from './types';
export { DataGovMandiProvider, GeneratedMandiProvider };

let provider: MandiPriceProvider | null = null;

/** Resolve the configured mandi price source, without a key, generated data is used. */
export function getMandiPriceProvider(): MandiPriceProvider {
  if (provider) return provider;

  provider = env.DATA_GOV_API_KEY
    ? new DataGovMandiProvider(new GeneratedMandiProvider())
    : new GeneratedMandiProvider();

  return provider;
}

/** Test seam: force a specific provider. */
export function setMandiPriceProvider(next: MandiPriceProvider | null): void {
  provider = next;
}
