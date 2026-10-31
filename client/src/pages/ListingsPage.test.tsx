import type { UserDto } from '@farmfair/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { renderWithProviders } from '@/test/utils';
import ListingsPage from './ListingsPage';

const mine = vi.fn();
const create = vi.fn();
const withdraw = vi.fn();
const forListing = vi.fn();
const decline = vi.fn();

vi.mock('@/lib/listingsApi', () => ({
  listingsApi: {
    mine: (...args: unknown[]) => mine(...args),
    create: (...args: unknown[]) => create(...args),
    withdraw: (...args: unknown[]) => withdraw(...args),
    browse: vi.fn(),
    detail: vi.fn(),
  },
}));

vi.mock('@/lib/offersApi', () => ({
  offersApi: {
    forListing: (...args: unknown[]) => forListing(...args),
    decline: (...args: unknown[]) => decline(...args),
    mine: vi.fn(),
    create: vi.fn(),
    withdraw: vi.fn(),
  },
}));

const FARMER: UserDto = {
  id: 'u1',
  name: 'Murugan S',
  phone: '+919876543210',
  role: 'farmer',
  district: 'Salem',
  crops: ['tomato'],
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

const LISTING = {
  id: 'l1',
  farmer: {
    id: 'u1',
    name: 'Murugan S',
    role: 'farmer' as const,
    district: 'Salem',
    verified: true,
    ratingAvg: 0,
    ratingCount: 0,
    memberSince: '2026-01-01T00:00:00.000Z',
  },
  cropKey: 'tomato',
  grade: 'A' as const,
  quantityKg: 200,
  pricePerKg: 22,
  readyDate: '2026-02-01T00:00:00.000Z',
  district: 'Salem',
  status: 'active' as const,
  expiresAt: '2026-02-10T00:00:00.000Z',
  offerCount: 1,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
};

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
    ratingAvg: 4.5,
    ratingCount: 3,
    memberSince: '2026-01-01T00:00:00.000Z',
  },
  quantityKg: 50,
  offeredPricePerKg: 20,
  marketPriceAtOffer: 22,
  diffPercent: -9.1,
  status: 'pending' as const,
  createdAt: '2026-01-16T00:00:00.000Z',
  updatedAt: '2026-01-16T00:00:00.000Z',
};

const EMPTY_PAGE = {
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
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

describe('ListingsPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: FARMER, initialising: false });
    mine.mockReset().mockResolvedValue(page([LISTING]));
    create.mockReset();
    withdraw.mockReset();
    forListing.mockReset().mockResolvedValue(page([OFFER]));
    decline.mockReset();
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, initialising: true });
  });

  it("shows the farmer's own listings", async () => {
    renderWithProviders(<ListingsPage />);

    expect(await screen.findByText('Tomato')).toBeInTheDocument();
    expect(screen.getByText('₹22', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('1 offer')).toBeInTheDocument();
  });

  it('shows an empty state when there are no listings', async () => {
    mine.mockReset().mockResolvedValue(EMPTY_PAGE);
    renderWithProviders(<ListingsPage />);

    expect(await screen.findByText(/haven't listed any crops yet/i)).toBeInTheDocument();
  });

  it('creates a listing with the form defaults', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({ ...LISTING, id: 'l2' });

    renderWithProviders(<ListingsPage />);
    await screen.findByText('Tomato');

    await user.click(screen.getByRole('button', { name: /list a crop/i }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/quantity \(kg\)/i), {
      target: { value: '100' },
    });
    fireEvent.change(within(dialog).getByLabelText(/price you want/i), { target: { value: '18' } });
    fireEvent.change(within(dialog).getByLabelText(/ready for pickup on/i), {
      target: { value: '2026-02-01' },
    });

    await user.click(within(dialog).getByRole('button', { name: /^list this crop$/i }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          cropKey: 'tomato',
          grade: 'A',
          quantityKg: 100,
          pricePerKg: 18,
          readyDate: '2026-02-01',
        }),
      ),
    );
  });

  it('withdraws a listing', async () => {
    const user = userEvent.setup();
    withdraw.mockResolvedValue({ ...LISTING, status: 'withdrawn' });

    renderWithProviders(<ListingsPage />);
    await screen.findByText('Tomato');

    await user.click(screen.getByRole('button', { name: /withdraw listing/i }));

    await waitFor(() => expect(withdraw).toHaveBeenCalledWith('l1'));
  });

  it('shows offers received and lets the farmer decline one', async () => {
    const user = userEvent.setup();
    decline.mockResolvedValue({ ...OFFER, status: 'declined', declineReason: 'Sold out' });

    renderWithProviders(<ListingsPage />);
    await screen.findByText('Tomato');

    await user.click(screen.getByRole('button', { name: /view offers/i }));

    expect(await screen.findByText('Priya R')).toBeInTheDocument();
    expect(screen.getByText(/9\.1% below today's rate/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^decline$/i }));
    await user.type(screen.getByPlaceholderText(/reason/i), 'Sold out');
    await user.click(screen.getByRole('button', { name: /^decline offer$/i }));

    await waitFor(() => expect(decline).toHaveBeenCalledWith('o1', 'Sold out'));
  });
});
