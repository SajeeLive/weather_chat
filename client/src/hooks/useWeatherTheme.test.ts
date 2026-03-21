import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWeatherTheme } from './useWeatherTheme';
import type { WeatherCondition } from '../types';

describe('useWeatherTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('sets data-theme to neutral when condition is null', () => {
    renderHook(() => useWeatherTheme(null));
    expect(document.documentElement.getAttribute('data-theme')).toBe('neutral');
  });

  it('sets data-theme to sunny for sunny condition', () => {
    renderHook(() => useWeatherTheme('sunny'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('sunny');
  });

  it('sets data-theme to rainy for rainy condition', () => {
    renderHook(() => useWeatherTheme('rainy'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('rainy');
  });

  it('sets data-theme to stormy for stormy condition', () => {
    renderHook(() => useWeatherTheme('stormy'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('stormy');
  });

  it('updates data-theme when condition changes', () => {
    const { rerender } = renderHook(({ cond }) => useWeatherTheme(cond), {
      initialProps: { cond: 'sunny' as WeatherCondition },
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('sunny');
    act(() => { rerender({ cond: 'stormy' as WeatherCondition }); });
    expect(document.documentElement.getAttribute('data-theme')).toBe('stormy');
  });

  it('returns the current theme string', () => {
    const { result } = renderHook(() => useWeatherTheme('cloudy'));
    expect(result.current).toBe('cloudy');
  });
});
