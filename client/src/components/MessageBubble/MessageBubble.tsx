import ReactMarkdown from 'react-markdown';
import type { UIMessage } from '../../types';

interface MessageBubbleProps {
  message: UIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const roleClass = `bubble-${message.role}`;
  const isUser = message.role === 'user';

  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bubble-wrapper" style={{ justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div className={`bubble ${roleClass}`}>
        {isUser || message.role === 'error' ? (
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.text}</p>
        ) : (
          <ReactMarkdown>{message.text}</ReactMarkdown>
        )}
        <span className="bubble-timestamp" style={{ textAlign: isUser ? 'right' : 'left' }}>
          {timestamp}
        </span>
      </div>
    </div>
  );
}
