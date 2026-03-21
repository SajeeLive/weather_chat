import { useState, type KeyboardEvent, type ReactNode } from 'react';

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  sendIcon?: ReactNode;
}

export function ChatInput({ onSubmit, disabled = false, sendIcon }: ChatInputProps) {
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
    <div className="chat-input-bar">
      <input
        className="chat-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ask me about the weather anywhere…"
        aria-label="Chat input"
      />
      <button
        className="send-button"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        aria-label="Send"
      >
        {sendIcon ?? 'Send'}
      </button>
    </div>
  );
}
