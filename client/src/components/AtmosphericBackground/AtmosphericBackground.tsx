import type { WeatherTheme } from '../../types';

interface AtmosphericBackgroundProps {
  theme: WeatherTheme;
}

export function AtmosphericBackground({ theme }: AtmosphericBackgroundProps) {
  return (
    <div className="atmospheric-bg" aria-hidden="true">
      {theme === 'sunny' && (
        <div className="sun" />
      )}
      {theme === 'cloudy' && (
        <>
          <div className="cloud" />
          <div className="cloud" />
          <div className="cloud" />
        </>
      )}
      {theme === 'rainy' && (
        <>
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              className="raindrop"
              style={{
                left: `${(i * 5.1) % 100}%`,
                top: `${(i * 7.3) % 40}%`,
                animationDelay: `${(i * 0.07) % 1.2}s`,
                animationDuration: `${0.9 + (i % 4) * 0.15}s`,
              }}
            />
          ))}
        </>
      )}
      {theme === 'stormy' && (
        <>
          <div className="cloud-dark" />
          <div className="cloud-dark" />
          <div className="bolt" />
        </>
      )}
    </div>
  );
}
