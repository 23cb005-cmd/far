import type { PriceTrendPoint } from '@farmfair/shared';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface PriceTrendChartProps {
  points: PriceTrendPoint[];
  className?: string;
}

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 200;
const PADDING_Y = 16;

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Hand-rolled rather than a charting library: one line, one series, a handful
 * of points - adding a dependency for this would cost more in bundle size
 * than it saves in code, and this app is built for a 3G connection.
 */
export function PriceTrendChart({ points, className }: PriceTrendChartProps) {
  const { t } = useTranslation();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const gradientId = React.useId();

  const last = points[points.length - 1];
  if (points.length < 2 || !last) return null;

  const prices = points.map((p) => p.modalPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const toX = (index: number) => (index / (points.length - 1)) * VIEW_WIDTH;
  const toY = (price: number) =>
    VIEW_HEIGHT - PADDING_Y - ((price - min) / range) * (VIEW_HEIGHT - PADDING_Y * 2);

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.modalPrice)}`)
    .join(' ');
  const areaPath = `${linePath} L ${toX(points.length - 1)} ${VIEW_HEIGHT} L ${toX(0)} ${VIEW_HEIGHT} Z`;

  const updateHover = (clientX: number): void => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setHoverIndex(Math.round(fraction * (points.length - 1)));
  };

  const hovered = hoverIndex !== null ? points[hoverIndex] : undefined;
  const hoveredX = hoverIndex !== null ? toX(hoverIndex) : 0;

  return (
    <div className={cn('select-none', className)}>
      <div
        ref={containerRef}
        className="relative touch-none"
        style={{ height: VIEW_HEIGHT }}
        onPointerMove={(event) => updateHover(event.clientX)}
        onPointerDown={(event) => updateHover(event.clientX)}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
          <path
            d={linePath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={toX(points.length - 1)}
            cy={toY(last.modalPrice)}
            r={4}
            fill="hsl(var(--primary))"
          />
          {hoverIndex !== null && hovered && (
            <>
              <line
                x1={hoveredX}
                x2={hoveredX}
                y1={0}
                y2={VIEW_HEIGHT}
                stroke="hsl(var(--border))"
              />
              <circle
                cx={hoveredX}
                cy={toY(hovered.modalPrice)}
                r={5}
                fill="hsl(var(--background))"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
              />
            </>
          )}
        </svg>

        {/* Direct label on the latest point - the one number worth always showing. */}
        <span
          className="pointer-events-none absolute rounded bg-card px-1.5 py-0.5 text-xs font-semibold text-foreground shadow-sm"
          style={{
            left: `${(toX(points.length - 1) / VIEW_WIDTH) * 100}%`,
            top: `${(toY(last.modalPrice) / VIEW_HEIGHT) * 100}%`,
            transform: 'translate(-100%, -150%)',
          }}
        >
          ₹{last.modalPrice}
        </span>

        {hovered && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: `${(hoveredX / VIEW_WIDTH) * 100}%`,
              top: `${(toY(hovered.modalPrice) / VIEW_HEIGHT) * 100}%`,
              transform: 'translate(-50%, calc(-100% - 10px))',
            }}
          >
            <div className="font-medium text-popover-foreground">
              {formatShortDate(hovered.date)}
            </div>
            <div className="text-muted-foreground">₹{hovered.modalPrice}</div>
          </div>
        )}
      </div>

      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{formatShortDate(points[0]!.date)}</span>
        <span>{formatShortDate(last.date)}</span>
      </div>

      <table className="sr-only">
        <caption>{t('prices.trend.srCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('prices.trend.srDate')}</th>
            <th scope="col">{t('prices.trend.srPricePerKg')}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{point.modalPrice}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
