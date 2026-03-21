# Quickstart: SkyTalk AI Development Setup

**Date**: 2026-03-21
**Branches**: 002-skytalk-server (server) | 003-skytalk-client (client)

---

## Prerequisites

- Node.js 20 LTS (`node --version` should print `v20.x.x`)
- pnpm 9+ — install with `npm install -g pnpm` or `corepack enable pnpm`
- An OpenWeatherMap API key (free tier) — sign up at openweathermap.org
- An Anthropic API key — available at console.anthropic.com

---

## 1. Server Setup

```bash
cd server
pnpm install
cp .env.example .env
```

Edit `.env`:
```
PORT=4000
OPENWEATHERMAP_API_KEY=your_owm_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

Start dev server (with hot reload):
```bash
pnpm dev
```

Verify:
```bash
curl http://localhost:4000/health
# Expected: {"status":"ok","timestamp":"..."}
```

Run server tests:
```bash
pnpm test
```

---

## 2. Client Setup

In a separate terminal:

```bash
cd client
pnpm install
cp .env.example .env
```

Edit `.env`:
```
VITE_SERVER_URL=http://localhost:4000
VITE_SERVER_WS_URL=ws://localhost:4000
```

Start dev client:
```bash
pnpm dev
```

Open `http://localhost:5173` in your browser.

Run client tests:
```bash
pnpm test
```

---

## 3. Smoke Test

With both server and client running:

1. Open `http://localhost:5173`
2. Type: `What's the weather like in London today?`
3. Press Enter or click Send
4. **Expected**:
   - Loading animation appears immediately
   - Within 8 seconds, an AI response appears describing London's weather
   - The UI background/theme shifts to match the weather condition
   - The loading animation stops cleanly

5. Type: `What about in Springfield?`
6. **Expected**: A clarification prompt appears asking which Springfield

7. Type: `Will it storm in Miami this weekend?`
8. **Expected**: Theme shifts to stormy; response describes weekend storm risk

---

## 4. Environment Variables Reference

### Server (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default: 4000) | HTTP/WebSocket server port |
| `OPENWEATHERMAP_API_KEY` | Yes | OWM free tier API key |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude API key |
| `LOG_LEVEL` | No (default: info) | pino log level: trace, debug, info, warn, error |

### Client (`client/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SERVER_URL` | Yes | Full HTTP URL to the SkyTalk server, e.g., `http://localhost:4000` |
| `VITE_SERVER_WS_URL` | Yes | Full WebSocket URL to the SkyTalk server, e.g., `ws://localhost:4000` |

---

## 5. Common Issues

**"I couldn't reach the weather service"**: Check `OPENWEATHERMAP_API_KEY` is set
correctly and the OWM API is reachable (`curl "https://api.openweathermap.org/data/2.5/weather?q=London&appid=YOUR_KEY"`).

**WebSocket connection refused**: Confirm the server is running on port 4000 and
`VITE_SERVER_WS_URL` matches.

**No theme change**: Open browser DevTools → Elements → check that `data-theme`
attribute on `<html>` is changing when AI responses arrive.

**Animations not running**: Confirm browser does not have "Reduce motion" accessibility
setting enabled — CSS animations respect `prefers-reduced-motion`.
