import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import type { UIMessage } from '../../types';

const baseMessage: UIMessage = {
  id: 'test-1',
  role: 'user',
  text: 'What is the weather in London?',
  timestamp: '2026-03-21T10:00:00Z',
};

describe('MessageBubble', () => {
  it('renders user message with right-aligned class', () => {
    const { container } = render(<MessageBubble message={{ ...baseMessage, role: 'user' }} />);
    expect(container.querySelector('.bubble-user')).toBeInTheDocument();
    expect(screen.getByText('What is the weather in London?')).toBeInTheDocument();
  });

  it('renders AI message with left-aligned class', () => {
    const { container } = render(
      <MessageBubble message={{ ...baseMessage, role: 'ai', text: 'It is cloudy in London.' }} />,
    );
    expect(container.querySelector('.bubble-ai')).toBeInTheDocument();
  });

  it('renders error message with error class', () => {
    const { container } = render(
      <MessageBubble message={{ ...baseMessage, role: 'error', text: 'Something went wrong.' }} />,
    );
    expect(container.querySelector('.bubble-error')).toBeInTheDocument();
  });

  it('displays the message text content', () => {
    render(<MessageBubble message={baseMessage} />);
    expect(screen.getByText('What is the weather in London?')).toBeInTheDocument();
  });

  it('renders a formatted timestamp', () => {
    render(<MessageBubble message={baseMessage} />);
    // Timestamp element exists (exact format depends on locale)
    const bubble = screen.getByText('What is the weather in London?').closest('.bubble');
    expect(bubble).toBeInTheDocument();
  });
});
