# WebSocket Contract: SkyTalk AI

**Transport**: Socket.io over WebSocket (fallback: HTTP long-polling)
**Server**: `http://localhost:4000` (dev) | `VITE_SERVER_URL` env var (prod)
**Namespace**: `/` (default)

---

## Client → Server Events

### `query`

Emitted when the user submits a weather question.

```typescript
// Payload
interface QueryPayload {
  text: string;      // The user's natural language query. Must be non-empty.
  sessionId?: string; // Reserved for future session resumption. Omit in v1.
}
```

**Example**:
```json
{ "text": "Will it rain in Boston this weekend?" }
```

**Validation**: Server rejects empty or whitespace-only `text` with an `error` event.

---

### `select_location`

Emitted when the user selects from a `clarification_needed` candidate list.

```typescript
interface SelectLocationPayload {
  displayName: string;  // Must match a displayName from the clarification_needed event
  lat: number;
  lon: number;
  originalQuery: string; // The original query text, re-submitted after resolution
}
```

---

## Server → Client Events

### `message`

Emitted when the AI has composed a complete response.

```typescript
interface MessagePayload {
  id: string;           // UUID v4
  role: "ai";
  text: string;         // The AI's conversational response
  timestamp: string;    // ISO 8601
  weatherContext: WeatherContext; // Always present on AI messages
}
```

**Example**:
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "role": "ai",
  "text": "Boston is looking great this weekend! Saturday will be sunny with a high of 18°C — perfect for being outside.",
  "timestamp": "2026-03-21T14:30:00Z",
  "weatherContext": {
    "condition": "sunny",
    "location": "Boston, MA, US",
    "temperatureCelsius": 18,
    "feelsLikeCelsius": 16,
    "humidity": 45,
    "windKph": 12,
    "precipitationProbability": 0.05
  }
}
```

---

### `loading`

Emitted immediately after `query` is received, before processing begins.

```typescript
interface LoadingPayload {
  state: true;  // Only "start" is emitted; end is implied by `message` or `error` arrival
}
```

---

### `clarification_needed`

Emitted when the server cannot resolve a location to a single match.

```typescript
interface ClarificationPayload {
  question: string;          // Human-readable prompt, e.g., "Which Springfield did you mean?"
  candidates: Array<{
    displayName: string;
    lat: number;
    lon: number;
  }>;
  originalQuery: string;     // The query that triggered ambiguity
}
```

**Example**:
```json
{
  "question": "Which Springfield did you mean?",
  "candidates": [
    { "displayName": "Springfield, IL, US", "lat": 39.7817, "lon": -89.6501 },
    { "displayName": "Springfield, MA, US", "lat": 42.1015, "lon": -72.5898 },
    { "displayName": "Springfield, MO, US", "lat": 37.2090, "lon": -93.2923 }
  ],
  "originalQuery": "What's the weather in Springfield?"
}
```

---

### `error`

Emitted when the weather service or AI service fails, or when the query is invalid.

```typescript
interface ErrorPayload {
  message: string;    // User-friendly message. Never a raw stack trace.
  retryable: boolean; // True if the user can retry the same query
}
```

**Example**:
```json
{
  "message": "I couldn't reach the weather service right now — want to try again?",
  "retryable": true
}
```

---

## Connection Lifecycle

```text
Client connects
  └── Socket.io handshake (automatic)
  └── Server creates Session in memory

Client emits query
  └── Server emits loading { state: true }
  └── Server resolves location
      ├── Ambiguous → Server emits clarification_needed
      └── Resolved → Server calls AI with weather tools
          └── AI response ready → Server emits message (with WeatherContext)

Client disconnects (tab close / navigation)
  └── Server destroys Session from memory
```
