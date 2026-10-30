import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ReactRouterModule from 'react-router-dom';
import { renderWithProviders } from '@/test/utils';
import LoginPage from './LoginPage';

type ReactRouter = typeof ReactRouterModule;

const login = vi.fn();
const navigate = vi.fn();

vi.mock('@/lib/authApi', () => ({
  authApi: {
    login: (...args: unknown[]) => login(...args),
    csrf: vi.fn(),
    me: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<ReactRouter>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

describe('LoginPage', () => {
  beforeEach(() => {
    login.mockReset();
    navigate.mockReset();
  });

  it('renders accessible, labelled fields', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument();
  });

  it('marks both fields as required for assistive technology', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText(/mobile number/i)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('aria-required', 'true');
  });

  it('shows a validation error for an empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByText(/phone number is required/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects a phone number that is not an Indian mobile', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/mobile number/i), '12345');
    await user.type(screen.getByLabelText(/^password/i), 'farmfair1');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByText(/valid 10-digit indian mobile/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('associates the error message with the field via aria-describedby', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    const phone = await screen.findByLabelText(/mobile number/i);
    await waitFor(() => {
      expect(phone).toHaveAttribute('aria-invalid', 'true');
      expect(phone.getAttribute('aria-describedby')).toContain('phone-error');
    });
  });

  it('normalises the phone to +91 form before calling the API', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({
      id: '1',
      name: 'Murugan S',
      phone: '+919876543210',
      role: 'farmer',
      district: 'Salem',
      crops: [],
      language: 'en',
      verificationStatus: 'not_required',
      isSuspended: false,
      notifyWhatsApp: true,
      phoneVerified: false,
      ratingAvg: 0,
      ratingCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/mobile number/i), '98765 43210');
    await user.type(screen.getByLabelText(/^password/i), 'farmfair1');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({ phone: '+919876543210', password: 'farmfair1' });
    });
  });

  it('shows the server error message when the credentials are wrong', async () => {
    const user = userEvent.setup();
    const { ApiRequestError } = await import('@/lib/api');
    login.mockRejectedValue(
      new ApiRequestError(401, 'INVALID_CREDENTIALS', 'Invalid phone or password'),
    );

    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/mobile number/i), '9876543210');
    await user.type(screen.getByLabelText(/^password/i), 'wrongpass1');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/invalid phone or password/i);
  });

  it('toggles password visibility and reports its state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const password = screen.getByLabelText(/^password/i);
    expect(password).toHaveAttribute('type', 'password');

    const toggle = screen.getByRole('button', { name: /show password/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows the session-expired notice when redirected with ?expired=1', () => {
    renderWithProviders(<LoginPage />, { route: '/login?expired=1' });
    expect(screen.getByText(/session ended/i)).toBeInTheDocument();
  });

  it('links to the register page', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute(
      'href',
      '/register',
    );
  });
});
