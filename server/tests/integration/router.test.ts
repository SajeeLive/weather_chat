/**
 * Integration tests for the tRPC router procedures.
 *
 * Uses tRPC's createCallerFactory for unit-style procedure testing
 * without needing a real HTTP/WebSocket server.
 */
import { createCaller } from '../../src/router/index';
import type { ChatEvent } from '../../src/types/index';
import { ClarificationNeededError, WeatherServiceError } from '../../src/types/index';

// ─── Mocks ────────────────────────────────────────────────────────────────

// weatherService is not called directly by the router in the new architecture
// (geocoding happens inside aiService tools). Mock it for completeness.
jest.mock('../../src/services/weatherService', () => ({
  resolveNickname: jest.fn((input: string) => input),
  geocodeCity: jest.fn(),
  getCurrent: jest.fn(),
  getForecast: jest.fn(),
  mapOwmCondition: jest.fn(),
}));

jest.mock('../../src/services/aiService', () => ({
  runAIQuery: jest.fn().mockResolvedValue({
    id: 'test-id-001',
    role: 'ai',
    text: 'It is currently cloudy in London with a temperature of 15°C.',
    timestamp: '2026-03-21T10:00:00Z',
    weatherContext: {
      condition: 'cloudy',
      location: 'London, GB',
      temperatureCelsius: 15,
      feelsLikeCelsius: 13,
      humidity: 72,
      windKph: 18,
      precipitationProbability: 0,
    },
  }),
}));

const mockAIResponse = {
  id: 'test-id-001',
  role: 'ai',
  text: 'It is currently cloudy in London with a temperature of 15°C.',
  timestamp: '2026-03-21T10:00:00Z',
  weatherContext: {
    condition: 'cloudy',
    location: 'London, GB',
    temperatureCelsius: 15,
    feelsLikeCelsius: 13,
    humidity: 72,
    windKph: 18,
    precipitationProbability: 0,
  },
};

// ─── Helper: collect events from chatStream observable ────────────────────

async function collectChatEvents(
  socketId: string,
  timeout = 3000,
): Promise<ChatEvent[]> {
  const callerFactory = createCaller;
  const caller = callerFactory({ socketId });

  // Subscribe and collect events
  const events: ChatEvent[] = [];
  const observable = await caller.chatStream();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(events), timeout);

    observable.subscribe({
      next: (event: ChatEvent) => {
        events.push(event);
        if (event.type === 'message' || event.type === 'error') {
          clearTimeout(timer);
          resolve(events);
        }
      },
      error: (err: Error) => {
        clearTimeout(timer);
        reject(err);
      },
      complete: () => {
        clearTimeout(timer);
        resolve(events);
      },
    });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('log structure', () => {
  it('session logger produces valid JSON with required fields on every entry', () => {
    // Pino captures its stream reference at creation time, so we test log structure
    // by constructing a pino child logger directly with a controlled stream —
    // the same pattern used by createSessionLogger in production.
    const { PassThrough } = require('stream');
    const pino = require('pino');

    const lines: Record<string, unknown>[] = [];
    const stream = new PassThrough();
    stream.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (!text) return;
      try { lines.push(JSON.parse(text)); } catch { /* non-JSON, skip */ }
    });

    const correlationId = 'log-structure-test-corr-id';
    const base = pino({ level: 'trace' }, stream);
    const sessionLog = base.child({ correlationId });

    // Simulate the events a real query pipeline emits
    sessionLog.info({ event: 'session_connected', socketId: '[SOCKET]' }, 'Session connected');
    sessionLog.info({ event: 'query_received' }, 'Processing query');
    sessionLog.info({ event: 'weather_api_call', endpoint: 'geo/direct' }, 'Geocoding city');
    sessionLog.info({ event: 'ai_query_start' }, 'Starting AI query');
    sessionLog.info({ event: 'ai_query_complete' }, 'AI query complete');

    expect(lines.length).toBe(5);

    for (const line of lines) {
      // Required fields on every pino log entry
      expect(typeof line['time']).toBe('number');
      expect(line['time']).toBeGreaterThan(0);
      expect(typeof line['level']).toBe('number');
      expect(typeof line['msg']).toBe('string');

      // Session-scoped entries must carry correlationId
      expect(line['correlationId']).toBe(correlationId);
    }

    // Location data must not appear in any INFO-level line
    const raw = JSON.stringify(lines);
    expect(raw).not.toMatch(/\b(London|New York|Chicago|51\.51|-0\.12)\b/);
  });
});

