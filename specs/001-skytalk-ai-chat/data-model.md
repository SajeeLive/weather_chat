# Data Model: SkyTalk AI

**Feature**: 001-skytalk-ai-chat
**Date**: 2026-03-21

All entities below are in-memory only. No database. Session-scoped lifetime.

---

## WeatherCondition

A discriminated union of the five valid weather state categories. Used to drive the
client's visual theme.

```typescript
type WeatherCondition = "sunny" | "cloudy" | "rainy" | "stormy" | "neutral";
```

**Mapping from OpenWeatherMap `weather[0].main`**:

| OWM value | WeatherCondition |
|-----------|-----------------|
| Clear | sunny |
| Clouds | cloudy |
| Rain, Drizzle | rainy |
| Thunderstorm | stormy |
| Snow, Mist, Fog, Haze, Dust, Sand, Ash, Squall, Tornado | cloudy (v1 default) |

---

## WeatherContext

The resolved meteorological state for a given location and time. Emitted by the server
alongside every AI response. Drives the client's visual theme.

```typescript
interface WeatherContext {
  condition: WeatherCondition;
  location: string;              // Display name, e.g., "Boston, MA, US"
  temperatureCelsius: number;
  feelsLikeCelsius: number;
  humidity: number;              // Percentage 0–100
  windKph: number;
  precipitationProbability: number; // 0.0–1.0 (from forecast endpoint)
  uvIndex?: number;              // Optional — not in OWM free tier
  forecastDays?: ForecastDay[];  // Present for multi-day queries
}
```

---

## ForecastDay

A single day's forecast summary within a multi-day WeatherContext.

```typescript
interface ForecastDay {
  date: string;                  // ISO 8601 date, e.g., "2026-03-22"
  condition: WeatherCondition;
  highCelsius: number;
  lowCelsius: number;
  precipitationProbability: number;
  summary: string;               // Human-readable summary from AI, e.g., "Partly cloudy with light winds"
}
```

---

## Message

A single exchange unit in the conversation thread. Used on both server (session state)
and client (UI rendering).

```typescript
interface Message {
  id: string;                    // UUID v4
  role: "user" | "ai" | "error";
  text: string;
  timestamp: string;             // ISO 8601, e.g., "2026-03-21T14:30:00Z"
  weatherContext?: WeatherContext; // Present on "ai" role messages only
}
```

---

## Session (server-side only)

Represents an active WebSocket connection. Held in memory for the connection lifetime.

```typescript
interface Session {
  socketId: string;
  messages: Message[];           // Ordered conversation history
  lastResolvedLocation?: string; // Canonical city name from most recent query
  correlationId: string;         // UUID v4, used in all log entries for this session
}
```

---

## Location

An intermediate type used during location resolution before the weather API call.

```typescript
interface Location {
  displayName: string;           // Human-readable, e.g., "Springfield, IL, US"
  city: string;                  // Canonical city name passed to OWM
  countryCode?: string;          // ISO 3166-1 alpha-2, e.g., "US"
  lat: number;
  lon: number;
}

interface LocationCandidate {
  displayName: string;
  lat: number;
  lon: number;
}
```

Used when OWM geocoding returns multiple matches — `LocationCandidate[]` is sent to
the client as the `clarification_needed` payload.

---

## UIMessage (client-side only)

The client-side rendering representation of a message. Derived from `Message` with
display-specific additions.

```typescript
interface UIMessage {
  id: string;
  role: "user" | "ai" | "error";
  text: string;
  timestamp: Date;
  weatherContext?: WeatherContext;
  isNew: boolean;                // True briefly after arrival — triggers CSS entry animation
}
```

---

## WeatherTheme (client-side only)

The current visual state of the application. Derived from the most recent
`WeatherContext.condition`. Applied as a `data-theme` attribute on the root element.

```typescript
type WeatherTheme = WeatherCondition; // "sunny" | "cloudy" | "rainy" | "stormy" | "neutral"
```

---

## Entity Relationships

```text
Session (server)
  └── messages: Message[]
        └── weatherContext?: WeatherContext
              └── forecastDays?: ForecastDay[]

Client state
  ├── chatThread: UIMessage[]        (derived from incoming Message events)
  ├── currentTheme: WeatherTheme     (derived from latest WeatherContext.condition)
  └── isLoading: boolean
```
