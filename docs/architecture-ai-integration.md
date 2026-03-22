# SkyTalk — AI Integration Architecture

**Scope**: End-to-end request lifecycle — from the user typing a query in the browser to the
AI response and weather theme appearing on screen.
**Updated**: 2026-03-21

---

## Table of Contents

1. [System Components](#1-system-components)
2. [Transport Layer](#2-transport-layer)
3. [Happy Path — Unambiguous City](#3-happy-path--unambiguous-city)
4. [Ambiguous City Path — Disambiguation Flow](#4-ambiguous-city-path--disambiguation-flow)
5. [Error Paths](#5-error-paths)
6. [Data Shapes at Every Boundary](#6-data-shapes-at-every-boundary)
7. [Internal Session Model](#7-internal-session-model)
8. [OpenWeatherMap API Calls](#8-openweathermap-api-calls)
9. [LangChain Tool-Calling Loop](#9-langchain-tool-calling-loop)
10. [Key Design Decisions](#10-key-design-decisions)

---

## 1. System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER (React + Vite @ localhost:5173)                            │
│                                                                     │
│  App.tsx                                                            │
│  ├── useChat (hook)          — manages messages[], isLoading        │
│  ├── useWeatherTheme (hook)  — sets data-theme on <html>            │
│  ├── ChatInput               — submits query                        │
│  ├── ChatWindow              — renders message thread               │
│  ├── MessageBubble           — renders AI markdown / user text      │
│  ├── LoadingAnimation        — shows while awaiting response        │
│  └── AtmosphericBackground   — SVG weather scene per theme          │
│                                                                     │
│  tRPC client (splitLink)                                            │
│  ├── wsLink     → WebSocket  (subscriptions: chatStream)            │
│  └── httpLink   → HTTP/POST  (mutations: sendQuery, selectLocation) │
└──────────────┬─────────────────────────────┬───────────────────────┘
               │ WebSocket (WS)              │ HTTP POST /trpc/*
               │ ws://localhost:4000         │ http://localhost:4000
               ▼                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SERVER (Express + tRPC @ localhost:4000)                           │
│                                                                     │
│  index.ts                                                           │
│  ├── Express HTTP server                                            │
│  │   ├── CORS middleware          (allows client origin)            │
│  │   ├── /health                  (plain HTTP health check)         │
│  │   └── /trpc → tRPC HTTP adapter (mutations over HTTP)            │
│  └── WebSocketServer (ws)                                           │
│      └── tRPC WS adapter           (subscriptions over WS)         │
│                                                                     │
│  router/index.ts                    (AppRouter)                     │
│  ├── health        → query                                          │
│  ├── chatStream    → subscription  (creates Session, WS observable) │
│  ├── sendQuery     → mutation      (queues runQueryPipeline)        │
│  └── selectLocation→ mutation      (queues runQueryPipeline + pin)  │
│                                                                     │
│  In-memory sessions: Map<socketId, Session>                         │
│                                                                     │
│  services/aiService.ts                                              │
│  ├── ChatAnthropic (LangChain)    — claude-sonnet-4-6               │
│  ├── Tool: getCurrentWeather      — fetches current conditions      │
│  ├── Tool: getForecast            — fetches multi-day forecast      │
│  ├── Tool: searchLocations        — geocodes ambiguous city names   │
│  └── Tool-calling loop            — iterates until no pending calls │
│                                                                     │
│  services/weatherService.ts                                         │
│  ├── geocodeCity()    → OWM /geo/1.0/direct                        │
│  ├── getCurrent()     → OWM /data/2.5/weather                      │
│  └── getForecast()    → OWM /data/2.5/forecast                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS (Axios)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  EXTERNAL APIS                                                      │
│                                                                     │
│  api.openweathermap.org                                             │
│  ├── /geo/1.0/direct       — city name → lat/lon candidates        │
│  ├── /data/2.5/weather     — current conditions by city name        │
│  └── /data/2.5/forecast    — 3-hour slots for up to 5 days         │
│                                                                     │
│  api.anthropic.com                                                  │
│  └── /v1/messages          — Claude Sonnet 4.6 inference            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Transport Layer

### Session Bootstrapping

Before any query can be sent, the client must open a WebSocket and establish a session:

```
Browser                                    Server
  │                                           │
  │  1. crypto.randomUUID()                   │
  │     → socketId = "abc-123-..."            │
  │                                           │
  │  2. WebSocket connect                     │
  │     ws://localhost:4000?socketId=abc-123  │
  │ ─────────────────────────────────────────►│
  │                                           │  chatStream subscription handler:
  │                                           │  • Creates Session { socketId, correlationId, emit }
  │                                           │  • sessions.set("abc-123", session)
  │                                           │  • Binds emit() to WS observable
  │                                           │
  │◄─────────────────────────────────────────│
  │  3. WS connection established             │
  │     (subscription active)                 │
```

### Sending a Query (Dual-Channel Design)

The query travels over **HTTP** (fast, reliable mutation), while the response streams back
over the **already-open WebSocket** (event stream). The two channels are linked by `socketId`.

```
Browser                    Server (HTTP adapter)     Server (WS adapter)
  │                               │                         │
  │  HTTP POST /trpc/sendQuery    │                         │
  │  Headers: x-socket-id: abc-123│                         │
  │  Body: { text: "..." }        │                         │
  │ ─────────────────────────────►│                         │
  │                               │  ctx.socketId = "abc-123"
  │                               │  session = sessions.get("abc-123")
  │                               │  void runQueryPipeline(session, text)
  │                               │  ← fires-and-forgets               │
  │◄─────────────────────────────│                         │
  │  HTTP 200: { queued: true }   │                         │
  │  (returns immediately)        │                         │
  │                               │  session.emit(loading)──────────────►│
  │                               │                         │  WS event
  │◄────────────────────────────────────────────────────────│
  │  WS event: { type: "loading" }│                         │
  │  (isLoading = true, spinner)  │                         │
  │                               │  ... AI runs ...        │
  │◄────────────────────────────────────────────────────────│
  │  WS event: { type: "message", │                         │
  │    payload: { text, weatherContext, ... } }              │
```

---

## 3. Happy Path — Unambiguous City

**Example query**: `"What's the weather like in London today?"`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 1 — User submits query                                                                  │
│                                                                                              │
│  Client (useChat.ts)                                                                         │
│  ├── Appends optimistic user message to messages[] (instant UI update)                      │
│  └── Calls trpc.sendQuery.mutate({ text: "What's the weather like in London today?" })      │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                │
                │  HTTP POST /trpc/sendQuery
                │  x-socket-id: <socketId>
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 2 — Router validates and queues                                                         │
│                                                                                              │
│  router/index.ts · sendQuery mutation                                                        │
│  ├── Reads socketId from ctx (populated from x-socket-id header)                            │
│  ├── Looks up: session = sessions.get(socketId)      ← must exist (WS must be open)         │
│  ├── session.emit({ type: 'loading' })               ← WS → client shows spinner            │
│  ├── void runQueryPipeline(session, "What's the weather like in London today?")              │
│  └── Returns HTTP 200: { queued: true }              ← fast, before AI runs                 │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                │
                │  async (fire-and-forget from HTTP handler)
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 3 — AI Service initialises                                                              │
│                                                                                              │
│  services/aiService.ts · runAIQuery(queryText, log)                                         │
│                                                                                              │
│  ├── Creates ChatAnthropic({ model: 'claude-sonnet-4-6', streaming: false })                │
│  ├── Attaches PinoCallbackHandler (logs tool start/end/error times)                         │
│  ├── Binds 3 tools:                                                                          │
│  │     • getCurrentWeather(city)    — current conditions                                    │
│  │     • getForecast(city, days)    — multi-day forecast                                    │
│  │     • searchLocations(city)      — geocode ambiguous names                               │
│  │                                                                                           │
│  └── Builds initial message array:                                                           │
│        messages = [                                                                          │
│          SystemMessage(SYSTEM_PROMPT),          ← rules + persona + tool guidance           │
│          HumanMessage("What's the weather...")  ← verbatim user query                       │
│        ]                                                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                │
                │  POST api.anthropic.com/v1/messages
                │  model: claude-sonnet-4-6, tools: [...]
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 4 — Claude decides which tool to call (Turn 1)                                          │
│                                                                                              │
│  Anthropic API response:                                                                     │
│  {                                                                                           │
│    role: "assistant",                                                                        │
│    content: [...],                                                                           │
│    tool_calls: [                                                                             │
│      { name: "getCurrentWeather", args: { city: "London" }, id: "tool_abc" }                │
│    ]                                                                                         │
│  }                                                                                           │
│                                                                                              │
│  → Claude chose getCurrentWeather directly (London is globally unambiguous per system       │
│    prompt: "For famous, globally unambiguous cities, call getCurrentWeather directly")       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                │
                │  tool_calls.length > 0 → enter tool-calling loop
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 5 — Execute getCurrentWeather tool                                                      │
│                                                                                              │
│  aiService.ts · tool-calling loop                                                            │
│  ├── Pushes AIMessage (with tool_calls) to messages[]                                       │
│  ├── Calls getCurrentWeatherTool.invoke({ city: "London" })                                 │
│  │                                                                                           │
│  │   weatherService.ts · getCurrent("London")                                               │
│  │   ├── GET https://api.openweathermap.org/data/2.5/weather                                │
│  │   │       ?q=London&units=metric&appid=<KEY>                                             │
│  │   │                                                                                       │
│  │   │   OWM Response (abbreviated):                                                        │
│  │   │   {                                                                                   │
│  │   │     "name": "London",                                                                │
│  │   │     "sys": { "country": "GB" },                                                      │
│  │   │     "weather": [{ "main": "Clear", "description": "clear sky" }],                   │
│  │   │     "main": { "temp": 14.2, "feels_like": 13.1, "humidity": 72 },                   │
│  │   │     "wind": { "speed": 4.1 }         ← m/s, converted ×3.6 → kph                   │
│  │   │   }                                                                                   │
│  │   │                                                                                       │
│  │   └── Returns WeatherContext:                                                             │
│  │       {                                                                                   │
│  │         condition: "sunny",          ← mapOwmCondition("Clear") = "sunny"               │
│  │         location: "London, GB",                                                          │
│  │         temperatureCelsius: 14.2,                                                        │
│  │         feelsLikeCelsius: 13.1,                                                          │
│  │         humidity: 72,                                                                     │
│  │         windKph: 14.76,                                                                   │
│  │         precipitationProbability: 0                                                       │
│  │       }                                                                                   │
│  │                                                                                           │
│  ├── Saves JSON string as lastWeatherContextJson                                            │
│  │   (this becomes the WeatherContext attached to the final MessagePayload)                  │
│  └── Pushes ToolMessage({ tool_call_id: "tool_abc", content: <json> }) to messages[]       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                │
                │  POST api.anthropic.com/v1/messages  (Turn 2)
                │  messages now include: SystemMessage, HumanMessage,
                │                       AIMessage(tool_calls), ToolMessage(weather data)
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 6 — Claude generates the final response (Turn 2)                                        │
│                                                                                              │
│  Anthropic API response:                                                                     │
│  {                                                                                           │
│    role: "assistant",                                                                        │
│    content: "It's a lovely clear day in London right now — 14°C with a light breeze...",    │
│    tool_calls: []    ← no more tools needed                                                  │
│  }                                                                                           │
│                                                                                              │
│  aiService.ts:                                                                               │
│  ├── tool_calls.length === 0 → exit loop                                                    │
│  ├── Extracts text from response.content                                                    │
│  ├── Parses lastWeatherContextJson → WeatherContext                                         │
│  └── Returns MessagePayload:                                                                 │
│      {                                                                                       │
│        id: "<uuid>",                                                                         │
│        role: "ai",                                                                           │
│        text: "It's a lovely clear day in London right now...",                              │
│        timestamp: "2026-03-21T14:32:00.000Z",                                               │
│        weatherContext: { condition: "sunny", location: "London, GB", ... }                  │
│      }                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                │
                │  return to runQueryPipeline
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 7 — Router emits response over WebSocket                                                │
│                                                                                              │
│  router/index.ts · runQueryPipeline                                                          │
│  └── session.emit({ type: 'message', payload: <MessagePayload> })                           │
│      → observable.next() → tRPC WS adapter → WebSocket frame → browser                     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                │
                │  WebSocket event
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 8 — Client receives and renders                                                         │
│                                                                                              │
│  hooks/useChat.ts · chatStream.useSubscription handler                                       │
│  ├── event.type === 'loading'                                                                │
│  │     → setIsLoading(true)                                                                  │
│  │                                                                                           │
│  └── event.type === 'message'                                                                │
│        → setIsLoading(false)                                                                 │
│        → setMessages(prev => [...prev, { role:'ai', text, ... }])                           │
│        → setLatestWeatherContext(payload.weatherContext)                                     │
│                                                                                              │
│  hooks/useWeatherTheme.ts                                                                    │
│  └── weatherContext.condition = "sunny"                                                      │
│        → document.documentElement.setAttribute('data-theme', 'sunny')                       │
│        → CSS custom properties update across entire UI                                       │
│        → AtmosphericBackground re-renders with the Sunny SVG scene                          │
│        → 0.8s CSS transition on background-color                                            │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Ambiguous City Path — Disambiguation Flow

**Example query**: `"What's the weather in Springfield?"`

```
┌─ Steps 1–4 identical to Happy Path ─────────────────────────────────────────────────────────┐
│  Claude receives query. SYSTEM_PROMPT rule 5 instructs:                                      │
│  "For city names shared by multiple places (e.g. Springfield), use searchLocations first."   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                │
                │  Claude decides: tool_calls = [{ name: "searchLocations", args: { city: "Springfield" } }]
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 5a — searchLocations tool executes                                                      │
│                                                                                              │
│  weatherService.ts · geocodeCity("Springfield")                                              │
│  └── GET https://api.openweathermap.org/geo/1.0/direct                                      │
│          ?q=Springfield&limit=5&appid=<KEY>                                                  │
│                                                                                              │
│  OWM returns 5 results:                                                                      │
│  [                                                                                           │
│    { name:"Springfield", state:"Illinois",      country:"US", lat:39.79, lon:-89.64 },       │
│    { name:"Springfield", state:"Missouri",      country:"US", lat:37.21, lon:-93.29 },       │
│    { name:"Springfield", state:"Massachusetts", country:"US", lat:42.10, lon:-72.59 },       │
│    { name:"Springfield", state:"Ohio",          country:"US", lat:39.92, lon:-83.80 },       │
│    { name:"Springfield", state:"Oregon",        country:"US", lat:44.04, lon:-123.02 },      │
│  ]                                                                                           │
│                                                                                              │
│  → results.length > 1 → maps to LocationCandidate[]                                         │
│  → returns LocationCandidate[] (not a single Location)                                       │
│                                                                                              │
│  searchLocationsTool handler:                                                                │
│  → Array.isArray(result) === true                                                            │
│  → throw new ClarificationNeededError(candidates, "What's the weather in Springfield?")     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                │
                │  ClarificationNeededError propagates up through:
                │    searchLocationsTool.invoke() → tool-calling loop → runAIQuery()
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 6a — runAIQuery re-throws; runQueryPipeline catches                                     │
│                                                                                              │
│  router/index.ts · runQueryPipeline catch block:                                             │
│  └── err.name === 'ClarificationNeededError'                                                 │
│        → session.emit({                                                                      │
│            type: 'clarification_needed',                                                     │
│            payload: {                                                                        │
│              question: "Which location did you mean?",                                       │
│              candidates: [ { displayName:"Springfield, Illinois, US", lat, lon }, ... ],     │
│              originalQuery: "What's the weather in Springfield?"                             │
│            }                                                                                 │
│          })                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                │
                │  WebSocket event: { type: "clarification_needed", payload: {...} }
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 7a — Client shows disambiguation options                                                │
│                                                                                              │
│  hooks/useChat.ts:                                                                           │
│  └── Appends a message to the thread with the list of candidates                            │
│      (UI renders them as selectable options for the user)                                    │
│                                                                                              │
│  User clicks "Springfield, Illinois, US"                                                     │
│  → trpc.selectLocation.mutate({                                                              │
│       displayName: "Springfield, Illinois, US",                                              │
│       lat: 39.79, lon: -89.64,                                                              │
│       originalQuery: "What's the weather in Springfield?"                                    │
│     })                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                │
                │  HTTP POST /trpc/selectLocation
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 8a — Router re-runs pipeline with pinned location                                       │
│                                                                                              │
│  router/index.ts · selectLocation mutation:                                                  │
│  └── void runQueryPipeline(session, originalQuery, {                                         │
│          lat: 39.79, lon: -89.64,                                                            │
│          displayName: "Springfield, Illinois, US"                                            │
│        })                                                                                    │
│                                                                                              │
│  aiService.ts · runAIQuery(query, log, overrideLocation):                                   │
│  └── HumanMessage becomes:                                                                   │
│        "What's the weather in Springfield?\n\n(The user has confirmed the location:          │
│         Springfield, Illinois, US. Use this city name when calling weather tools.)"          │
│                                                                                              │
│  → Claude now calls getCurrentWeather({ city: "Springfield, Illinois, US" })                │
│  → Continues with Happy Path Steps 5–8                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Error Paths

### 5a — OpenWeatherMap is unavailable

```
weatherService.ts · getCurrent() or geocodeCity()
  └── axios throws (network / 5xx / timeout)
        → catch: throw WeatherServiceError("...unavailable...", retryable: true)
              ↑
aiService.ts · getCurrentWeatherTool.invoke()
  └── throws WeatherServiceError
        → propagates out of tool-calling loop
              ↑
runAIQuery() catch block
  └── err.name !== 'ClarificationNeededError'
        → throw AIServiceError("AI assistant temporarily unavailable...")
              ↑  ← NOTE: WeatherServiceError is re-wrapped as AIServiceError here
runQueryPipeline() catch block
  └── makeErrorEvent(err)
        → err.name === 'AIServiceError'
        → session.emit({ type: 'error', payload: { message: "...", retryable: false } })

Client:
  └── useChat appends { role: 'error' } message to thread
      isLoading = false → input re-enabled immediately
```

### 5b — City not found (0 OWM geocoding results)

```
weatherService.ts · geocodeCity()
  └── results.length === 0
        → throw WeatherServiceError(`I couldn't find "${city}"`, retryable: false)

Same propagation as 5a, but retryable: false
→ client shows error bubble, user can rephrase
```

### 5c — Anthropic API is unavailable

```
ChatAnthropic.invoke() throws (network / auth / rate-limit)
  ↑
runAIQuery() catch block
  └── throw AIServiceError("AI assistant temporarily unavailable...")
        → runQueryPipeline → session.emit error event
```

### 5d — Invalid session (WS not open when mutation fires)

```
sendQuery mutation handler:
  ├── ctx.socketId missing → TRPCError(UNAUTHORIZED, "No active session")
  └── sessions.get(socketId) undefined → TRPCError(UNAUTHORIZED, "Session not found")

→ HTTP 401 response to the mutation call
→ tRPC client surfaces as an error (not a chat bubble)
```

---

## 6. Data Shapes at Every Boundary

### A · Client → Server (HTTP mutation)

```typescript
// sendQuery
{ text: string }           // 1–500 chars (Zod validated)

// selectLocation
{
  displayName: string,     // "Springfield, Illinois, US"
  lat: number,             // 39.79
  lon: number,             // -89.64
  originalQuery: string    // original user text
}
```

### B · Server → Client (WebSocket event stream)

```typescript
type ChatEvent =
  | { type: 'loading' }
  | { type: 'message';             payload: MessagePayload }
  | { type: 'clarification_needed'; payload: ClarificationPayload }
  | { type: 'error';               payload: ErrorPayload };

interface MessagePayload {
  id: string;              // UUID v4
  role: 'ai';
  text: string;            // Claude's prose response (markdown)
  timestamp: string;       // ISO 8601
  weatherContext: WeatherContext;
}

interface ClarificationPayload {
  question: string;        // "Which location did you mean?"
  candidates: Array<{ displayName: string; lat: number; lon: number }>;
  originalQuery: string;
}

interface ErrorPayload {
  message: string;         // user-friendly, no stack traces
  retryable: boolean;
}
```

### C · Server → Anthropic API (LangChain messages)

```typescript
// Turn 1 (initial query)
messages: [
  SystemMessage(SYSTEM_PROMPT),         // persona + rules + tool guidance
  HumanMessage("What's the weather...") // verbatim user query
                                        // + override hint if selectLocation
]

// Turn 2 (after tool call)
messages: [
  SystemMessage,
  HumanMessage,
  AIMessage({ content, tool_calls: [...] }),  // Claude's tool request
  ToolMessage({ tool_call_id, content: JSON }) // tool result
]
```

### D · Server → OpenWeatherMap API

```
GET /geo/1.0/direct?q={city}&limit=5&appid={KEY}&units=metric
GET /data/2.5/weather?q={city}&units=metric&appid={KEY}
GET /data/2.5/forecast?q={city}&units=metric&cnt={days*8}&appid={KEY}
```

### E · OpenWeatherMap → Server (WeatherContext)

```typescript
interface WeatherContext {
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'neutral';
  location: string;              // "London, GB"
  temperatureCelsius: number;    // OWM main.temp (metric)
  feelsLikeCelsius: number;      // OWM main.feels_like
  humidity: number;              // 0–100
  windKph: number;               // OWM wind.speed × 3.6
  precipitationProbability: number; // 0.0–1.0 (forecast only)
}

// Condition mapping:
// OWM "Clear"       → "sunny"
// OWM "Clouds"      → "cloudy"
// OWM "Rain"        → "rainy"
// OWM "Drizzle"     → "rainy"
// OWM "Thunderstorm"→ "stormy"
// anything else     → "cloudy"
```

---

## 7. Internal Session Model

Sessions live in a `Map<string, Session>` in memory (process-local, not persisted).

```typescript
interface Session {
  socketId: string;      // UUID generated by client, links WS ↔ HTTP
  messages: Message[];   // conversation history (not currently sent to Claude)
  correlationId: string; // UUID for structured log correlation
  emit: (event: ChatEvent) => void; // bound to tRPC WS observable.next()
}
```

**Lifecycle**:
```
chatStream subscription opens
  → session created, stored in sessions Map

HTTP mutation arrives
  → reads x-socket-id header → sessions.get(socketId) → session found

WS connection closes (client navigates away / network drop)
  → observable cleanup callback fires → sessions.delete(socketId)
```

**Important**: If the browser closes and reopens, a new `socketId` is generated. The old
session is cleaned up. No history is preserved across page reloads (by design — stateless
single-session model).

---

## 8. OpenWeatherMap API Calls

| Endpoint | Purpose | Called By | Key Params |
|---|---|---|---|
| `GET /geo/1.0/direct` | Resolve city name → lat/lon | `geocodeCity()` via `searchLocationsTool` | `q`, `limit=5` |
| `GET /data/2.5/weather` | Current conditions | `getCurrent()` via `getCurrentWeatherTool` | `q`, `units=metric` |
| `GET /data/2.5/forecast` | 3-hour slots, up to 5 days | `getForecast()` via `getForecastTool` | `q`, `units=metric`, `cnt=days×8` |

**Nickname resolution** happens in `weatherService.resolveNickname()` before any OWM call:
```
"Big Apple" → "New York"
"Windy City" → "Chicago"
"CDMX"      → "Mexico City"
```
*(Note: nickname resolution is defined in weatherService but must be called explicitly by
the tool handler — currently tools pass the city string from Claude's args directly.)*

**Forecast aggregation**: OWM returns 3-hour interval slots. The server aggregates them into
daily summaries by taking the most common weather condition and max/min temperature across all
slots for that calendar day.

---

## 9. LangChain Tool-Calling Loop

```
                    ┌─────────────────────────────────────────┐
                    │     runAIQuery (aiService.ts)            │
                    │                                          │
    messages = [SystemMessage, HumanMessage]                  │
                    │                                          │
                    ▼                                          │
            llm.invoke(messages)                               │
                    │                                          │
                    ▼                                          │
        ┌───────────────────────┐                             │
        │  response.tool_calls  │                             │
        │    length > 0?        │                             │
        └───────────┬───────────┘                             │
               Yes  │         No ──────────────────────────►  │
                    ▼                                         │  Extract text
        For each tool call:                                    │  Parse WeatherContext
          push AIMessage(tool_calls) to messages              │  Return MessagePayload
          invoke tool (getCurrentWeather /                     │
                       getForecast /                           │
                       searchLocations)                        │
                    │                                          │
            tool succeeds?                                     │
           ┌────────┴────────┐                                │
          Yes               No (ClarificationNeededError)      │
           │                 └──► throw → router handles        │
           ▼                                                   │
        push ToolMessage(result) to messages                   │
        set lastWeatherContextJson (if getCurrentWeather)      │
                    │                                          │
                    └── llm.invoke(messages) [next turn] ──►  │
                                                              │
                    ◄─────────────────────────────────────────┘
```

**Maximum loop depth**: No hard cap in code, but Claude reliably stops after fetching the
data it needs (typically 1 tool call for current weather, 2 for forecast + current).

**Tool call routing in loop**:
```typescript
if (toolCall.name === 'getCurrentWeather') {
  result = await getCurrentWeatherTool.invoke(args);
  lastWeatherContextJson = result;   // ← captured for WeatherContext
} else if (toolCall.name === 'getForecast') {
  result = await getForecastTool.invoke(args);
} else if (toolCall.name === 'searchLocations') {
  result = await searchLocationsTool.invoke(args);
  // ↑ may throw ClarificationNeededError — exits loop immediately
}
```

---

## 10. Key Design Decisions

| Decision | Rationale |
|---|---|
| **Dual-channel (HTTP mutation + WS subscription)** | HTTP mutations are reliable, authenticated, and immediately acknowledged. WS carries the async event stream. Avoids long-polling or SSE for the response. |
| **socketId links the two channels** | Client generates one UUID at startup, sends it in both the WS URL query string and the `x-socket-id` HTTP header. Server uses this as the session key in its in-memory `Map`. |
| **AI decides when to geocode** | The system prompt instructs Claude to call `searchLocations` only for ambiguous city names. Famous cities (London, Paris, Tokyo) go straight to `getCurrentWeather`. This avoids unnecessary API calls and prevents false disambiguation for well-known cities. |
| **ClarificationNeededError crosses service boundaries** | `searchLocationsTool` throws it; `runAIQuery` re-throws it; `runQueryPipeline` catches and emits a structured WS event. This keeps disambiguation logic in the router, away from the AI service. |
| **WeatherContext captured from tool result** | `lastWeatherContextJson` stores the raw `getCurrent()` output. After Claude finishes writing its prose, the router parses this JSON and attaches it to the message payload. This avoids asking Claude to output structured JSON and risking hallucination. |
| **Error stripping in tRPC errorFormatter** | `shape.data` is stripped to `{ code, httpStatus }` only — no stack traces or internal error details ever reach the browser. |
| **Fire-and-forget pipeline** | `runQueryPipeline` is called with `void` — the HTTP mutation returns immediately with `{ queued: true }` while the AI runs asynchronously. This prevents HTTP timeouts on slow AI responses. |
| **Condition mapping is server-side** | OWM weather codes are mapped to `WeatherCondition` in `mapOwmCondition()` on the server. The client only ever sees `sunny \| cloudy \| rainy \| stormy \| neutral`. |
| **No location in pino INFO logs** | The `PinoCallbackHandler` and weatherService log tool invocation events but never log city names or coordinates at INFO level — only at DEBUG. Privacy by design. |