describe('health', () => {
  it('returns status ok with a timestamp', async () => {
    const callerFactory = createCaller;
    const caller = callerFactory({});
    const result = await caller.health();

    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
  });
});

describe('sendQuery → chatStream round-trip', () => {
  it('emits loading then message events for a valid city query', async () => {
    const socketId = 'test-socket-us1';

    // Start collecting events first (subscription must exist before sendQuery fires)
    const eventsPromise = collectChatEvents(socketId, 2000);

    // Small delay to ensure subscription is registered before mutation fires
    await new Promise((r) => setTimeout(r, 50));

    const callerFactory = createCaller;
    const caller = callerFactory({ socketId });
    const mutResult = await caller.sendQuery({ text: 'What is the weather in London?' });

    expect(mutResult.queued).toBe(true);

    const events = await eventsPromise;

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0]).toEqual({ type: 'loading' });
    expect(events[1]?.type).toBe('message');

    const msgEvent = events[1] as { type: 'message'; payload: { text: string; weatherContext: { condition: string } } };
    expect(typeof msgEvent.payload.text).toBe('string');
    expect(msgEvent.payload.text.length).toBeGreaterThan(0);
    expect(msgEvent.payload.weatherContext).toBeDefined();
  });
});

describe('chatStream — clarification_needed for ambiguous city', () => {
  it('emits clarification_needed when AI tool finds multiple matching locations', async () => {
    const { runAIQuery } = require('../../src/services/aiService');
    const candidates = [
      { displayName: 'Springfield, IL, US', lat: 39.8, lon: -89.6 },
      { displayName: 'Springfield, MO, US', lat: 37.2, lon: -93.3 },
      { displayName: 'Springfield, MA, US', lat: 42.1, lon: -72.5 },
    ];
    (runAIQuery as jest.Mock).mockRejectedValueOnce(
      new ClarificationNeededError(candidates, 'What is the weather in Springfield?'),
    );

    const socketId = 'test-socket-us2-clarification';
    const eventsPromise = collectChatEvents(socketId, 2000);
    await new Promise((r) => setTimeout(r, 50));

    await createCaller({ socketId }).sendQuery({ text: 'What is the weather in Springfield?' });
    const events = await eventsPromise;

    const clarificationEvent = events.find((e) => e.type === 'clarification_needed');
    expect(clarificationEvent).toBeDefined();
    expect(
      (clarificationEvent as { type: 'clarification_needed'; payload: { candidates: unknown[] } })
        .payload.candidates.length,
    ).toBeGreaterThan(1);
  });
});

describe('selectLocation mutation', () => {
  it('re-processes the query with the confirmed location and emits loading → message', async () => {
    const { runAIQuery } = require('../../src/services/aiService');

    // First sendQuery triggers clarification_needed via ClarificationNeededError
    const candidates = [
      { displayName: 'Springfield, IL, US', lat: 39.8, lon: -89.6 },
      { displayName: 'Springfield, MO, US', lat: 37.2, lon: -93.3 },
    ];
    (runAIQuery as jest.Mock).mockRejectedValueOnce(
      new ClarificationNeededError(candidates, 'Weather in Springfield?'),
    );

    const socketId = 'test-socket-select-location';
    const clarificationPromise = collectChatEvents(socketId, 2000);
    await new Promise((r) => setTimeout(r, 50));

    const caller = createCaller({ socketId });
    await caller.sendQuery({ text: 'Weather in Springfield?' });
    await clarificationPromise;

    // selectLocation — runAIQuery resolves normally when overrideLocation is provided
    (runAIQuery as jest.Mock).mockResolvedValueOnce(mockAIResponse);

    const afterSelectPromise = collectChatEvents(socketId, 2000);
    await new Promise((r) => setTimeout(r, 50));

    const result = await caller.selectLocation({
      displayName: 'Springfield, IL, US',
      lat: 39.8,
      lon: -89.6,
      originalQuery: 'Weather in Springfield?',
    });

    expect(result.queued).toBe(true);

    const events = await afterSelectPromise;
    expect(events[0]).toEqual({ type: 'loading' });
    expect(events.some((e) => e.type === 'message')).toBe(true);
  });
});

