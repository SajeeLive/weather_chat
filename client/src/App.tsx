import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, splitLink, createWSClient, wsLink } from '@trpc/client';
import { useState } from 'react';
import { trpc } from './lib/trpc';
import { useChat } from './hooks/useChat';
import { useWeatherTheme } from './hooks/useWeatherTheme';
import { ChatWindow } from './components/ChatWindow/ChatWindow';
import { ChatInput } from './components/ChatInput/ChatInput';
import { AtmosphericBackground } from './components/AtmosphericBackground/AtmosphericBackground';
import { LoadingAnimation } from './components/LoadingAnimation/LoadingAnimation';
import type { WeatherTheme } from './types';

const queryClient = new QueryClient();

// Generate once per page load — ties HTTP mutations to this WS session on the server
const socketId = crypto.randomUUID();

function createTrpcClient() {
  const wsUrl = `${import.meta.env.VITE_SERVER_WS_URL as string}?socketId=${socketId}`;
  const wsClient = createWSClient({ url: wsUrl });

  return trpc.createClient({
    links: [
      splitLink({
        condition: (op) => op.type === 'subscription',
        true: wsLink({ client: wsClient }),
        false: httpBatchLink({
          url: import.meta.env.VITE_SERVER_URL as string,
          headers: () => ({ 'x-socket-id': socketId }),
        }),
      }),
    ],
  });
}

// ── Header weather icons ──────────────────────────────────────────────────

function HeaderIcon({ theme }: { theme: WeatherTheme }) {
  if (theme === 'sunny') {
    return (
      <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <circle cx="19" cy="19" r="8" fill="#FFD600" opacity="0.95" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <line key={i}
              x1={19 + Math.cos(a) * 11} y1={19 + Math.sin(a) * 11}
              x2={19 + Math.cos(a) * 16} y2={19 + Math.sin(a) * 16}
              stroke="#FFC107" strokeWidth="2.2" strokeLinecap="round"
            />
          );
        })}
        <circle cx="19" cy="19" r="6" fill="#FFF9C4" />
      </svg>
    );
  }
  if (theme === 'cloudy') {
    return (
      <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <rect x="9" y="22" width="22" height="8" rx="4" fill="rgba(255,255,255,0.82)" />
        <circle cx="14" cy="22" r="5.5" fill="rgba(255,255,255,0.82)" />
        <circle cx="21" cy="19" r="7.5" fill="rgba(255,255,255,0.82)" />
        <circle cx="28" cy="22" r="5" fill="rgba(255,255,255,0.82)" />
        <rect x="16" y="15" width="14" height="6" rx="3" fill="rgba(215,228,235,0.72)" />
        <circle cx="21" cy="15" r="4" fill="rgba(215,228,235,0.72)" />
        <circle cx="28" cy="16" r="3.5" fill="rgba(215,228,235,0.72)" />
      </svg>
    );
  }
  if (theme === 'rainy') {
    return (
      <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <rect x="7" y="14" width="24" height="9" rx="4.5" fill="rgba(80,130,200,0.85)" />
        <circle cx="13" cy="14" r="6" fill="rgba(80,130,200,0.85)" />
        <circle cx="22" cy="11" r="7.5" fill="rgba(80,130,200,0.85)" />
        <circle cx="30" cy="14" r="5.5" fill="rgba(80,130,200,0.85)" />
        <line x1="13" y1="26" x2="11" y2="33" stroke="#5aabf8" strokeWidth="2" strokeLinecap="round" />
        <line x1="19" y1="27" x2="17" y2="34" stroke="#5aabf8" strokeWidth="2" strokeLinecap="round" />
        <line x1="25" y1="26" x2="23" y2="33" stroke="#5aabf8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (theme === 'stormy') {
    return (
      <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <rect x="5" y="12" width="28" height="11" rx="5.5" fill="rgba(30,20,70,0.92)" />
        <circle cx="12" cy="12" r="7" fill="rgba(30,20,70,0.92)" />
        <circle cx="23" cy="9" r="9" fill="rgba(30,20,70,0.92)" />
        <circle cx="32" cy="13" r="6" fill="rgba(30,20,70,0.92)" />
        <polyline points="22,22 18,30 23,30 17,38" fill="none" stroke="#c0aaff" strokeWidth="2.2" strokeLinejoin="round" />
        <polyline points="22,22 18,30 23,30 17,38" fill="none" stroke="rgba(200,180,255,0.45)" strokeWidth="5" strokeLinejoin="round" />
      </svg>
    );
  }
  // neutral — cloud
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
      <rect x="8" y="22" width="22" height="9" rx="4.5" fill="rgba(255,255,255,0.58)" />
      <circle cx="14" cy="22" r="6" fill="rgba(255,255,255,0.58)" />
      <circle cx="22" cy="18" r="8" fill="rgba(255,255,255,0.58)" />
      <circle cx="29" cy="22" r="5.5" fill="rgba(255,255,255,0.58)" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Chat app ──────────────────────────────────────────────────────────────

function ChatApp() {
  const { messages, isLoading, sendQuery, latestWeatherContext } = useChat();
  const currentTheme = useWeatherTheme(latestWeatherContext?.condition ?? null);

  return (
    <>
      <AtmosphericBackground theme={currentTheme} />
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-icon">
            <HeaderIcon theme={currentTheme} />
          </div>
          <div className="app-header-title">
            <span className="app-header-wordmark">SkyTalk</span>
            <span className="app-header-subtitle">AI Weather</span>
          </div>
        </header>
        <div className="chat-container">
          <ChatWindow messages={messages} />
          <LoadingAnimation isLoading={isLoading} theme={currentTheme} />
          <ChatInput onSubmit={sendQuery} disabled={isLoading} sendIcon={<SendIcon />} />
        </div>
      </div>
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────

export default function App() {
  const [trpcClient] = useState(createTrpcClient);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ChatApp />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
