import axios from 'axios';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

// Set env vars before importing the service
process.env['OPENWEATHERMAP_API_KEY'] = 'test-key';

import {
  getCurrent,
  getForecast,
  mapOwmCondition,
  resolveNickname,
  geocodeCity,
} from '../../src/services/weatherService';
import { WeatherServiceError } from '../../src/types/index';

// ─── mapOwmCondition ──────────────────────────────────────────────────────

describe('mapOwmCondition', () => {
  it('maps "Clear" to "sunny"', () => {
    expect(mapOwmCondition('Clear')).toBe('sunny');
  });
  it('maps "Clouds" to "cloudy"', () => {
    expect(mapOwmCondition('Clouds')).toBe('cloudy');
  });
  it('maps "Rain" to "rainy"', () => {
    expect(mapOwmCondition('Rain')).toBe('rainy');
  });
  it('maps "Drizzle" to "rainy"', () => {
    expect(mapOwmCondition('Drizzle')).toBe('rainy');
  });
  it('maps "Thunderstorm" to "stormy"', () => {
    expect(mapOwmCondition('Thunderstorm')).toBe('stormy');
  });
  it('maps unknown values to "cloudy"', () => {
    expect(mapOwmCondition('Snow')).toBe('cloudy');
    expect(mapOwmCondition('Mist')).toBe('cloudy');
    expect(mapOwmCondition('Squall')).toBe('cloudy');
  });
});

// ─── getCurrent ───────────────────────────────────────────────────────────

describe('getCurrent', () => {
  it('returns a WeatherContext with the correct shape for a valid city', async () => {
    mockAxios.get.mockResolvedValueOnce({
      data: {
        name: 'London',
        sys: { country: 'GB' },
        weather: [{ main: 'Clouds' }],
        main: { temp: 15.5, feels_like: 13.0, humidity: 72 },
        wind: { speed: 5.0 },
      },
    });

    const result = await getCurrent('London');

    expect(result).toMatchObject({
      condition: 'cloudy',
      location: 'London, GB',
      temperatureCelsius: 15.5,
      feelsLikeCelsius: 13.0,
      humidity: 72,
      windKph: expect.any(Number),
      precipitationProbability: 0,
    });
    expect(result.windKph).toBeCloseTo(18, 0); // 5 m/s * 3.6 = 18 kph
  });

  it('throws WeatherServiceError when axios fails', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('network error'));

    await expect(getCurrent('Nowhere')).rejects.toBeInstanceOf(WeatherServiceError);
  });

  it('throws WeatherServiceError with retryable: true on network failure', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('timeout'));

    try {
      await getCurrent('Nowhere');
    } catch (err) {
      expect((err as WeatherServiceError).retryable).toBe(true);
    }
  });
});

// ─── getForecast ──────────────────────────────────────────────────────────

describe('getForecast', () => {
  const mockForecastData = {
    list: [
      { dt_txt: '2026-03-22 12:00:00', weather: [{ main: 'Rain' }], main: { temp: 12 }, pop: 0.8 },
      { dt_txt: '2026-03-22 15:00:00', weather: [{ main: 'Rain' }], main: { temp: 11 }, pop: 0.9 },
      { dt_txt: '2026-03-23 12:00:00', weather: [{ main: 'Clear' }], main: { temp: 18 }, pop: 0.1 },
      { dt_txt: '2026-03-23 15:00:00', weather: [{ main: 'Clear' }], main: { temp: 20 }, pop: 0.0 },
    ],
  };

  it('returns ForecastDay[] with correct shape', async () => {
    mockAxios.get.mockResolvedValueOnce({ data: mockForecastData });

    const result = await getForecast('London', 2);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      date: '2026-03-22',
      condition: 'rainy',
      highCelsius: 12,
      lowCelsius: 11,
      precipitationProbability: 0.9,
    });
    expect(result[1]).toMatchObject({
      date: '2026-03-23',
      condition: 'sunny',
      highCelsius: 20,
      lowCelsius: 18,
      precipitationProbability: 0.1,
    });
  });

  it('throws WeatherServiceError when axios fails', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('network error'));
    await expect(getForecast('Nowhere', 3)).rejects.toBeInstanceOf(WeatherServiceError);
  });
});

// ─── resolveNickname ──────────────────────────────────────────────────────

describe('resolveNickname', () => {
  it('resolves "big apple" to "New York"', () => {
    expect(resolveNickname('weather in the big apple')).toBe('New York');
  });
  it('resolves "windy city" to "Chicago"', () => {
    expect(resolveNickname('windy city forecast')).toBe('Chicago');
  });
  it('resolves "ciudad de mexico" to "Mexico City"', () => {
    expect(resolveNickname('ciudad de mexico')).toBe('Mexico City');
  });
  it('passes through unrecognized city names unchanged', () => {
    expect(resolveNickname('Springfield')).toBe('Springfield');
    expect(resolveNickname('London')).toBe('London');
  });
});

// ─── geocodeCity ──────────────────────────────────────────────────────────

describe('geocodeCity', () => {
  it('returns a single Location when OWM returns 1 result', async () => {
    mockAxios.get.mockResolvedValueOnce({
      data: [{ name: 'London', country: 'GB', state: undefined, lat: 51.51, lon: -0.12 }],
    });

    const result = await geocodeCity('London');

    expect(Array.isArray(result)).toBe(false);
    const loc = result as { displayName: string; lat: number; lon: number };
    expect(loc.displayName).toBe('London, GB');
    expect(loc.lat).toBe(51.51);
  });

  it('returns LocationCandidate[] when OWM returns multiple results', async () => {
    mockAxios.get.mockResolvedValueOnce({
      data: [
        { name: 'Springfield', country: 'US', state: 'Illinois', lat: 39.8, lon: -89.6 },
        { name: 'Springfield', country: 'US', state: 'Missouri', lat: 37.2, lon: -93.3 },
        { name: 'Springfield', country: 'US', state: 'Massachusetts', lat: 42.1, lon: -72.5 },
      ],
    });

    const result = await geocodeCity('Springfield');

    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(3);
  });

  it('throws WeatherServiceError with retryable: false when no results found', async () => {
    mockAxios.get.mockResolvedValueOnce({ data: [] });

    try {
      await geocodeCity('Xyzzyville');
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(WeatherServiceError);
      expect((err as WeatherServiceError).retryable).toBe(false);
    }
  });
});
