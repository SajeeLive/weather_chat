---
description: "Task list for 003-skytalk-client implementation"
---

# Tasks: SkyTalk AI — Client Application

**Input**: Design documents from `/specs/003-skytalk-client/` and `/specs/001-skytalk-ai-chat/`
**Prerequisites**: plan.md ✅ spec.md ✅ data-model.md ✅ contracts/trpc-router.md ✅ research.md ✅

**TDD Note**: Constitution Principle III is non-negotiable — tests are written before
implementation within each user story phase. Tasks are ordered accordingly.

**Organization**: Tasks grouped by user story to enable independent implementation
and testing of each story.

---

## Phase 1: Setup

**Purpose**: Scaffold the Vite + React + TypeScript client project with correct structure and tooling.

- [x] T001 Scaffold Vite React TypeScript project in `client/` (`pnpm create vite client -- --template react-ts`)
- [x] T002 Install all runtime dependencies in `client/`: `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`
- [x] T003 [P] Install all dev dependencies in `client/`: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `msw`
- [x] T004 [P] Create `client/vitest.config.ts` (environment: jsdom; setupFiles; include: `src/**/*.test.tsx`)
- [x] T005 [P] Add npm scripts to `client/package.json` (dev: vite, build: tsc && vite build, test: vitest, lint: tsc --noEmit)
- [x] T006 Create directory structure: `client/src/components/ChatWindow/`, `client/src/components/MessageBubble/`, `client/src/components/ChatInput/`, `client/src/components/AtmosphericBackground/`, `client/src/components/LoadingAnimation/`, `client/src/hooks/`, `client/src/lib/`, `client/src/styles/`
- [x] T007 [P] Create `client/.env.example` with `VITE_SERVER_URL` and `VITE_SERVER_WS_URL`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure required before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T008 Create tRPC client singleton in `client/src/lib/trpc.ts` (`createTRPCReact<AppRouter>()` with `import type { AppRouter } from '../../../server/src/router'`)
- [x] T009 Create `client/src/App.tsx` — wrap tree with `QueryClientProvider` + `trpc.Provider`; configure `splitLink` routing subscriptions to `wsLink` (`VITE_SERVER_WS_URL`) and queries/mutations to `httpBatchLink` (`VITE_SERVER_URL`)
- [x] T010 [P] Create `client/src/main.tsx` — Vite entry point mounting `<App />` into `#root`
- [x] T011 [P] Create `client/src/styles/themes.css` — define `[data-theme]` CSS custom properties for all five themes (neutral, sunny, cloudy, rainy, stormy) with 0.8s `transition` on `html`; import in `main.tsx`
- [x] T012 Create `client/src/styles/animations.css` — define `@keyframes` stubs (`pulse`, `drift`, `fall`, `flicker`) used by decorative elements; import in `main.tsx`

**Checkpoint**: `pnpm dev` starts without errors; app renders with neutral theme at `localhost:5173`.

---

## Phase 3: User Story 1 — Submit a Query and Read the AI Response (P1) 🎯 MVP

**Goal**: A user types a weather question, submits it, sees a loading state, and reads
the AI response in a persistent scrollable chat thread.

**Independent Test**: Mock the tRPC `chatStream` subscription and `sendQuery` mutation
via MSW; assert the user message appears immediately, loading state activates, AI
response renders, and thread auto-scrolls.

> **TDD — Write tests first, confirm they fail, then implement.**

### Tests for User Story 1

- [x] T013 [P] [US1] Write component test for `ChatInput` in `client/src/components/ChatInput/ChatInput.test.tsx` (assert text input renders; Enter key calls onSubmit; empty/whitespace input does NOT call onSubmit; button disabled when empty)
- [x] T014 [P] [US1] Write component test for `MessageBubble` in `client/src/components/MessageBubble/MessageBubble.test.tsx` (assert user role renders right-aligned class; ai role renders left-aligned class; text content visible; timestamp rendered)
- [x] T015 [P] [US1] Write component test for `ChatWindow` in `client/src/components/ChatWindow/ChatWindow.test.tsx` (assert messages list renders in order; new message triggers scroll-to-bottom; empty state renders placeholder)
- [x] T016 [US1] Write integration test for full query → response flow in `client/tests/integration/chatFlow.test.tsx` (MSW mock emitting `loading` then `message` events; assert loading state appears then resolves; AI message in thread)

