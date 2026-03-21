import { useEffect, useRef } from 'react';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import type { UIMessage } from '../../types';

interface ChatWindowProps {
  messages: UIMessage[];
}

export function ChatWindow({ messages }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current?.scrollIntoView) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  return (
    <div
      className="chat-window"
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {messages.length === 0 ? (
        <div className="chat-empty" style={{ margin: 'auto', textAlign: 'center', opacity: 0.5 }}>
          <p>Ask me about the weather anywhere in the world ☁️</p>
        </div>
      ) : (
        messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
      )}
      <div ref={bottomRef} />
    </div>
  );
}
