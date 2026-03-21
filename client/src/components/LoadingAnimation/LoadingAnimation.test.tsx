import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LoadingAnimation } from './LoadingAnimation';

describe('LoadingAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when isLoading is false', () => {
    const { container } = render(<LoadingAnimation isLoading={false} theme="neutral" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a loading indicator when isLoading is true', () => {
    render(<LoadingAnimation isLoading theme="neutral" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows "still thinking…" after 5 seconds', async () => {
    render(<LoadingAnimation isLoading theme="sunny" />);
    expect(screen.queryByText(/still thinking/i)).toBeNull();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText(/still thinking/i)).toBeInTheDocument();
  });

  it('does not show "still thinking…" before 5 seconds', () => {
    render(<LoadingAnimation isLoading theme="cloudy" />);
    act(() => { vi.advanceTimersByTime(4999); });
    expect(screen.queryByText(/still thinking/i)).toBeNull();
  });

  it('unmounts cleanly when isLoading becomes false', () => {
    const { rerender, container } = render(<LoadingAnimation isLoading theme="rainy" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(<LoadingAnimation isLoading={false} theme="rainy" />);
    expect(container.firstChild).toBeNull();
  });
});
