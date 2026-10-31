import type { UserDto } from '@farmfair/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { renderWithProviders } from '@/test/utils';
import PricesPage from './PricesPage';

const today = vi.fn();
const trend = vi.fn();
const fairCheck = vi.fn();

vi.mock('@/lib/pricesApi', () => ({
  pricesApi: {
    today: (...args: unknown[]) => today(...args),
    trend: (...args: unknown[]) => trend(...args),
    fairCheck: (...args: unknown[]) => fairCheck(...args),
  },
}));

const FARMER: UserDto = {
  id: 'u1',
  name: 'Murugan S',
  phone: '+919876543210',
  role: 'farmer',
  district: 'Salem',
  crops: ['tomato', 'onion'],
  language: 'en',
  verificationStatus: 'not_required',
  isSuspended: false,
  notifyWhatsApp: true,
  phoneVerified: false,
  ratingAvg: 0,
  ratingCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const TODAY_RESPONSE = {
  district: 'Salem',
  date: '2026-01-15',
  crops: [
    {
      cropKey: 'tomato',
      unit: 'kg' as const,
      date: '2026-01-15',
      district: 'Salem',
      minPrice: 17,
      maxPrice: 20,
      modalPrice: 18.5,
      markets: ['Salem Regular Market'],
      source: 'generated' as const,
      changePercent: 5.2,
    },
    {
      cropKey: 'onion',
      unit: 'kg' as const,
      date: '2026-01-15',
      district: 'Salem',
      minPrice: 24,
      maxPrice: 27,
      modalPrice: 25.5,
      markets: ['Salem Regular Market'],
      source: 'generated' as const,
      changePercent: -3.1,
    },
  ],
};

const TREND_RESPONSE = {
  district: 'Salem',
  cropKey: 'tomato',
  unit: 'kg' as const,
  source: 'generated' as const,
  points: [
    { date: '2026-01-13', modalPrice: 17 },
    { date: '2026-01-14', modalPrice: 18 },
    { date: '2026-01-15', modalPrice: 18.5 },
  ],
};

describe('PricesPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: FARMER, initialising: false });
    today.mockReset().mockResolvedValue(TODAY_RESPONSE);
    trend.mockReset().mockResolvedValue(TREND_RESPONSE);
    fairCheck.mockReset();
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, initialising: true });
  });

  it("shows today's prices for the signed-in farmer's district and crops", async () => {
    renderWithProviders(<PricesPage />);

    await screen.findAllByText('₹18.5');
    await screen.findByText('Daily price trend');
    expect(today).toHaveBeenCalledWith('Salem');

    const todaySection = screen.getByText("Today's prices").closest('div')!.parentElement!
      .parentElement!;
    expect(within(todaySection).getByText('₹18.5')).toBeInTheDocument();
    expect(within(todaySection).getByText('₹25.5')).toBeInTheDocument();
    expect(within(todaySection).getByText('Tomato')).toBeInTheDocument();
    expect(within(todaySection).getByText('Onion')).toBeInTheDocument();
    expect(within(todaySection).getAllByText(/indicative sample data/i)).toHaveLength(2);
  });

  it('shows the day-over-day change for each crop', async () => {
    renderWithProviders(<PricesPage />);

    expect(await screen.findByText(/\+5\.2% vs yesterday/)).toBeInTheDocument();
    expect(screen.getByText(/-3\.1% vs yesterday/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no prices for the selection', async () => {
    today.mockReset().mockResolvedValue({ district: 'Salem', date: '2026-01-15', crops: [] });
    renderWithProviders(<PricesPage />);

    expect(await screen.findByText(/no prices yet for this selection/i)).toBeInTheDocument();
  });

  it("loads the 30-day trend for the first of the user's crops by default", async () => {
    renderWithProviders(<PricesPage />);

    await waitFor(() => expect(trend).toHaveBeenCalledWith('Salem', 'tomato', 30));
    // The chart's accessible fallback table carries the real data.
    expect(await screen.findByText('Daily price trend')).toBeInTheDocument();
  });

  it('refetches the trend with a different day count', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PricesPage />);

    await waitFor(() => expect(trend).toHaveBeenCalledWith('Salem', 'tomato', 30));

    await user.click(screen.getByRole('button', { name: '7 days' }));

    await waitFor(() => expect(trend).toHaveBeenCalledWith('Salem', 'tomato', 7));
  });

  it('shows an empty state when the trend has fewer than two points', async () => {
    trend.mockReset().mockResolvedValue({ ...TREND_RESPONSE, points: [] });
    renderWithProviders(<PricesPage />);

    expect(await screen.findByText(/not enough data yet for this crop/i)).toBeInTheDocument();
  });

  it('checks a price and shows a "fair" verdict', async () => {
    const user = userEvent.setup();
    fairCheck.mockResolvedValue({
      district: 'Salem',
      cropKey: 'tomato',
      unit: 'kg',
      date: '2026-01-15',
      modalPrice: 18.5,
      yourPrice: 18.5,
      diffPercent: 0,
      verdict: 'fair',
      source: 'generated',
    });

    renderWithProviders(<PricesPage />);
    await screen.findAllByText('₹18.5');
    await screen.findByText('Daily price trend');

    await user.clear(screen.getByLabelText(/price you were offered/i));
    await user.type(screen.getByLabelText(/price you were offered/i), '18.5');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText('Fair price')).toBeInTheDocument();
    expect(
      screen.getByText(/within 5% of today's average of ₹18\.5 per kg in Salem/),
    ).toBeInTheDocument();
    expect(fairCheck).toHaveBeenCalledWith({ district: 'Salem', crop: 'tomato', price: 18.5 });
  });

  it('checks a low price and shows a "below market" verdict', async () => {
    const user = userEvent.setup();
    fairCheck.mockResolvedValue({
      district: 'Salem',
      cropKey: 'tomato',
      unit: 'kg',
      date: '2026-01-15',
      modalPrice: 18.5,
      yourPrice: 10,
      diffPercent: -45.95,
      verdict: 'below_market',
      source: 'generated',
    });

    renderWithProviders(<PricesPage />);
    await screen.findAllByText('₹18.5');
    await screen.findByText('Daily price trend');

    await user.clear(screen.getByLabelText(/price you were offered/i));
    await user.type(screen.getByLabelText(/price you were offered/i), '10');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText('Below market')).toBeInTheDocument();
  });

  it("shows a dedicated message when today's price is not available yet", async () => {
    const user = userEvent.setup();
    fairCheck.mockRejectedValue(
      new ApiRequestError(404, 'NOT_FOUND', "Today's price for this crop is not available yet"),
    );

    renderWithProviders(<PricesPage />);
    await screen.findAllByText('₹18.5');
    await screen.findByText('Daily price trend');

    await user.clear(screen.getByLabelText(/price you were offered/i));
    await user.type(screen.getByLabelText(/price you were offered/i), '20');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(
      await screen.findByText(/today's price for this crop is not available yet/i),
    ).toBeInTheDocument();
  });
});
