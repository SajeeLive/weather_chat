import axios from 'axios';
import { logger } from '../middleware/logger.js';
import type { WeatherContext, ForecastDay, WeatherCondition, Location, LocationCandidate } from '../types/index.js';
import { WeatherServiceError } from '../types/index.js';

const OWM_BASE = 'https://api.openweathermap.org';

function apiKey(): string {
  const key = process.env['OPENWEATHERMAP_API_KEY'];
  if (!key) throw new WeatherServiceError('Weather service is not configured.', false);
  return key;
}

// ─── Condition Mapper ─────────────────────────────────────────────────────

export function mapOwmCondition(main: string): WeatherCondition {
  switch (main) {
    case 'Clear':       return 'sunny';
    case 'Clouds':      return 'cloudy';
    case 'Rain':
    case 'Drizzle':     return 'rainy';
    case 'Thunderstorm': return 'stormy';
    default:            return 'cloudy';
  }
}

// ─── Nickname Map ─────────────────────────────────────────────────────────

const nicknameMap: Record<string, string> = {
  'big apple':       'New York',
  'windy city':      'Chicago',
  'city of angels':  'Los Angeles',
  'la':              'Los Angeles',
  'nyc':             'New York',
  'big easy':        'New Orleans',
  'motor city':      'Detroit',
  'emerald city':    'Seattle',
  'mile high city':  'Denver',
  'sin city':        'Las Vegas',
  'ciudad de mexico': 'Mexico City',
  'cdmx':            'Mexico City',
  'the big smoke':   'London',
  'auld reekie':     'Edinburgh',
};

export function resolveNickname(input: string): string {
  const lower = input.toLowerCase().trim();
  for (const [nickname, canonical] of Object.entries(nicknameMap)) {
    if (lower.includes(nickname)) {
      return canonical;
    }
  }
  return input;
}

// ─── Geocoding ────────────────────────────────────────────────────────────

export async function geocodeCity(city: string): Promise<Location | LocationCandidate[]> {
  const start = Date.now();
  try {
    logger.info({ event: 'weather_api_call', endpoint: 'geo/direct' }, 'Geocoding city');
    const { data } = await axios.get(`${OWM_BASE}/geo/1.0/direct`, {
      params: { q: city, limit: 5, appid: apiKey() },
    });

    const results: Array<{ name: string; country: string; state?: string; lat: number; lon: number }> = data;
    logger.info({ event: 'weather_api_call', endpoint: 'geo/direct', durationMs: Date.now() - start }, 'Geocoding complete');

    if (results.length === 0) {
      throw new WeatherServiceError(`I couldn't find a location called "${city}". Try a different city name.`, false);
    }

    if (results.length === 1) {
      const r = results[0]!;
      const displayName = r.state ? `${r.name}, ${r.state}, ${r.country}` : `${r.name}, ${r.country}`;
      return { displayName, city: r.name, countryCode: r.country, lat: r.lat, lon: r.lon };
    }

    // Multiple candidates — return for disambiguation
    return results.map((r) => ({
      displayName: r.state ? `${r.name}, ${r.state}, ${r.country}` : `${r.name}, ${r.country}`,
      lat: r.lat,
      lon: r.lon,
    }));
  } catch (err) {
    if (err instanceof WeatherServiceError) throw err;
    logger.error({ err, event: 'weather_api_error', endpoint: 'geo/direct' }, 'Geocoding failed');
    throw new WeatherServiceError('Unable to look up that location right now. Please try again in a moment.', true);
  }
}

// ─── Current Weather ──────────────────────────────────────────────────────

export async function getCurrent(city: string): Promise<WeatherContext> {
  const start = Date.now();
  try {
    logger.info({ event: 'weather_api_call', endpoint: 'weather' }, 'Fetching current weather');
    const { data } = await axios.get(`${OWM_BASE}/data/2.5/weather`, {
      params: { q: city, units: 'metric', appid: apiKey() },
    });
    logger.info({ event: 'weather_api_call', endpoint: 'weather', durationMs: Date.now() - start }, 'Current weather fetched');

    return {
      condition: mapOwmCondition(data.weather[0].main),
      location: data.name + (data.sys?.country ? `, ${data.sys.country}` : ''),
      temperatureCelsius: data.main.temp,
      feelsLikeCelsius: data.main.feels_like,
      humidity: data.main.humidity,
      windKph: data.wind.speed * 3.6,
      precipitationProbability: 0,
    };
  } catch (err) {
    if (err instanceof WeatherServiceError) throw err;
    logger.error({ err, event: 'weather_api_error', endpoint: 'weather' }, 'Current weather fetch failed');
    throw new WeatherServiceError('The weather service is temporarily unavailable. Please try again shortly.', true);
  }
}

// ─── Forecast ─────────────────────────────────────────────────────────────

export async function getForecast(city: string, days: number): Promise<ForecastDay[]> {
  const start = Date.now();
  try {
    logger.info({ event: 'weather_api_call', endpoint: 'forecast' }, 'Fetching forecast');
    // OWM free tier returns 3-hour slots for 5 days (40 slots total)
    const { data } = await axios.get(`${OWM_BASE}/data/2.5/forecast`, {
      params: { q: city, units: 'metric', cnt: Math.min(days, 5) * 8, appid: apiKey() },
    });
    logger.info({ event: 'weather_api_call', endpoint: 'forecast', durationMs: Date.now() - start }, 'Forecast fetched');

    // Aggregate 3-hour slots into daily summaries
    const byDay = new Map<string, Array<{ main: string; temp: number; pop: number }>>();
    for (const slot of data.list) {
      const date: string = slot.dt_txt.split(' ')[0];
      if (!byDay.has(date)) byDay.set(date, []);
      byDay.get(date)!.push({ main: slot.weather[0].main, temp: slot.main.temp, pop: slot.pop ?? 0 });
    }

    const forecastDays: ForecastDay[] = [];
    for (const [date, slots] of byDay.entries()) {
      if (forecastDays.length >= days) break;
      const temps = slots.map((s) => s.temp);
      const conditions = slots.map((s) => s.main);
      const pops = slots.map((s) => s.pop);
      // Most common condition wins
      const conditionCounts = conditions.reduce((acc, c) => ({ ...acc, [c]: (acc[c] ?? 0) + 1 }), {} as Record<string, number>);
      const dominantMain = Object.entries(conditionCounts).sort((a, b) => b[1] - a[1])[0]![0];

      forecastDays.push({
        date,
        condition: mapOwmCondition(dominantMain),
        highCelsius: Math.max(...temps),
        lowCelsius: Math.min(...temps),
        precipitationProbability: Math.max(...pops),
        summary: '',
      });
    }

    return forecastDays;
  } catch (err) {
    if (err instanceof WeatherServiceError) throw err;
    logger.error({ err, event: 'weather_api_error', endpoint: 'forecast' }, 'Forecast fetch failed');
    throw new WeatherServiceError('Unable to retrieve the forecast right now. Please try again.', true);
  }
}

// Export aliases used by the router
export { getCurrent as getWeatherCurrent, getForecast as getWeatherForecast };