### Implementation for User Story 1

- [x] T017 [P] [US1] Implement `ChatInput` component in `client/src/components/ChatInput/ChatInput.tsx` (controlled text input; Enter key + Send button submit; prevent empty/whitespace submission; `onSubmit: (text: string) => void` prop)
- [x] T018 [P] [US1] Implement `MessageBubble` component in `client/src/components/MessageBubble/MessageBubble.tsx` (renders `UIMessage`; applies role-based CSS class `user` | `ai` | `error`; displays text and formatted timestamp)
- [x] T019 [US1] Implement `ChatWindow` component in `client/src/components/ChatWindow/ChatWindow.tsx` (scrollable thread; renders `MessageBubble` list; auto-scrolls to bottom on new message unless user has scrolled up; empty state placeholder)
- [x] T020 [US1] Implement `useChat` hook in `client/src/hooks/useChat.ts` (subscribe to `trpc.chatStream.useSubscription()`; call `trpc.sendQuery.useMutation()`; manage `messages: UIMessage[]` and `isLoading: boolean` state; append user message optimistically on submit; handle `loading`, `message` events)
- [x] T021 [US1] Wire `ChatWindow` + `ChatInput` + `useChat` into `client/src/App.tsx` layout (render chat thread + input bar; pass `useChat` state and handlers as props)

**Checkpoint**: Tests T013–T016 pass. Typing a query and pressing Enter shows the user message, loading indicator, then AI response.

---

## Phase 4: User Story 2 — Visual Weather Theme Matches the Described Conditions (P2)

**Goal**: When a `WeatherContext` arrives with the AI response, the app's visual theme
(background gradient, accent color, decorative element) updates smoothly to match the
weather condition.

**Independent Test**: Inject mock `WeatherContext` objects with each of the four
condition values; assert `data-theme` on `<html>` changes correctly and the correct
decorative element class is present for each theme.

> **TDD — Write tests first, confirm they fail, then implement.**

### Tests for User Story 2

- [x] T022 [P] [US2] Write unit test for `useWeatherTheme` in `client/src/hooks/useWeatherTheme.ts` area — test file at `client/src/hooks/useWeatherTheme.test.ts` (assert hook sets `data-theme` on `document.documentElement` for each `WeatherCondition`; assert neutral set on null input)
- [x] T023 [P] [US2] Write component test for `AtmosphericBackground` in `client/src/components/AtmosphericBackground/AtmosphericBackground.test.tsx` (assert `.sun` rendered for sunny; `.cloud` for cloudy; `.raindrop` for rainy; `.bolt` for stormy; no decorative element for neutral)

### Implementation for User Story 2

- [x] T024 [US2] Implement `useWeatherTheme` hook in `client/src/hooks/useWeatherTheme.ts` (accepts `WeatherCondition | null`; sets `document.documentElement.setAttribute('data-theme', condition ?? 'neutral')` on change; returns current theme string)
- [x] T025 [US2] Implement `AtmosphericBackground` component in `client/src/components/AtmosphericBackground/AtmosphericBackground.tsx` (renders decorative div elements conditionally based on `theme` prop: `.sun` for sunny; 2–3 `.cloud` divs for cloudy; multiple `.raindrop` spans for rainy; `.cloud-dark` + `.bolt` for stormy; empty for neutral)
- [x] T026 [US2] Expand `client/src/styles/themes.css` with full custom property sets for all five themes (`--bg-primary`, `--bg-secondary`, `--text-primary`, `--accent`, `--bubble-user-bg`, `--bubble-ai-bg`) and apply them to layout elements in App.tsx
- [x] T027 [US2] Integrate `useWeatherTheme` + `AtmosphericBackground` into `client/src/App.tsx` (call hook with `latestWeatherContext?.condition` from `useChat`; render `<AtmosphericBackground theme={currentTheme} />` behind chat layer)

