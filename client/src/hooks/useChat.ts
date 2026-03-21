import { useState } from 'react';
import { trpc } from '../lib/trpc';
import type { UIMessage, WeatherContext } from '../types';

export function useChat() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [latestWeatherContext, setLatestWeatherContext] = useState<WeatherContext | null>(null);

  trpc.chatStream.useSubscription(undefined, {
    onData(event) {
      if (event.type === 'loading') {
        setIsLoading(true);
      } else if (event.type === 'message') {
        setIsLoading(false);
        const msg: UIMessage = {
          id: event.payload.id,
          role: 'ai',
          text: event.payload.text,
          timestamp: event.payload.timestamp,
          weatherContext: event.payload.weatherContext,
        };
        setMessages((prev) => [...prev, msg]);
        setLatestWeatherContext(event.payload.weatherContext);
      } else if (event.type === 'error') {
        setIsLoading(false);
        const msg: UIMessage = {
          id: crypto.randomUUID(),
          role: 'error',
          text: event.payload.message,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, msg]);
      } else if (event.type === 'clarification_needed') {
        setIsLoading(false);
        const candidateList = event.payload.candidates
          .map((c) => `• ${c.displayName}`)
          .join('\n');
        const msg: UIMessage = {
          id: crypto.randomUUID(),
          role: 'ai',
          text: `${event.payload.question}\n\n${candidateList}\n\nPlease use selectLocation to choose one.`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, msg]);
      }
    },
    onError(err) {
      setIsLoading(false);
      console.error('chatStream error:', err);
    },
  });

  const sendQueryMutation = trpc.sendQuery.useMutation();

  function sendQuery(text: string) {
    const userMsg: UIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    sendQueryMutation.mutate({ text });
  }

  return { messages, isLoading, sendQuery, latestWeatherContext };
}
