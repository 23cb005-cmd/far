import { getCropName, type CropPriceDto } from '@farmfair/shared';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { getLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface PriceTickerProps {
  crops: CropPriceDto[];
}

/**
 * A continuously scrolling strip of today's prices.
 *
 * Purely decorative: the same figures are in the accessible grid right below
 * it, so this is hidden from assistive tech and respects reduced-motion
 * rather than trying to be keyboard- or screen-reader-navigable itself.
 */
export function PriceTicker({ crops }: PriceTickerProps) {
  if (crops.length === 0) return null;

  const language = getLanguage();
  // Duplicated once so the -50% keyframe loops seamlessly.
  const lane = [...crops, ...crops];

  return (
    <div aria-hidden="true" className="relative overflow-hidden rounded-lg border bg-card py-2.5">
      <div
        className={cn(
          'flex w-max items-center gap-8 whitespace-nowrap px-4',
          'animate-ticker motion-reduce:animate-none hover:[animation-play-state:paused]',
        )}
      >
        {lane.map((crop, index) => (
          <span key={`${crop.cropKey}-${index}`} className="flex items-center gap-2 text-sm">
            <span className="font-medium">{getCropName(crop.cropKey, language)}</span>
            <span className="text-muted-foreground">₹{crop.modalPrice}</span>
            {crop.changePercent !== undefined && crop.changePercent !== 0 && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-xs font-medium',
                  crop.changePercent > 0 ? 'text-success' : 'text-danger',
                )}
              >
                {crop.changePercent > 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {Math.abs(crop.changePercent)}%
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
