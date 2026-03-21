import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  it('renders a text input and submit button', () => {
    render(<ChatInput onSubmit={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('calls onSubmit with the typed text when Enter is pressed', async () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'What is the weather in London?');
    await userEvent.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('What is the weather in London?');
  });

  it('calls onSubmit when Send button is clicked', async () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole('textbox'), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(onSubmit).toHaveBeenCalledWith('Hello');
  });

  it('does NOT call onSubmit when input is empty', async () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />);
    await userEvent.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does NOT call onSubmit when input is only whitespace', async () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole('textbox'), '   ');
    await userEvent.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears the input after successful submit', async () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'London weather?');
    await userEvent.keyboard('{Enter}');
    expect(input).toHaveValue('');
  });

  it('disables the input and button when disabled prop is true', () => {
    render(<ChatInput onSubmit={vi.fn()} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });
});
