# tRPC Router Contract: SkyTalk AI

**Transport**: tRPC v11
**HTTP procedures**: Express HTTP adapter (`/trpc` path)
**Subscription procedures**: tRPC WebSocket adapter (`ws://localhost:4000`)
**Type export**: `AppRouter` exported from `server/src/router/index.ts`
**Client import**: `import type { AppRouter } from '../../../server/src/router'` (type-only)

---

## Router Definition

```typescript
// server/src/router/index.ts
import { initTRPC } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { z } from 'zod';

const t = initTRPC.create();
const router = t.router;
const publicProcedure = t.procedure;

export const appRouter = router({
  health,         // query
  sendQuery,      // mutation
  selectLocation, // mutation
  chatStream,     // subscription
});

export type AppRouter = typeof appRouter;
```

---

## Procedures

### `health` — Query

Returns server operational status. Called by the client on load before opening a
WebSocket connection.

```typescript
health: publicProcedure
  .query((): HealthResponse => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  })
```

**Input**: None

**Output**:
```typescript
interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string; // ISO 8601
}
```

---

### `sendQuery` — Mutation

Submits a user's natural language weather query to the server. The server begins
processing and emits events on the `chatStream` subscription.

```typescript
sendQuery: publicProcedure
  .input(z.object({ text: z.string().min(1).max(500) }))
  .mutation(async ({ input, ctx }): Promise<{ queued: true }> => { ... })
```

**Input**:
```typescript
{ text: string } // min 1 char, max 500 chars — validated by Zod
```

**Output**:
```typescript
{ queued: true }
```

**Errors**:
- `BAD_REQUEST` — empty or whitespace-only text
- `TOO_MANY_REQUESTS` — rate limit exceeded (future)

---

### `selectLocation` — Mutation

Resolves an ambiguous location after the client presents `clarification_needed`
options to the user.

```typescript
selectLocation: publicProcedure
  .input(SelectLocationSchema)
  .mutation(async ({ input, ctx }): Promise<{ queued: true }> => { ... })
```

**Input**:
```typescript
interface SelectLocationInput {
  displayName: string;   // Must match a candidate from clarification_needed
  lat: number;
  lon: number;
  originalQuery: string; // Re-submitted after location is confirmed
}
```

**Output**:
```typescript
{ queued: true }
```

---

### `chatStream` — Subscription

The real-time event stream for a session. The client subscribes on connection and
receives all chat events (loading state, AI messages, errors, clarification requests)
as typed events on a single observable.

```typescript
chatStream: publicProcedure
  .subscription(({ ctx }): Observable<ChatEvent, Error> => {
    return observable((emit) => { ... });
  })
```

**Input**: None (session identified by WebSocket connection)

**Output** — discriminated union emitted as individual events:

```typescript
type ChatEvent =
  | { type: 'loading' }
  | { type: 'message';              payload: MessagePayload }
  | { type: 'clarification_needed'; payload: ClarificationPayload }
  | { type: 'error';                payload: ErrorPayload };

interface MessagePayload {
  id: string;           // UUID v4
  role: 'ai';
  text: string;
  timestamp: string;    // ISO 8601
  weatherContext: WeatherContext;
}

interface ClarificationPayload {
  question: string;
  candidates: Array<{ displayName: string; lat: number; lon: number }>;
  originalQuery: string;
}

interface ErrorPayload {
  message: string;    // User-friendly — never a stack trace
  retryable: boolean;
}
```

---

## Error Formatting

A custom `errorFormatter` is registered on the router. It strips internal error
details and returns only:

```typescript
{
  message: string;  // User-friendly message
  code: string;     // tRPC error code (BAD_REQUEST, INTERNAL_SERVER_ERROR, etc.)
}
```

Raw stack traces, database errors, and internal messages MUST NOT reach the client.

---

## Session Lifecycle

```text
Client connects (WebSocket)
  └── Server creates Session { socketId, messages: [], correlationId }
  └── Client subscribes to chatStream

User calls sendQuery mutation
  └── Server emits { type: 'loading' } on chatStream
  └── Server resolves location
      ├── Ambiguous → emit { type: 'clarification_needed', payload: [...] }
      └── Resolved  → AI tool-use → emit { type: 'message', payload: {...} }

User calls selectLocation mutation
  └── Server re-processes with confirmed location
  └── Emits loading → message on chatStream

Client disconnects
  └── Server destroys Session from memory
```

---

## Client Setup

```typescript
// client/src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../server/src/router';

export const trpc = createTRPCReact<AppRouter>();
```

```typescript
// client/src/App.tsx (provider setup)
import { createWSClient, wsLink, splitLink, httpBatchLink } from '@trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc } from './lib/trpc';

const queryClient = new QueryClient();
const wsClient = createWSClient({ url: import.meta.env.VITE_SERVER_WS_URL });
const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true:  wsLink({ client: wsClient }),
      false: httpBatchLink({ url: import.meta.env.VITE_SERVER_URL + '/trpc' }),
    }),
  ],
});
```
