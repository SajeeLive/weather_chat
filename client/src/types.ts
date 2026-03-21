export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'neutral';

export type WeatherTheme = WeatherCondition;

export interface WeatherContext {
  condition: WeatherCondition;
  location: string;
  temperatureCelsius: number;
  feelsLikeCelsius: number;
  humidity: number;
  windKph: number;
  precipitationProbability: number;
}

export interface UIMessage {
  id: string;
  role: 'user' | 'ai' | 'error';
  text: string;
  timestamp: string;
  weatherContext?: WeatherContext;
}
