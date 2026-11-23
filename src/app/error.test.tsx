// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import ErrorBoundary from '@/app/error';

describe('Error boundary', () => {
  it('shows the failure and offers retry + home actions', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reset = vi.fn();
    render(<ErrorBoundary error={new Error('boom exploded')} reset={reset} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByText('boom exploded')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);

    expect(
      screen.getByRole('button', { name: /back to home/i }),
    ).toBeInTheDocument();
  });

  it('renders without a message when the error has none', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<ErrorBoundary error={new Error('')} reset={vi.fn()} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
  });
});
