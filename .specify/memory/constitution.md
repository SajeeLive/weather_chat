<!--
SYNC IMPACT REPORT
==================
Version change: 1.1.0 → 1.2.0
Bump type: MINOR — new principle added (VI. End-to-End Type Safety); no principles removed.
Modified principles:
  - I. Client-Server Separation: clarified that the tRPC router IS the contract
  - IV. Simplicity & Spec-Driven Evolution: added note that manual type-mirroring is prohibited
Added sections:
  - VI. End-to-End Type Safety (new principle)
Removed sections: None
Templates reviewed:
  - .specify/templates/plan-template.md    ✅ Compatible — Constitution Check table gains new row
  - .specify/templates/spec-template.md    ✅ Compatible — no structural changes needed
  - .specify/templates/tasks-template.md   ✅ Compatible — tRPC router setup becomes a Phase 2 task
  - .specify/templates/agent-file-template.md ✅ Compatible
Plans updated:
  - specs/001-skytalk-ai-chat/plan.md      ✅ Updated (tRPC in tech context + constitution check)
  - specs/002-skytalk-server/plan.md       ✅ Updated (tRPC router replaces Socket.io handler)
  - specs/003-skytalk-client/plan.md       ✅ Updated (@trpc/react-query replaces socket.io-client)
  - specs/001-skytalk-ai-chat/contracts/   ✅ Replaced (websocket.md → trpc-router.md)
  - CLAUDE.md                              ✅ Updated
Deferred TODOs:
  - TODO(TECH_STACK): Still resolving — will be fully locked in first feature plan.
-->

# SkyTalk AI Constitution

## Prime Directive

The goal of SkyTalk AI is to **humanize meteorological data**. Every response, every
animation, and every UI element MUST bridge the gap between raw weather numbers and
human lived experience. If a feature makes weather feel more technical and less
relatable, it is a failure — regardless of its technical correctness.

This directive supersedes all other considerations when trade-offs arise between
engineering convenience and user experience.

## Core Engineering Principles

### I. Client-Server Separation

The application MUST maintain a strict boundary between client and server.
The server MUST expose all functionality through a typed tRPC router; the client
MUST NOT contain business logic or data-fetching outside of its tRPC hooks and
service layer. The tRPC router definition IS the contract — no separate hand-written
API documentation is required or permitted as a substitute.

AI logic, weather API calls, and location resolution MUST remain entirely server-side.

**Rationale**: Enables independent development and testing of each tier. tRPC makes
the contract enforced by the compiler rather than by documentation discipline.

### II. Real-Time First

Weather data delivery to clients MUST use a push or streaming mechanism (tRPC
subscriptions over WebSocket) rather than polling. Fallback to HTTP is permitted only
for the health check endpoint.
All chat messages MUST be delivered with sub-second perceived latency on a local
network.

**Rationale**: "Chat" implies real-time UX expectations. Polling adds complexity
without delivering the responsiveness the product requires.

### III. Test-Driven Development (NON-NEGOTIABLE)

Tests MUST be written before implementation code. The Red-Green-Refactor cycle is
mandatory:

1. Write a failing test that captures the requirement.
2. Confirm it fails for the right reason.
3. Implement the minimum code to make it pass.
4. Refactor under green.

Unit tests MUST cover all service-layer logic. Integration tests MUST cover the
external weather API boundary and the tRPC procedure contracts. No feature is
considered complete without passing tests.

**Rationale**: Tests provide demonstrable proof of correctness and prevent regressions
during rapid iteration.

### IV. Simplicity & Spec-Driven Evolution

Every design decision MUST start from the simplest viable implementation.
Abstractions, additional dependencies, and generalized solutions MUST be justified by
a concrete current need — not anticipated future requirements.
Maximum of two server-side services (weather service, AI orchestration) unless a
third is explicitly required by an approved feature spec.

Manual type-mirroring between client and server is PROHIBITED — tRPC inferred types
are the single source of truth (see Principle VI).

No code MAY be written without alignment to either an approved spec or a clear
constitution principle. We build intentionally, not impulsively.

**Rationale**: The Prime Directive is best served by readable, deliberate code.
Premature complexity obscures intent and slows iteration.

### V. Observability & Resilient Orchestration

The server MUST emit structured logs (JSON format) for every inbound tRPC procedure
call, outbound weather API call, and error condition. Log entries MUST include:
timestamp, level, correlation ID, and a human-readable message.

The bridge between the AI model and the weather data provider MUST handle failures
gracefully: if the weather service is unavailable, the AI MUST communicate the issue
conversationally without breaking the chat session or surfacing technical error details.

The client MUST surface user-visible errors as friendly, actionable messages — never
raw stack traces, tRPC error codes, or HTTP status codes.

**Rationale**: Debuggability is a first-class concern. Graceful failure is a
first-class concern for UX — a broken weather lookup MUST NOT feel like a broken
product.

### VI. End-to-End Type Safety (NON-NEGOTIABLE)

The client-server API contract MUST be expressed as TypeScript types inferred from
the tRPC router. Specifically:

- The tRPC `AppRouter` type MUST be the single source of truth for all procedure
  input shapes, output shapes, and subscription event payloads.
