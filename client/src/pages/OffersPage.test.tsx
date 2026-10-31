import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import OffersPage from './OffersPage';

const mine = vi.fn();
const withdraw = vi.fn();

vi.mock('@/lib/offersApi', () => ({
  offersApi: {
    mine: (...args: unknown[]) => mine(...args),
    withdraw: (...args: unknown[]) => withdraw(...args),
    forListing: vi.fn(),
    create: vi.fn(),
    decline: vi.fn(),
  },
}));

const OFFER = {
  id: 'o1',
  listing: {
    id: 'l1',
    cropKey: 'tomato',
    grade: 'A' as const,
    pricePerKg: 22,
    quantityKg: 200,
    district: 'Salem',
    status: 'active' as const,
  },
  buyer: {
    id: 'b1',
    name: 'Priya R',
    role: 'buyer' as const,
    district: 'Coimbatore',
    verified: true,
    ratingAvg: 0,
    ratingCount: 0,
    memberSince: '2026-01-01T00:00:00.000Z',
  },
  quantityKg: 50,
  offeredPricePerKg: 20,
  status: 'pending' as const,
  createdAt: '2026-01-16T00:00:00.000Z',
  updatedAt: '2026-01-16T00:00:00.000Z',
};

function page<T>(items: T[]) {
  return {
    items,
    meta: {
      page: 1,
      limit: 20,
      total: items.length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

describe('OffersPage', () => {
  beforeEach(() => {
    mine.mockReset().mockResolvedValue(page([OFFER]));
    withdraw.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the buyer's own offers with the asking price", async () => {
    renderWithProviders(<OffersPage />);

    expect(await screen.findByText('Tomato')).toBeInTheDocument();
    expect(screen.getByText(/you offered ₹20/i)).toBeInTheDocument();
    expect(screen.getByText(/asking ₹22/i)).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows an empty state when there are no offers', async () => {
    mine.mockReset().mockResolvedValue(page([]));
    renderWithProviders(<OffersPage />);

    expect(await screen.findByText(/haven't made any offers yet/i)).toBeInTheDocument();
  });

  it('withdraws a pending offer', async () => {
    const user = userEvent.setup();
    withdraw.mockResolvedValue({ ...OFFER, status: 'withdrawn' });

    renderWithProviders(<OffersPage />);
    await screen.findByText('Tomato');

    await user.click(screen.getByRole('button', { name: /withdraw offer/i }));

    await waitFor(() => expect(withdraw).toHaveBeenCalledWith('o1'));
  });

  it('shows the decline reason and no withdraw button for a declined offer', async () => {
    mine
      .mockReset()
      .mockResolvedValue(
        page([{ ...OFFER, status: 'declined' as const, declineReason: 'Already sold out' }]),
      );

    renderWithProviders(<OffersPage />);

    expect(await screen.findByText('Declined')).toBeInTheDocument();
    expect(screen.getByText(/already sold out/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /withdraw offer/i })).not.toBeInTheDocument();
  });
});
