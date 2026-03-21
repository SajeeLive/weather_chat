import { useState, type KeyboardEvent } from 'react';

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSubmit, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('');

  function handleSubmit() {
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
      setValue('');
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }

  return (
    <div className="chat-input-bar" style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.1)', background: 'var(--bg-secondary, #f5f6fa)' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ask me about the weather..."
        style={{ flex: 1, padding: '10px 14px', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '15px', outline: 'none' }}
        aria-label="Chat input"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        aria-label="Send"
        style={{ padding: '10px 20px', borderRadius: '24px', border: 'none', background: 'var(--accent, #607d8b)', color: '#fff', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        Send
      </button>
    </div>
  );
}
