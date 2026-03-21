// ─── Weather Domain ────────────────────────────────────────────────────────

export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'neutral';

export interface ForecastDay {
  date: string;                       // ISO 8601, e.g. "2026-03-22"
  condition: WeatherCondition;
  highCelsius: number;
  lowCelsius: number;
  precipitationProbability: number;   // 0.0–1.0
  summary: string;
}

export interface WeatherContext {
  condition: WeatherCondition;
  location: string;                   // Display name, e.g. "Boston, MA, US"
  temperatureCelsius: number;
  feelsLikeCelsius: number;
  humidity: number;                   // 0–100
  windKph: number;
  precipitationProbability: number;   // 0.0–1.0
  uvIndex?: number;
  forecastDays?: ForecastDay[];
}

// ─── Location Resolution ──────────────────────────────────────────────────

export interface Location {
  displayName: string;
  city: string;
  countryCode?: string;
  lat: number;
  lon: number;
}

export interface LocationCandidate {
  displayName: string;
  lat: number;
  lon: number;
}

// ─── Chat / Session ────────────────────────────────────────────────────────

export interface Message {
  id: string;                         // UUID v4
  role: 'user' | 'ai' | 'error';
  text: string;
  timestamp: string;                  // ISO 8601
  weatherContext?: WeatherContext;
}

export interface Session {
  socketId: string;
  messages: Message[];
  lastResolvedLocation?: Location;
  lastQuery?: string;
  correlationId: string;              // UUID v4 — used in all log entries
  emit: (event: ChatEvent) => void;   // Bound to the observable emit for this session
}

// ─── tRPC Event Stream ────────────────────────────────────────────────────

export interface MessagePayload {
  id: string;
  role: 'ai';
  text: string;
  timestamp: string;
  weatherContext: WeatherContext;
}

export interface ClarificationPayload {
  question: string;
  candidates: LocationCandidate[];
  originalQuery: string;
}

export interface ErrorPayload {
  message: string;
  retryable: boolean;
}

export type ChatEvent =
  | { type: 'loading' }
  | { type: 'message'; payload: MessagePayload }
  | { type: 'clarification_needed'; payload: ClarificationPayload }
  | { type: 'error'; payload: ErrorPayload };

// ─── tRPC Input Types ─────────────────────────────────────────────────────

export interface SelectLocationInput {
  displayName: string;
  lat: number;
  lon: number;
  originalQuery: string;
}

// ─── Health ───────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
}

// ─── Service Errors ───────────────────────────────────────────────────────

export class WeatherServiceError extends Error {
  public readonly retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.name = 'WeatherServiceError';
    this.retryable = retryable;
  }
}

export class AIServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class ClarificationNeededError extends Error {
  public readonly candidates: LocationCandidate[];
  public readonly originalQuery: string;
  constructor(candidates: LocationCandidate[], originalQuery: string) {
    super('Clarification needed — multiple locations matched');
    this.name = 'ClarificationNeededError';
    this.candidates = candidates;
    this.originalQuery = originalQuery;
  }
}
