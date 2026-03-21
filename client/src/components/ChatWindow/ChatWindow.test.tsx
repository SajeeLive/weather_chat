import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatWindow } from './ChatWindow';
import type { UIMessage } from '../../types';

const messages: UIMessage[] = [
  { id: '1', role: 'user', text: 'What is the weather in London?', timestamp: '2026-03-21T10:00:00Z' },
  { id: '2', role: 'ai', text: 'It is cloudy in London today.', timestamp: '2026-03-21T10:00:05Z' },
];

describe('ChatWindow', () => {
  it('renders all messages in order', () => {
    render(<ChatWindow messages={messages} />);
    expect(screen.getByText('What is the weather in London?')).toBeInTheDocument();
    expect(screen.getByText('It is cloudy in London today.')).toBeInTheDocument();
  });

  it('renders an empty state placeholder when there are no messages', () => {
    render(<ChatWindow messages={[]} />);
    expect(screen.getByText(/ask me about the weather/i)).toBeInTheDocument();
  });

  it('renders a scrollable container', () => {
    const { container } = render(<ChatWindow messages={messages} />);
    expect(container.querySelector('.chat-window')).toBeInTheDocument();
  });
});
