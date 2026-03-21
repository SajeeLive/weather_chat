# Research: SkyTalk AI — Technology Decisions

**Feature**: 001-skytalk-ai-chat
**Date**: 2026-03-21
**Status**: Complete — all NEEDS CLARIFICATION resolved

## 1. Weather API

**Decision**: OpenWeatherMap (free tier)

**Rationale**:
- Free tier: 60 calls/minute; current weather + 5-day/3-hour forecast; humidity,
  wind, precipitation all included.
- Geocoding API supports standard city names, country codes, and zip codes globally.
- Widely used in interview/demo projects — documentation is well-understood.
- 60 req/min is sufficient for ~10 concurrent sessions at demo scale.

**Alternatives considered**:
- **WeatherAPI.com**: Better colloquial/alternate name support in geocoding; flatter
  JSON; 1M free calls/month. Valid alternative — chosen OWM for familiarity.
- **Tomorrow.io**: Highest data accuracy; 300 calls/day free tier is too low;
  overkill for interview scope.

**Colloquial name gap**: OWM does not resolve "The Big Apple" or "The Windy City".
Addressed via a static server-side nickname map (see weatherService design).

---

## 2. AI Orchestration Framework

**Decision**: LangChain (`@langchain/core` + `@langchain/anthropic`) with Claude tool-calling agent

**Model**: `claude-sonnet-4-6` via `ChatAnthropic`

**Rationale**:
- LangChain provides a clean abstraction over tool-calling: weather tools are defined
  as LangChain `tool()` instances with Zod schemas, then bound to the Claude model.
  The framework handles the tool-call/tool-result loop automatically.
- Prevents hallucination: Claude only has weather data returned by the tools; it
  cannot invent values.
- Token-efficient: Data is fetched on demand when Claude invokes a tool, not
  pre-loaded into every message.
- Enables mid-conversation clarification: Claude can emit a clarification question
  as a regular message before invoking any tool — no premature API call.
- LangChain's `ChatAnthropic` integrates natively with tRPC subscriptions via
  streaming: `stream()` on the chain maps directly to observable emissions on
  `chatStream`.
- Framework-level observability: LangChain callbacks provide structured hooks for
  logging tool invocations, token usage, and chain steps — feeding directly into
  pino without manual instrumentation.

**Key packages**:
- `@langchain/core` — base abstractions (runnables, tools, prompts, output parsers)
- `@langchain/anthropic` — `ChatAnthropic` class; Claude model integration
- `langchain` — `tool()` helper for defining weather tools with Zod schemas

**Tool definition pattern**:
```typescript
import { tool } from 'langchain/tools';
import { z } from 'zod';

const getCurrentWeather = tool(
  async ({ city }) => weatherService.getCurrent(city),
  {
    name: 'getCurrentWeather',
    description: 'Get current weather conditions for a city',
    schema: z.object({ city: z.string() }),
  }
);
```

**Alternatives considered**:
- **Raw `@anthropic-ai/sdk` tool use**: Requires manual tool-call/result loop,
  manual streaming assembly, and manual callback instrumentation. LangChain removes
  all of this boilerplate with no meaningful performance cost at interview scale.
- **LangGraph**: More powerful (durable execution, human-in-the-loop, persistence)
  but adds significant complexity. Not needed for a session-scoped chat demo.
- **Context injection**: Pre-fetch weather data into every prompt. Inflates tokens,
  forces location guessing, and prevents Claude from asking clarifying questions first.

---

## 3. Real-Time Transport

**Decision**: tRPC v11 — HTTP adapter (Express) + WebSocket adapter (`ws`)

**Rationale**:
- tRPC subscriptions over WebSocket replace Socket.io entirely. The `chatStream`
  subscription procedure emits a typed `ChatEvent` discriminated union — loading,
  message, clarification_needed, error — all typed end-to-end.
- `AppRouter` exported from the server and imported type-only by the client eliminates
  manual type synchronisation (Principle VI).
- Auto-reconnect via tRPC's `wsLink`; no manual heartbeat implementation needed.
- At ~10 concurrent sessions, the overhead is negligible.

**Alternatives considered**:
- **Socket.io**: No end-to-end type safety; requires manual event name strings and
  manual type mirroring — both violate Principle VI.
- **Raw `ws` library**: Requires manual reconnection, serialisation, and session
  management. Rejected for the same reasons as before.

---

## 4. Client Animations

**Decision**: Pure CSS `@keyframes` animations

**Rationale**:
- Zero JavaScript bundle contribution — animations live entirely in CSS.
- GPU-accelerated when limited to `transform` and `opacity` properties — achieves
  60fps on mid-range hardware without JavaScript overhead.
- Sufficient for the required effects: drifting clouds (`translateX`), pulsing sun
  (`scale` + `opacity`), falling rain (`translateY` with staggered delays), lightning
  flicker (`opacity`).
- Consistent with the constitution's Simplicity principle: no additional dependency
  for effects achievable with standard CSS.

**Alternatives considered**:
- **Framer Motion**: ~40KB gzipped; excellent for gesture-driven and orchestrated
  animations, but those capabilities are not needed here.
- **GSAP**: Powerful but requires license consideration for commercial use; adds
  complexity for straightforward keyframe effects.

---

## 5. Client Build Tool

**Decision**: Vite (scaffolded with `pnpm create vite -- --template react-ts`)

**Rationale**:
- Fastest dev server with native TypeScript and React support out of the box.
- Near-zero configuration for the required feature set.
- Native alignment with Vitest (same tool author — no config bridge needed).

---

## 6. Server Logging

**Decision**: pino

**Rationale**:
- Fastest structured JSON logger available for Node.js.
- Outputs newline-delimited JSON by default — machine-parseable without configuration.
- Supports log levels (trace, debug, info, warn, error) and child loggers for
  per-request correlation IDs.

---

## 7. Colloquial City Name Resolution

**Decision**: Static nickname map on the server + OWM geocoding for standard names

**Approach**:
1. Before calling OWM, check the query text against a `nicknameMap` lookup:
   `{ "big apple": "New York", "windy city": "Chicago", "city of angels": "Los Angeles",
   "ciudad de mexico": "Mexico City", ... }`
2. If a match is found, substitute the canonical name before passing to OWM geocoding.
3. For ambiguous standard names (e.g., "Springfield"), use OWM geocoding with
   `limit=5` to return candidate cities and emit a `clarification_needed` event.

**Rationale**: OWM's geocoding does not support colloquial names. The nickname map
covers the most common cases without adding a third external dependency (e.g., a
separate geocoding service). Claude itself can also extract and normalize location
names from context before the tool is invoked.
