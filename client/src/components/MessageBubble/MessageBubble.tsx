import type { UIMessage } from '../../types';

interface MessageBubbleProps {
  message: UIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const roleClass = `bubble-${message.role}`;
  const alignStyle = message.role === 'user' ? 'flex-end' : 'flex-start';

  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bubble-wrapper" style={{ display: 'flex', justifyContent: alignStyle, marginBottom: '10px' }}>
      <div
        className={`bubble ${roleClass}`}
        style={{
          maxWidth: '72%',
          padding: '10px 14px',
          borderRadius: '16px',
          background: message.role === 'user' ? 'var(--bubble-user-bg, #607d8b)' : message.role === 'ai' ? 'var(--bubble-ai-bg, #fff)' : undefined,
          color: message.role === 'user' ? '#fff' : 'var(--text-primary, #263238)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{message.text}</p>
        <span style={{ display: 'block', fontSize: '11px', opacity: 0.6, marginTop: '4px', textAlign: message.role === 'user' ? 'right' : 'left' }}>
          {timestamp}
        </span>
      </div>
    </div>
  );
}
