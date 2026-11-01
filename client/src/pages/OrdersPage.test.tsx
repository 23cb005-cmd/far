import type { UserDto } from '@farmfair/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { renderWithProviders } from '@/test/utils';
import OrdersPage from './OrdersPage';

const mine = vi.fn();
const pay = vi.fn();
const confirm = vi.fn();
const cancel = vi.fn();
const rate = vi.fn();

vi.mock('@/lib/ordersApi', () => ({
  ordersApi: {
    mine: (...args: unknown[]) => mine(...args),
    pay: (...args: unknown[]) => pay(...args),
    confirm: (...args: unknown[]) => confirm(...args),
    cancel: (...args: unknown[]) => cancel(...args),
    rate: (...args: unknown[]) => rate(...args),
  },
}));

const FARMER: UserDto = {
  id: 'f1',
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

const BUYER: UserDto = {
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

const LISTING_SUMMARY = {
  id: 'l1',
  cropKey: 'tomato',
  grade: 'A' as const,
  pricePerKg: 20,
  quantityKg: 200,
  district: 'Salem',
  status: 'sold' as const,
};

const PUBLIC_FARMER = {
  id: 'f1',
  name: 'Murugan S',
  role: 'farmer' as const,
  district: 'Salem',
  verified: true,
  ratingAvg: 0,
  ratingCount: 0,
  memberSince: '2026-01-01T00:00:00.000Z',
};

const PUBLIC_BUYER = {
  id: 'b1',
  name: 'Priya R',
  role: 'buyer' as const,
  district: 'Coimbatore',
  businessName: 'Priya Traders',
  verified: true,
  ratingAvg: 0,
  ratingCount: 0,
  memberSince: '2026-01-01T00:00:00.000Z',
};

function order(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ord1',
    listing: LISTING_SUMMARY,
    farmer: PUBLIC_FARMER,
    buyer: PUBLIC_BUYER,
    cropKey: 'tomato',
    quantityKg: 50,
    pricePerKg: 20,
    totalAmount: 1000,
    commissionPercent: 1,
    commissionAmount: 10,
    payoutAmount: 990,
    status: 'pending_payment',
    myRatingSubmitted: false,
    createdAt: '2026-01-16T00:00:00.000Z',
    updatedAt: '2026-01-16T00:00:00.000Z',
    ...overrides,
  };
}

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

describe('OrdersPage', () => {
  beforeEach(() => {
    mine.mockReset();
    pay.mockReset();
    confirm.mockReset();
    cancel.mockReset();
    rate.mockReset();
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, initialising: true });
  });

  it('shows an empty state when there are no orders', async () => {
    useAuthStore.setState({ user: FARMER, initialising: false });
    mine.mockResolvedValue(page([]));

    renderWithProviders(<OrdersPage />);

    expect(await screen.findByText(/don't have any orders yet/i)).toBeInTheDocument();
  });

  it('lets the buyer pay a pending order', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ user: BUYER, initialising: false });
    mine.mockResolvedValue(page([order()]));
    pay.mockResolvedValue(order({ status: 'paid' }));

    renderWithProviders(<OrdersPage />);
    await screen.findByText('Tomato');

    await user.click(screen.getByRole('button', { name: /pay into escrow/i }));

    await waitFor(() => expect(pay).toHaveBeenCalledWith('ord1'));
  });

  it('does not show a pay button to the farmer', async () => {
    useAuthStore.setState({ user: FARMER, initialising: false });
    mine.mockResolvedValue(page([order()]));

    renderWithProviders(<OrdersPage />);
    await screen.findByText('Tomato');

    expect(screen.queryByRole('button', { name: /pay into escrow/i })).not.toBeInTheDocument();
  });

  it('lets either party confirm pickup on a paid order', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ user: FARMER, initialising: false });
    mine.mockResolvedValue(page([order({ status: 'paid' })]));
    confirm.mockResolvedValue(
      order({ status: 'paid', farmerConfirmedAt: '2026-01-17T00:00:00.000Z' }),
    );

    renderWithProviders(<OrdersPage />);
    await screen.findByText('Tomato');

    await user.click(screen.getByRole('button', { name: /confirm pickup/i }));

    await waitFor(() => expect(confirm).toHaveBeenCalledWith('ord1'));
  });

  it('shows a waiting message once the other side still needs to confirm', async () => {
    useAuthStore.setState({ user: FARMER, initialising: false });
    mine.mockResolvedValue(
      page([order({ status: 'paid', farmerConfirmedAt: '2026-01-17T00:00:00.000Z' })]),
    );

    renderWithProviders(<OrdersPage />);

    expect(await screen.findByText(/you've confirmed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm pickup/i })).not.toBeInTheDocument();
  });

  it('lets a party cancel a pending-payment order with a reason', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ user: BUYER, initialising: false });
    mine.mockResolvedValue(page([order()]));
    cancel.mockResolvedValue(order({ status: 'cancelled', cancelReason: 'Changed my mind' }));

    renderWithProviders(<OrdersPage />);
    await screen.findByText('Tomato');

    await user.click(screen.getByRole('button', { name: /^cancel order$/i }));
    await user.type(screen.getByPlaceholderText(/reason/i), 'Changed my mind');
    await user.click(screen.getByRole('button', { name: /cancel this order/i }));

    await waitFor(() => expect(cancel).toHaveBeenCalledWith('ord1', 'Changed my mind'));
  });

  it('does not offer cancel once the order is paid', async () => {
    useAuthStore.setState({ user: BUYER, initialising: false });
    mine.mockResolvedValue(page([order({ status: 'paid' })]));

    renderWithProviders(<OrdersPage />);
    await screen.findByText('Tomato');

    expect(screen.queryByRole('button', { name: /^cancel order$/i })).not.toBeInTheDocument();
  });

  it('submits a rating on a completed order', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ user: FARMER, initialising: false });
    mine.mockResolvedValue(page([order({ status: 'completed' })]));
    rate.mockResolvedValue({ id: 'r1', score: 5 });

    renderWithProviders(<OrdersPage />);
    await screen.findByText('Tomato');

    await user.click(screen.getByRole('button', { name: /rate this order/i }));

    const dialog = await screen.findByRole('dialog');
    await user.click(dialog.querySelector('[role="radio"][aria-label="5"]')!);
    await user.click(screen.getByRole('button', { name: /^submit rating$/i }));

    await waitFor(() => expect(rate).toHaveBeenCalledWith('ord1', { score: 5 }));
  });

  it('shows "you rated this order" instead of the rate button once rated', async () => {
    useAuthStore.setState({ user: FARMER, initialising: false });
    mine.mockResolvedValue(page([order({ status: 'completed', myRatingSubmitted: true })]));

    renderWithProviders(<OrdersPage />);

    expect(await screen.findByText(/you rated this order/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rate this order/i })).not.toBeInTheDocument();
  });
});