**Checkpoint**: Tests T022–T023 pass. London query → sunny theme applied; Springfield → stormy theme. CSS transition visible between theme changes.

---

## Phase 5: User Story 3 — Weather-Themed Loading Animation (P3)

**Goal**: While the server processes a query, a weather-themed CSS animation plays in
the chat area. After 5 seconds it shows "still thinking…". It stops cleanly on response.

**Independent Test**: Render `LoadingAnimation` with `isLoading={true}` and `theme="sunny"`
in isolation; assert animation element renders; fast-forward 5 seconds with fake timers;
assert reassurance message appears; set `isLoading={false}` and assert animation unmounts.

> **TDD — Write tests first, confirm they fail, then implement.**

### Tests for User Story 3

- [x] T028 [P] [US3] Write component test for `LoadingAnimation` in `client/src/components/LoadingAnimation/LoadingAnimation.test.tsx` (assert not rendered when `isLoading={false}`; assert weather animation element present when `isLoading={true}`; fake timer advance 5s → assert "still thinking…" text appears; assert theme-consistent class applied)

### Implementation for User Story 3

- [x] T029 [US3] Expand `client/src/styles/animations.css` with full `@keyframes` definitions: `pulse` (scale 1→1.1→1 + opacity 1→0.8, for sun); `drift` (translateX -20px→20px, for clouds); `fall` (translateY -20px→100vh, for rain); `flicker` (opacity 1→0→1, for lightning bolt)
- [x] T030 [US3] Implement `LoadingAnimation` component in `client/src/components/LoadingAnimation/LoadingAnimation.tsx` (renders `null` when `isLoading={false}`; renders a theme-appropriate animated element using CSS animation classes; uses `setTimeout` of 5000ms to show "still thinking…" message; clears timer on unmount)
- [x] T031 [US3] Integrate `LoadingAnimation` into `client/src/App.tsx` chat area (render `<LoadingAnimation isLoading={isLoading} theme={currentTheme} />` between last message and input bar)

**Checkpoint**: Test T028 passes. Submit a query; themed animation plays; after 5s "still thinking…" message appears; response arrives and animation disappears without flash.

---

## Phase 6: User Story 4 — Server Error Displayed as a Conversational Message (P4)

**Goal**: When the server emits an `error` event, it renders in the chat thread as a
soft, friendly message. The input remains enabled. No raw error codes are shown.

**Independent Test**: Inject a mock `error` event via MSW with `{ message: "...", retryable: true }`;
assert an in-thread message with `role="error"` appears; assert `ChatInput` is not disabled;
assert no HTTP status codes or stack traces in rendered text.

> **TDD — Write tests first, confirm they fail, then implement.**

### Tests for User Story 4

- [x] T032 [P] [US4] Write component test for error rendering in `client/src/components/MessageBubble/MessageBubble.test.tsx` (assert `role="error"` message renders `.bubble-error` class; assert friendly text visible; assert no raw error syntax)
- [x] T033 [US4] Write integration test for error event flow in `client/tests/integration/chatFlow.test.tsx` (MSW mock emitting `error` event; assert error message appears in thread; assert input remains enabled and accepts a follow-up query)

### Implementation for User Story 4

- [x] T034 [US4] Add `error` event handling to `useChat` hook in `client/src/hooks/useChat.ts` (on `{ type: 'error' }` event: append `UIMessage` with `role: 'error'`, display the `payload.message` string, clear `isLoading`; keep `isLoading: false` so input stays enabled)
- [x] T035 [US4] Add error role styling to `client/src/styles/themes.css` — `.bubble-error` class: muted warning color, italic text, left-aligned; consistent with all five themes (use `--accent` fallback)
- [x] T036 [US4] Verify `MessageBubble` in `client/src/components/MessageBubble/MessageBubble.tsx` applies `.bubble-error` class for `role="error"` (extend existing role-based class logic — additive change only)

