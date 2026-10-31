import type { UserDto } from '@farmfair/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { renderWithProviders } from '@/test/utils';
import BrowsePage from './BrowsePage';

const browse = vi.fn();
const create = vi.fn();

vi.mock('@/lib/listingsApi', () => ({
  listingsApi: {
    browse: (...args: unknown[]) => browse(...args),
    mine: vi.fn(),
    create: vi.fn(),
    withdraw: vi.fn(),
    detail: vi.fn(),
  },
}));

vi.mock('@/lib/offersApi', () => ({
  offersApi: {
    create: (...args: unknown[]) => create(...args),
    forListing: vi.fn(),
    mine: vi.fn(),
    withdraw: vi.fn(),
    decline: vi.fn(),
  },
}));

function approvedBuyer(): UserDto {
  return {
    id: 'b1',
    name: 'Priya R',
    phone: '+919876501234',
    role: 'buyer',
    district: 'Coimbatore',
    crops: [],
    language: 'en',
    business: { name: 'Priya Traders' },
    verificationStatus: 'approved',
    isSuspended: false,
    notifyWhatsApp: true,
    phoneVerified: false,
    ratingAvg: 0,
    ratingCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const LISTING = {
  id: 'l1',
  farmer: {
    id: 'u1',
    name: 'Murugan S',
    role: 'farmer' as const,
    district: 'Salem',
    verified: true,
    ratingAvg: 4.2,
    ratingCount: 10,
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
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
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

describe('BrowsePage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: approvedBuyer(), initialising: false });
    browse.mockReset().mockResolvedValue(page([LISTING]));
    create.mockReset();
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, initialising: true });
  });

  it('shows active listings with the farmer and price', async () => {
    renderWithProviders(<BrowsePage />);

    expect(await screen.findByText('Tomato')).toBeInTheDocument();
    expect(screen.getByText('Murugan S', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(browse).toHaveBeenCalledWith({});
  });

  it('shows an empty state when nothing matches', async () => {
    browse.mockReset().mockResolvedValue(page([]));
    renderWithProviders(<BrowsePage />);

    expect(await screen.findByText(/no listings match your filters/i)).toBeInTheDocument();
  });

  it('filters by crop', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BrowsePage />);
    await screen.findByText('Tomato');

    await user.click(screen.getByRole('combobox', { name: 'Crop' }));
    await user.click(await screen.findByRole('option', { name: 'Onion' }));

    await waitFor(() => expect(browse).toHaveBeenLastCalledWith({ crop: 'onion' }));
  });

  it('sends an offer with the dialog defaults', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({});

    renderWithProviders(<BrowsePage />);
    await screen.findByText('Tomato');

    await user.click(screen.getByRole('button', { name: /make an offer/i }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^send offer$/i }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith('l1', {
        quantityKg: 200,
        offeredPricePerKg: 22,
      }),
    );
  });

  it('disables "Make an offer" for a pending buyer', async () => {
    useAuthStore.setState({
      user: { ...approvedBuyer(), verificationStatus: 'pending' },
      initialising: false,
    });

    renderWithProviders(<BrowsePage />);
    await screen.findByText('Tomato');

    expect(screen.getByRole('button', { name: /make an offer/i })).toBeDisabled();
    expect(screen.getByText(/must be verified to make offers/i)).toBeInTheDocument();
  });
});
