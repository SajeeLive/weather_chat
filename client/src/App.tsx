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

function ChatApp() {
  const { messages, isLoading, sendQuery, latestWeatherContext } = useChat();
  const currentTheme = useWeatherTheme(latestWeatherContext?.condition ?? null);

  return (
    <>
      <AtmosphericBackground theme={currentTheme} />
      <div className="chat-layout" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <ChatWindow messages={messages} />
        <LoadingAnimation isLoading={isLoading} theme={currentTheme} />
        <ChatInput onSubmit={sendQuery} disabled={isLoading} />
      </div>
    </>
  );
}

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
