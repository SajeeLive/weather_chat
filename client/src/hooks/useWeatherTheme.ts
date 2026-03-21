import { useEffect, useState } from 'react';
import type { WeatherCondition, WeatherTheme } from '../types';

export function useWeatherTheme(condition: WeatherCondition | null): WeatherTheme {
  const [theme, setTheme] = useState<WeatherTheme>('neutral');

  useEffect(() => {
    const next: WeatherTheme = condition ?? 'neutral';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  }, [condition]);

  return theme;
}
