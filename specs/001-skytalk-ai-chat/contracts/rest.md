# REST Contract: SkyTalk AI

**Base URL**: `http://localhost:4000` (dev)
**Format**: JSON
**Auth**: None (open endpoints for demo/interview scope)

---

## GET /health

Returns server operational status. Used by the client on load to verify connectivity
before opening the WebSocket connection.

**Request**: No parameters.

**Response 200**:
```json
{
  "status": "ok",
  "timestamp": "2026-03-21T14:00:00Z"
}
```

**Response 503** (if a critical dependency is unavailable):
```json
{
  "status": "degraded",
  "timestamp": "2026-03-21T14:00:00Z"
}
```

**SLA**: Responds within 100ms under no load (SC-S-005).

---

> No other REST endpoints are defined. All conversational traffic uses the WebSocket
> contract defined in `websocket.md`.