**Checkpoint**: Tests T032–T033 pass. OWM failure or AI unavailability shows a friendly in-thread message; user can type a follow-up query immediately.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening across all user stories.

- [x] T037 [P] Add `@vitejs/plugin-react` and configure `client/vite.config.ts` (include `path` alias for `@/` → `src/`; set `test.environment: 'jsdom'`; set `test.setupFiles`)
- [x] T038 [P] Add ESLint + `@typescript-eslint` and `eslint-plugin-react-hooks` in `client/.eslintrc.json` (no-any; exhaustive-deps; explicit return types on hooks)
- [x] T039 [P] Add `client/src/setupTests.ts` with `@testing-library/jest-dom` matchers for Vitest (import in `vitest.config.ts` setupFiles)
- [ ] T040 Validate end-to-end against the smoke test in `specs/001-skytalk-ai-chat/quickstart.md` (client half: start server + client; submit "What's the weather in London?"; verify theme changes; verify loading animation; submit "Springfield"; verify clarification options render)
- [x] T041 [P] Confirm TypeScript compilation passes with zero errors (`tsc --noEmit` in `client/`) — required for `AppRouter` type-only import to resolve correctly against server source

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — blocks all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — this is MVP; implement first
- **US2 (Phase 4)**: Depends on Phase 2; extends `useChat` with `WeatherContext` (additive only)
- **US3 (Phase 5)**: Depends on Phase 2; requires `currentTheme` from US2 for theme-consistent animation (implement after US2)
- **US4 (Phase 6)**: Depends on Phase 2; extends `useChat` error handling (additive only; can be done after US1)
- **Polish (Phase 7)**: Depends on all stories complete

### Within Each User Story

1. Tests written first → confirmed failing
2. Components implemented (leaf components before composites)
3. Hooks implemented (depend on tRPC client)
4. Wiring into App.tsx
5. Tests confirmed passing
6. Checkpoint validated

### Parallel Opportunities

```bash
# Phase 3 — run in parallel:
Task: "Write component test for ChatInput"       # T013
Task: "Write component test for MessageBubble"   # T014
Task: "Write component test for ChatWindow"      # T015
# Then in parallel:
Task: "Implement ChatInput component"            # T017
Task: "Implement MessageBubble component"        # T018

# Phase 4 — run in parallel:
Task: "Write unit test for useWeatherTheme"      # T022
Task: "Write component test for AtmosphericBackground" # T023
# Then in parallel:
Task: "Implement useWeatherTheme hook"           # T024
Task: "Implement AtmosphericBackground component" # T025
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (tests → components → hooks → wiring)
4. **STOP and VALIDATE**: Submit a real query; confirm message thread works, loading resolves, AI response renders

### Incremental Delivery

1. Setup + Foundational → Vite dev server starts cleanly
2. US1 → working query/response chat loop (MVP — demonstrable)
3. US2 → dynamic weather themes + atmospheric decorative elements
4. US3 → weather-themed loading animation with reassurance message
5. US4 → graceful in-thread error messages
6. Polish → lint, type check, smoke test

---

## Notes

- `[P]` = parallelizable — different files, no unresolved dependencies
- `[US?]` maps each task to its user story for traceability
- Every test task precedes its implementation tasks within the same story
- The `AppRouter` type import (T008) MUST point to the live server source — not a copy
- CSS animations MUST use only `transform` and `opacity` — no layout-triggering properties
- `data-theme` attribute is set on `document.documentElement` (`<html>`) — NOT a class
- `isLoading` is the single source of truth for disabling/hiding input and showing animation
- Error messages displayed in the thread MUST use plain language — validate against each server error type
