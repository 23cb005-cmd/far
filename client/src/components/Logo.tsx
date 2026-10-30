import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface LogoProps {
  /** Omit the wordmark, for the collapsed sidebar and small screens. */
  iconOnly?: boolean;
  to?: string;
  className?: string;
}

/** The sprout mark, drawn inline so it needs no network request. */
export function Logo({ iconOnly = false, to = '/', className }: LogoProps) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-2 rounded-md font-semibold tracking-tight',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
          <path
            d="M12 20V10m0 0c0-2.8 2.2-5 5-5 0 2.8-2.2 5-5 5Zm0 0c0-2.8-2.2-5-5-5 0 2.8 2.2 5 5 5Z"
            stroke="hsl(var(--accent))"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!iconOnly && <span className="text-lg">FarmFair</span>}
      {iconOnly && <span className="sr-only">FarmFair</span>}
    </Link>
  );
}
