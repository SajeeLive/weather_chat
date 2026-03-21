import { useEffect, useRef } from 'react';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import type { UIMessage } from '../../types';

interface ChatWindowProps {
  messages: UIMessage[];
}

function EmptyStateIcon() {
  return (
    <svg
      className="chat-empty-icon"
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Globe circle */}
      <circle cx="48" cy="48" r="34" stroke="rgba(255,255,255,0.38)" strokeWidth="1.5" fill="rgba(255,255,255,0.06)" />
      {/* Equator */}
      <ellipse cx="48" cy="48" rx="34" ry="14" stroke="rgba(255,255,255,0.20)" strokeWidth="1" fill="none" />
      {/* Vertical meridian */}
      <line x1="48" y1="14" x2="48" y2="82" stroke="rgba(255,255,255,0.20)" strokeWidth="1" />
      {/* Latitude stripe */}
      <ellipse cx="48" cy="34" rx="26" ry="9" stroke="rgba(255,255,255,0.14)" strokeWidth="1" fill="none" />
      {/* Floating cloud over globe */}
      <g style={{ animation: 'svg-drift-slow 8s ease-in-out infinite' }}>
        <rect x="28" y="36" width="42" height="14" rx="7" fill="rgba(255,255,255,0.72)" />
        <circle cx="36" cy="36" r="9"  fill="rgba(255,255,255,0.72)" />
        <circle cx="48" cy="31" r="13" fill="rgba(255,255,255,0.72)" />
        <circle cx="60" cy="36" r="9"  fill="rgba(255,255,255,0.72)" />
      </g>
    </svg>
  );
}

export function ChatWindow({ messages }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current?.scrollIntoView) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  return (
    <div className="chat-window">
      {messages.length === 0 ? (
        <div className="chat-empty">
          <EmptyStateIcon />
          <p className="chat-empty-title">Ask the Sky</p>
          <p className="chat-empty-hint">Weather conditions, forecasts, or climate — anywhere in the world</p>
        </div>
      ) : (
        messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
      )}
      <div ref={bottomRef} />
    </div>
  );
}