- The client MUST import `AppRouter` as a type-only import from the server — no
  manual type duplication permitted.
- Any drift between client expectations and server procedure definitions MUST surface
  as a TypeScript compile error — never as a runtime failure.
- Adding, removing, or changing a procedure signature MUST cause the client to fail
  compilation until updated — this is a feature, not a burden.

**Rationale**: Manual type synchronization between tiers is a persistent source of
bugs that are only discovered at runtime. Compiler-enforced contracts eliminate this
class of defect entirely and provide living documentation of the API surface.

## Design & Usability

### Atmospheric Immersion

The chat interface is a **window into the weather**, not a text box with a background
color. All decorative visual elements (sun, clouds, rain, lightning, rainbows) MUST be
high-quality and smooth. Motion MUST feel natural and "airy" — transitions should
evoke the actual pace of weather phenomena, never jarring or mechanical.

The UI theme MUST update to reflect the current weather conditions before the user
finishes reading the AI's response. Visual confirmation of the weather state is a
primary communication channel, not a secondary decoration.

### Clarity Over Density

Users MUST be able to understand the current weather state at a glance from the UI
theme alone, before reading any text. Information density in AI responses MUST be
calibrated to the user's question — a simple "will it rain?" MUST NOT trigger a
multi-paragraph data dump.

### Delight in Waiting

Loading states are core brand touchpoints, not fillers. When the system is fetching
data or generating a response, a weather-themed animation MUST be displayed. These
animations MUST be lightweight enough not to impede chat performance or drain device
resources (see Principle IV).

## Conversational Standards

### Empathetic Accuracy

AI responses MUST translate raw meteorological data into human-relevant language.
A response MUST NOT state only "20% chance of rain" — it MUST interpret: "There's
a slight chance of a shower, so maybe keep an umbrella in the car just in case."
Accuracy and empathy are not in tension; both are required.

### Contextual Relevance

Recommendations MUST be actionable and specific to the user's stated intent.
If a user asks about a BBQ, the response MUST assess suitability for a BBQ — not
just recite temperature. Generic forecasts are permitted only when no activity context
is present.

### Tone of Voice

The AI MUST communicate in a tone that is friendly, professional, and observant —
like a knowledgeable neighbor who happens to be a meteorologist. The tone MUST remain
consistent regardless of whether the weather is pleasant or severe.

**Exception**: In extreme weather events (see Ethical & Safety Standards), safety
language takes precedence over conversational warmth.

## Ethical & Safety Standards

### Safety First in Extreme Conditions

When responding to queries involving hurricanes, tornadoes, flash floods, or other
life-threatening weather events, the AI MUST prioritize and prominently include
official government or emergency-management alerts and safety directives. Friendly
banter MUST be suspended; the response MUST be direct, clear, and safety-focused.

### Privacy by Design

User location data is sensitive personal information. It MUST be used only to fetch
weather data for the current session and MUST NOT be persisted beyond the session
boundary. Location data MUST NOT appear in INFO-level or higher structured logs.
No location history is retained server-side in v1.

## Technical Stack

- **Architecture**: Client/Server web application (`client/` + `server/` at repo root)
- **API Layer**: tRPC v11 — typed procedures (queries, mutations, subscriptions)
- **Transport**: tRPC WebSocket adapter for subscriptions; HTTP for health query
- **Server**: Node.js 20 LTS, Express, `@trpc/server`, LangChain (`@langchain/anthropic`,
  `@langchain/core`, `langchain`), Axios, pino, Zod
- **Client**: React 18, Vite, `@trpc/react-query`, `@tanstack/react-query`, pure CSS
- **External Data**: OpenWeatherMap API (free tier)
- **AI Model**: Claude (`claude-sonnet-4-6`) via Anthropic SDK with tool use
- **Testing**: Jest + `@trpc/server` test helpers (server); Vitest + RTL (client)
- **Environment Config**: All secrets via environment variables; never hardcoded

## Development Workflow

- All work MUST branch from `main`; branches named `###-feature-name`.
- A feature is shippable only when: spec approved → tests green → no linting errors
  → TypeScript compilation passes with zero errors on both client and server.
- The `/speckit.plan` Constitution Check gate MUST be completed before Phase 0
  research begins. The check MUST validate against all sections of this constitution,
  including Principle VI (type safety).
- Breaking changes to any tRPC procedure signature (input, output, or subscription
  event shape) MUST be treated as a breaking API change and require a spec amendment.
- Complexity exceptions MUST be recorded in the plan's Complexity Tracking table with
  justification referencing the Prime Directive.

## Governance

This constitution supersedes all other informal practices and ad-hoc decisions.
Amendments require:

1. A documented rationale (why the existing principle is insufficient).
2. A version bump following semantic versioning:
   - **MAJOR**: Principle removed, redefined, or governance restructured.
   - **MINOR**: New principle or section added; material guidance expansion.
   - **PATCH**: Clarifications, wording, typo fixes.
3. Propagation to all dependent plans before the amendment is considered ratified.

All feature plans MUST include a Constitution Check table verifying compliance with
all active principles. Violations MUST be justified in the Complexity Tracking table
or the feature MUST be revised.

**Version**: 1.2.0 | **Ratified**: 2026-03-21 | **Last Amended**: 2026-03-21