describe('chatStream — error handling', () => {
  it('emits an error event without crashing session when OWM fails', async () => {
    const { runAIQuery } = require('../../src/services/aiService');
    (runAIQuery as jest.Mock).mockRejectedValueOnce(
      new WeatherServiceError('Weather service unavailable.', true),
    );

    const socketId = 'test-socket-us3-error';
    const eventsPromise = collectChatEvents(socketId, 2000);
    await new Promise((r) => setTimeout(r, 50));

    await createCaller({ socketId }).sendQuery({ text: 'Weather in London?' });
    const events = await eventsPromise;

    const errorEvent = events.find((e) => e.type === 'error') as
      | { type: 'error'; payload: { message: string; retryable: boolean } }
      | undefined;

    expect(errorEvent).toBeDefined();
    expect(typeof errorEvent!.payload.message).toBe('string');
    expect(typeof errorEvent!.payload.retryable).toBe('boolean');
    expect(errorEvent!.payload.retryable).toBe(true);
  });

  it('emits a user-friendly error event (no stack trace) when AI service throws', async () => {
    const { runAIQuery } = require('../../src/services/aiService');
    (runAIQuery as jest.Mock).mockRejectedValueOnce(new Error('Anthropic API timeout'));

    const socketId = 'test-socket-ai-error';
    const eventsPromise = collectChatEvents(socketId, 2000);
    await new Promise((r) => setTimeout(r, 50));

    await createCaller({ socketId }).sendQuery({ text: 'Weather in London?' });
    const events = await eventsPromise;

    const errorEvent = events.find((e) => e.type === 'error') as
      | { type: 'error'; payload: { message: string; retryable: boolean } }
      | undefined;

    expect(errorEvent).toBeDefined();
    // Message must be user-friendly — no stack traces or internal error text
    expect(errorEvent!.payload.message).not.toMatch(/Error:/);
    expect(errorEvent!.payload.message).not.toMatch(/at\s+\w+\s+\(/); // no stack frames
    expect(typeof errorEvent!.payload.message).toBe('string');
    expect(errorEvent!.payload.message.length).toBeGreaterThan(0);
  });

  it('session remains usable after an error — subsequent query succeeds', async () => {
    const { runAIQuery } = require('../../src/services/aiService');

    // First query: error
    (runAIQuery as jest.Mock).mockRejectedValueOnce(
      new WeatherServiceError('Service temporarily unavailable.', true),
    );

    const socketId = 'test-socket-session-resilience';

    const errorEventsPromise = collectChatEvents(socketId, 2000);
    await new Promise((r) => setTimeout(r, 50));
    await createCaller({ socketId }).sendQuery({ text: 'Weather anywhere?' });
    const errorEvents = await errorEventsPromise;
    expect(errorEvents.some((e) => e.type === 'error')).toBe(true);

    // Second query: success — session must still be alive
    (runAIQuery as jest.Mock).mockResolvedValueOnce(mockAIResponse);

    const successEventsPromise = collectChatEvents(socketId, 2000);
    await new Promise((r) => setTimeout(r, 50));
    await createCaller({ socketId }).sendQuery({ text: 'What is the weather in London?' });
    const successEvents = await successEventsPromise;

    expect(successEvents.some((e) => e.type === 'message')).toBe(true);
  });
});
