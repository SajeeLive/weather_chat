# Implementation Plan: SkyTalk AI — Conversational Weather Chatbot

**Branch**: `001-skytalk-ai-chat` | **Date**: 2026-03-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-skytalk-ai-chat/spec.md`

## Summary

SkyTalk AI is a session-based conversational weather chatbot delivered as a web
application. Users ask natural language questions; the server fetches real-time
meteorological data, calls the Claude AI to generate an empathetic human-readable
response, and streams it back via tRPC subscription over WebSocket. The client renders
the response in a chat UI that dynamically shifts its visual theme to match the weather
being described. End-to-end type safety is enforced by tRPC — the `AppRouter` type is
the single source of truth for all client-server communication.

This is the **parent plan**. Implementation is split into two dedicated sub-plans:

- **[002-skytalk-server](../../002-skytalk-server/plan.md)** — Node.js/TypeScript
  backend: tRPC router, AI orchestration, weather API integration, structured logging.
- **[003-skytalk-client](../../003-skytalk-client/plan.md)** — React/TypeScript
  frontend: tRPC React hooks, chat UI, atmospheric animations, dynamic weather themes.

## Technical Context

**Language/Version**: TypeScript 5.x (both client and server)
**Primary Dependencies**:

- Server: Node.js 20 LTS, Express, `@trpc/server`, `@trpc/server/adapters/ws`,
  LangChain (`@langchain/anthropic`, `@langchain/core`, `langchain`), Axios (OpenWeatherMap), pino, Zod
- Client: React 18, Vite, `@trpc/react-query`, `@tanstack/react-query`,
  pure CSS animations (no external animation library)

**API Layer**: tRPC v11 — `AppRouter` exported from server, imported as type-only
on client. Procedures: `health` (query), `sendQuery` (mutation),
`chatStream` (subscription), `selectLocation` (mutation).

**Storage**: None — session-only; no database required
**Testing**: Jest + tRPC test helpers (server); Vitest + React Testing Library (client)
**Target Platform**: Modern web browsers (Chrome, Firefox, Safari); Linux server (Node)
**Project Type**: Web application (client/server)
**Performance Goals**: Full AI response within 8 seconds (SC-001); CSS animations at
60fps; zero JS bundle overhead for animations (pure CSS)
**Constraints**: No user auth; no persistent storage; session-scoped; 7-day forecast
ceiling; tRPC type import requires client to reference server source at build time
**Scale/Scope**: Single-user sessions; interview/demo scale (~10 concurrent)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Prime Directive | ✅ PASS | Claude tool-use + empathetic system prompt |
| I. Client-Server Separation | ✅ PASS | tRPC router is the contract; AI logic server-side only |
| II. Real-Time First | ✅ PASS | tRPC subscription over WebSocket for all chat events |
| III. Test-Driven Development | ✅ PASS | Tests written first in both 002 and 003 task plans |
| IV. Simplicity & Spec-Driven | ✅ PASS | Two services only; no manual type mirroring |
| V. Observability & Resilience | ✅ PASS | pino structured logging; graceful tRPC error handling |
| VI. End-to-End Type Safety | ✅ PASS | AppRouter type-only import on client; compiler enforces contract |
| Design: Atmospheric Immersion | ✅ PASS | CSS weather themes + animated elements in client |
| Design: Clarity Over Density | ✅ PASS | Single-column chat; theme communicates before text |
| Design: Delight in Waiting | ✅ PASS | CSS loading animation (non-blocking) |
| Conversational: Empathetic Accuracy | ✅ PASS | System prompt enforces interpretive responses |
| Conversational: Contextual Relevance | ✅ PASS | Tool use returns activity suitability |
| Ethical: Safety First | ✅ PASS | System prompt includes extreme weather safety directive |
| Ethical: Privacy by Design | ✅ PASS | Location session-scoped; never logged at INFO+ |

**Post-design re-check**: All gates pass including new Principle VI. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-skytalk-ai-chat/
├── plan.md              # This file — parent overview
├── research.md          # Tech stack decisions (Phase 0)
├── data-model.md        # Shared entity definitions (Phase 1)
├── quickstart.md        # Dev setup guide (Phase 1)
└── contracts/
    ├── trpc-router.md   # tRPC router procedure definitions (replaces websocket.md)
    └── rest.md          # Health check endpoint

specs/002-skytalk-server/
├── spec.md              # Server feature spec
└── plan.md              # Server implementation plan → tasks.md via /speckit.tasks

specs/003-skytalk-client/
├── spec.md              # Client feature spec
└── plan.md              # Client implementation plan → tasks.md via /speckit.tasks
```

### Source Code (repository root)

```text
server/
├── src/
│   ├── router/
│   │   └── index.ts              # tRPC AppRouter — exported type is the API contract
│   ├── services/
│   │   ├── weatherService.ts     # OpenWeatherMap API + nickname resolver
│   │   └── aiService.ts          # Claude API tool-use orchestration
│   ├── middleware/
│   │   └── logger.ts             # pino structured logging
│   ├── types/
│   │   └── index.ts              # WeatherContext, Message, Session, ForecastDay
│   └── index.ts                  # Express + tRPC WS adapter server entry
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
└── tsconfig.json

client/
├── src/
│   ├── components/
│   │   ├── ChatWindow/
│   │   ├── MessageBubble/
│   │   ├── ChatInput/
│   │   ├── AtmosphericBackground/
│   │   └── LoadingAnimation/
│   ├── lib/
│   │   └── trpc.ts               # createTRPCReact<AppRouter>() singleton
│   ├── hooks/
│   │   ├── useChat.ts            # Wraps tRPC chatStream subscription + sendQuery mutation
│   │   └── useWeatherTheme.ts    # Derives CSS theme from WeatherContext
│   ├── styles/
│   │   ├── themes.css            # Weather theme CSS custom properties + transitions
│   │   └── animations.css        # @keyframes for sun, clouds, rain, lightning
│   └── App.tsx
├── tests/
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json
```

**Structure Decision**: Web application — `client/` and `server/` at repository root.
The client imports `AppRouter` as a type-only import from `../../server/src/router`
at build time. Vite's TypeScript compiler strips type-only imports — no runtime
dependency on server code. This avoids monorepo tooling overhead while satisfying
Principle VI.

## Complexity Tracking

> No violations — table not required.
