import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { NotificationBell } from './NotificationBell';

const list = vi.fn();
const unreadCount = vi.fn();
const markRead = vi.fn();
const markAllRead = vi.fn();

vi.mock('@/lib/notificationsApi', () => ({
  notificationsApi: {
    list: (...args: unknown[]) => list(...args),
    unreadCount: (...args: unknown[]) => unreadCount(...args),
    markRead: (...args: unknown[]) => markRead(...args),
    markAllRead: (...args: unknown[]) => markAllRead(...args),
  },
}));

function page<T>(items: T[]) {
  return {
    items,
    meta: {
      page: 1,
      limit: 10,
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

describe('NotificationBell', () => {
  beforeEach(() => {
    list.mockReset();
    unreadCount.mockReset();
    markRead.mockReset();
    markAllRead.mockReset();
  });

  it('shows the unread count as a badge', async () => {
    unreadCount.mockResolvedValue({ count: 3 });
    list.mockResolvedValue(page([notification()]));

    renderWithProviders(<NotificationBell />);

    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('hides the badge when there are no unread notifications', async () => {
    unreadCount.mockResolvedValue({ count: 0 });
    list.mockResolvedValue(page([]));

    renderWithProviders(<NotificationBell />);
    await waitFor(() => expect(unreadCount).toHaveBeenCalled());

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('lists recent notifications in the dropdown', async () => {
    const user = userEvent.setup();
    unreadCount.mockResolvedValue({ count: 1 });
    list.mockResolvedValue(page([notification()]));

    renderWithProviders(<NotificationBell />);
    await user.click(screen.getByRole('button', { name: /notifications/i }));

    expect(await screen.findByText('New offer received')).toBeInTheDocument();
  });

  it('marks a notification read when clicked', async () => {
    const user = userEvent.setup();
    unreadCount.mockResolvedValue({ count: 1 });
    list.mockResolvedValue(page([notification()]));
    markRead.mockResolvedValue(notification({ read: true }));

    renderWithProviders(<NotificationBell />);
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await user.click(await screen.findByText('New offer received'));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith('n1'));
  });

  it('marks every notification read', async () => {
    const user = userEvent.setup();
    unreadCount.mockResolvedValue({ count: 1 });
    list.mockResolvedValue(page([notification()]));
    markAllRead.mockResolvedValue(null);

    renderWithProviders(<NotificationBell />);
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await user.click(await screen.findByRole('button', { name: /mark all as read/i }));

    await waitFor(() => expect(markAllRead).toHaveBeenCalled());
  });
});
