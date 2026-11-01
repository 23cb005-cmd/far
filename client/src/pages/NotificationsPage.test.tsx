import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import NotificationsPage from './NotificationsPage';

const list = vi.fn();
const markRead = vi.fn();
const markAllRead = vi.fn();

vi.mock('@/lib/notificationsApi', () => ({
  notificationsApi: {
    list: (...args: unknown[]) => list(...args),
    unreadCount: vi.fn().mockResolvedValue({ count: 0 }),
    markRead: (...args: unknown[]) => markRead(...args),
    markAllRead: (...args: unknown[]) => markAllRead(...args),
  },
}));

function page<T>(items: T[]) {
  return {
    items,
    meta: {
      page: 1,
      limit: 50,
      total: items.length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

function notification(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'n1',
    type: 'offer_created',
    title: 'New offer received',
    message: 'A buyer offered ₹20/kg for 50 kg of your Tomato.',
    read: false,
    createdAt: '2026-01-16T00:00:00.000Z',
    ...overrides,
  };
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    list.mockReset();
    markRead.mockReset();
    markAllRead.mockReset();
  });

  it('shows an empty state when there are no notifications', async () => {
    list.mockResolvedValue(page([]));

    renderWithProviders(<NotificationsPage />);

    expect(await screen.findByText(/don't have any notifications yet/i)).toBeInTheDocument();
  });

  it('lists notifications with a mark-as-read action', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue(page([notification()]));
    markRead.mockResolvedValue(notification({ read: true }));

    renderWithProviders(<NotificationsPage />);
    await screen.findByText('New offer received');

    await user.click(screen.getByRole('button', { name: /mark as read/i }));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith('n1'));
  });

  it('does not show a mark-as-read action for an already-read notification', async () => {
    list.mockResolvedValue(page([notification({ read: true })]));

    renderWithProviders(<NotificationsPage />);
    await screen.findByText('New offer received');

    expect(screen.queryByRole('button', { name: /mark as read/i })).not.toBeInTheDocument();
  });

  it('switches to the unread tab', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue(page([notification()]));

    renderWithProviders(<NotificationsPage />);
    await screen.findByText('New offer received');

    await user.click(screen.getByRole('tab', { name: /unread/i }));

    await waitFor(() => expect(list).toHaveBeenLastCalledWith(1, 50, true));
  });

  it('marks every notification read', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue(page([notification()]));
    markAllRead.mockResolvedValue(null);

    renderWithProviders(<NotificationsPage />);
    await screen.findByText('New offer received');

    await user.click(screen.getByRole('button', { name: /mark all as read/i }));

    await waitFor(() => expect(markAllRead).toHaveBeenCalled());
  });
});
