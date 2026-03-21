# weather_chat Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-21

## Active Technologies

**Server** (002-skytalk-server): TypeScript 5.x, Node.js 20 LTS, Express,
`@trpc/server` + WS adapter, LangChain (`@langchain/anthropic`, `@langchain/core`,
`langchain`) with `ChatAnthropic` + tool-calling agent, Axios (OpenWeatherMap), pino, Zod, Jest

**Client** (003-skytalk-client): TypeScript 5.x, React 18, Vite,
`@trpc/react-query`, `@tanstack/react-query`, pure CSS animations, Vitest + RTL

## Project Structure

```text
server/
├── src/
│   ├── router/           # index.ts — AppRouter definition (tRPC); exported type = API contract
│   ├── services/         # weatherService.ts, aiService.ts
│   ├── middleware/        # logger.ts (pino)
│   ├── types/            # index.ts — WeatherContext, Message, Session, ForecastDay
│   └── index.ts          # Express + tRPC HTTP + tRPC WS server entry
└── tests/

client/
├── src/
│   ├── components/       # ChatWindow, MessageBubble, ChatInput,
│   │                     # AtmosphericBackground, LoadingAnimation
│   ├── lib/              # trpc.ts — createTRPCReact<AppRouter>() singleton
│   ├── hooks/            # useChat.ts (subscription + mutation), useWeatherTheme.ts
│   └── styles/           # themes.css, animations.css
└── tests/
```

## Commands

```bash
# Server
cd server && pnpm dev         # Start dev server (port 4000)
cd server && pnpm test        # Jest tests

# Client
cd client && pnpm dev         # Start Vite dev server (port 5173)
cd client && pnpm test        # Vitest tests
```

## Key Conventions

- **Type contract**: `import type { AppRouter } from '../../../server/src/router'` in client
  — type-only, erased at build time. This IS the API contract. No manual type files.
- **tRPC procedures**: `health` (query), `sendQuery` (mutation), `selectLocation` (mutation),
  `chatStream` (subscription — emits `loading | message | clarification_needed | error`)
- **tRPC links**: `splitLink` routes subscriptions to wsLink, queries/mutations to httpBatchLink
- **Weather themes**: `data-theme` on `<html>`: `sunny | cloudy | rainy | stormy | neutral`
- **Env vars**: `VITE_SERVER_URL` (HTTP), `VITE_SERVER_WS_URL` (WebSocket) on client;
  `OPENWEATHERMAP_API_KEY`, `ANTHROPIC_API_KEY`, `PORT` on server
- **LangChain pattern**: `ChatAnthropic` + `llm.bindTools([...])` + streaming into tRPC subscription observable.
  Tools defined via `tool(fn, { name, description, schema })` from `langchain/tools`.
- **LangChain MCP**: `docs-langchain` MCP server configured — query it for up-to-date LangChain API docs.
- **Logging**: pino structured JSON + LangChain callbacks for tool invocation tracing; location MUST NOT appear at INFO+
- **TDD**: tests written before implementation; tRPC procedures testable without HTTP via caller
- **CSS animations only** — no Framer Motion, GSAP, or Lottie; `transform`/`opacity` only

## Recent Changes

- 002-skytalk-server: Updated — Socket.io replaced by tRPC router + WS adapter (constitution v1.2.0)
- 003-skytalk-client: Updated — socket.io-client replaced by @trpc/react-query (constitution v1.2.0)

<!-- MANUAL ADDITIONS START -->

<!-- intent-skills:start -->
# Skill mappings - when working in these areas, load the linked skill file into context.
# NOTE: Skill paths below resolve after running `pnpm install` in client/ and server/.
# Re-run `pnpm dlx @tanstack/intent@latest install` post-install to confirm exact paths.
skills:
  - task: "writing or modifying tRPC router procedures (queries, mutations, subscriptions)"
    load: "client/node_modules/@trpc/react-query/skills/trpc-react-query/SKILL.md"
  - task: "using tRPC hooks in React components (useQuery, useMutation, useSubscription)"
    load: "client/node_modules/@trpc/react-query/skills/trpc-react-query/SKILL.md"
  - task: "managing server state, loading, and error states with TanStack Query"
    load: "client/node_modules/@tanstack/react-query/skills/react-query/SKILL.md"
  - task: "adding new tRPC procedures to the AppRouter or changing input/output types"
    load: "client/node_modules/@trpc/react-query/skills/trpc-react-query/SKILL.md"
<!-- intent-skills:end -->

<!-- MANUAL ADDITIONS END -->
