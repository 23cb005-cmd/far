import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ReactRouterModule from 'react-router-dom';
import { renderWithProviders } from '@/test/utils';
import RegisterPage from './RegisterPage';

type ReactRouter = typeof ReactRouterModule;

const registerUser = vi.fn();
const navigate = vi.fn();

vi.mock('@/lib/authApi', () => ({
  authApi: {
    register: (...args: unknown[]) => registerUser(...args),
    updateMe: vi.fn(),
    csrf: vi.fn(),
    me: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<ReactRouter>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const farmerUser = {
  id: '1',
  name: 'Murugan S',
  phone: '+919876543210',
  role: 'farmer' as const,
  district: 'Salem',
  crops: ['tomato'],
  language: 'en' as const,
  verificationStatus: 'not_required' as const,
  isSuspended: false,
  notifyWhatsApp: true,
  phoneVerified: false,
  ratingAvg: 0,
  ratingCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** Fill step 2 and advance to step 3. */
async function completeDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/full name/i), 'Murugan S');
  await user.type(screen.getByLabelText(/mobile number/i), '9876543210');
  await user.type(screen.getByLabelText(/^password/i), 'farmfair1');
  await user.click(screen.getByRole('button', { name: /next/i }));
}

describe('RegisterPage', () => {
  beforeEach(() => {
    registerUser.mockReset();
    navigate.mockReset();
  });

  describe('step 1: role', () => {
    it('starts on the role step with two large choices', () => {
      renderWithProviders(<RegisterPage />);

      expect(screen.getByText(/how will you use farmfair/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /i am a farmer/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /i am a buyer/i })).toBeInTheDocument();
    });

    it('reports the step count for assistive technology', () => {
      renderWithProviders(<RegisterPage />);
      expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
    });

    it('advances to the details step once a role is chosen', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />);

      await user.click(screen.getByRole('button', { name: /i am a farmer/i }));

      expect(await screen.findByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
    });

    it('explains the verification wait when buyer is chosen', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />);

      const buyerCard = screen.getByRole('button', { name: /i am a buyer/i });
      expect(buyerCard).toHaveAttribute('aria-pressed', 'false');

      await user.click(buyerCard);

      // Buyers get an extra business step, so the count grows to five.
      expect(await screen.findByText(/step 2 of 5/i)).toBeInTheDocument();
    });

    it('skips straight to the details step when ?role= is supplied', async () => {
      renderWithProviders(<RegisterPage />, { route: '/register?role=farmer' });
      expect(await screen.findByLabelText(/full name/i)).toBeInTheDocument();
    });
  });

  describe('step 2: validation', () => {
    it('blocks progress and reports every empty required field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: '/register?role=farmer' });

      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(await screen.findByText(/name must be at least 2 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/phone number is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();

      // Still on step 2.
      expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
    });

    it('rejects a non-Indian mobile number', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: '/register?role=farmer' });

      await user.type(screen.getByLabelText(/full name/i), 'Murugan S');
      await user.type(screen.getByLabelText(/mobile number/i), '1234567890');
      await user.type(screen.getByLabelText(/^password/i), 'farmfair1');
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(await screen.findByText(/valid 10-digit indian mobile/i)).toBeInTheDocument();
    });

    it('rejects a password with no number', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: '/register?role=farmer' });

      await user.type(screen.getByLabelText(/full name/i), 'Murugan S');
      await user.type(screen.getByLabelText(/mobile number/i), '9876543210');
      await user.type(screen.getByLabelText(/^password/i), 'farmfairs');
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(await screen.findByText(/must contain at least one number/i)).toBeInTheDocument();
    });

    it('rejects a name containing markup', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: '/register?role=farmer' });

      await user.type(screen.getByLabelText(/full name/i), '<script>alert(1)</script>');
      await user.type(screen.getByLabelText(/mobile number/i), '9876543210');
      await user.type(screen.getByLabelText(/^password/i), 'farmfair1');
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(await screen.findByText(/name contains invalid characters/i)).toBeInTheDocument();
    });

    it('labels the password toggle and keeps the input labelled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: '/register?role=farmer' });

      const password = screen.getByLabelText(/^password/i);
      expect(password).toHaveAttribute('type', 'password');

      await user.click(screen.getByRole('button', { name: /show password/i }));
      expect(screen.getByLabelText(/^password/i)).toHaveAttribute('type', 'text');
    });
  });

  describe('step 3: location and crops', () => {
    it('requires a district', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: '/register?role=farmer' });

      await completeDetails(user);

      expect(await screen.findByText(/step 3 of 4/i)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(await screen.findByText(/select a valid tamil nadu district/i)).toBeInTheDocument();
      expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
    });

    it('requires at least one crop from a farmer', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: '/register?role=farmer' });

      await completeDetails(user);

      // The district has to be valid first: the cross-field crop rule only runs
      // once the individual fields parse.
      await user.click(await screen.findByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: 'Salem' }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(await screen.findByText(/select at least one crop/i)).toBeInTheDocument();
      expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
    });

    it('exposes crops as toggleable checkboxes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: '/register?role=farmer' });

      await completeDetails(user);

      const tomato = await screen.findByRole('checkbox', { name: /tomato/i });
      expect(tomato).toHaveAttribute('aria-checked', 'false');

      await user.click(tomato);
      expect(screen.getByRole('checkbox', { name: /tomato/i })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('submits a farmer with a normalised phone after the review step', async () => {
      const user = userEvent.setup();
      registerUser.mockResolvedValue(farmerUser);
      renderWithProviders(<RegisterPage />, { route: '/register?role=farmer' });

      await completeDetails(user);

      // Step 3
      await user.click(await screen.findByRole('checkbox', { name: /tomato/i }));
      await user.click(screen.getByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: 'Salem' }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 4: review
      expect(await screen.findByText(/check your details/i)).toBeInTheDocument();
      expect(screen.getByText('+919876543210')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(registerUser).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Murugan S',
            phone: '+919876543210',
            role: 'farmer',
            district: 'Salem',
            crops: ['tomato'],
          }),
        );
      });
    });

    it('never sends business details for a farmer', async () => {
      const user = userEvent.setup();
      registerUser.mockResolvedValue(farmerUser);
      renderWithProviders(<RegisterPage />, { route: '/register?role=farmer' });

      await completeDetails(user);
      await user.click(await screen.findByRole('checkbox', { name: /tomato/i }));
      await user.click(screen.getByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: 'Salem' }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await user.click(await screen.findByRole('button', { name: /create account/i }));

      await waitFor(() => expect(registerUser).toHaveBeenCalled());
      expect(registerUser.mock.calls[0]?.[0]).not.toHaveProperty('business');
    });

    it('requires a business name from a buyer', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: '/register?role=buyer' });

      await completeDetails(user);

      // Step 3: a buyer needs no crops, only a district.
      await user.click(await screen.findByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: 'Coimbatore' }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(await screen.findByText(/about your business/i)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(await screen.findByText(/business name is required for buyers/i)).toBeInTheDocument();
    });

    it('rejects a malformed GSTIN', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: '/register?role=buyer' });

      await completeDetails(user);
      await user.click(await screen.findByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: 'Coimbatore' }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      await user.type(await screen.findByLabelText(/business name/i), 'Priya Traders');
      await user.type(screen.getByLabelText(/gst number/i), 'NOTAGSTIN');
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(await screen.findByText(/valid 15-character gstin/i)).toBeInTheDocument();
    });

    it('shows a server-side duplicate phone error', async () => {
      const user = userEvent.setup();
      const { ApiRequestError } = await import('@/lib/api');
      registerUser.mockRejectedValue(
        new ApiRequestError(409, 'DUPLICATE_KEY', 'That phone number is already registered'),
      );

      renderWithProviders(<RegisterPage />, { route: '/register?role=farmer' });

      await completeDetails(user);
      await user.click(await screen.findByRole('checkbox', { name: /tomato/i }));
      await user.click(screen.getByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: 'Salem' }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await user.click(await screen.findByRole('button', { name: /create account/i }));

      expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
    });
  });

  it('allows going back to an earlier step', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: '/register?role=farmer' });

    await completeDetails(user);
    expect(await screen.findByText(/step 3 of 4/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back/i }));

    // The values typed earlier are still there.
    expect(await screen.findByLabelText(/full name/i)).toHaveValue('Murugan S');
  });

  it('links to the login page', () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
  });
});
