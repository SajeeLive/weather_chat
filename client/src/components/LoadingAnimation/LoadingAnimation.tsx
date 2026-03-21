import { useEffect, useState } from 'react';
import type { WeatherTheme } from '../../types';

interface LoadingAnimationProps {
  isLoading: boolean;
  theme: WeatherTheme;
}

export function LoadingAnimation({ isLoading, theme }: LoadingAnimationProps) {
  const [showReassurance, setShowReassurance] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowReassurance(false);
      return;
    }
    const timer = setTimeout(() => setShowReassurance(true), 5000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (!isLoading) return null;

  const animationClass = theme === 'sunny' ? 'sun'
    : theme === 'rainy' ? 'raindrop'
    : theme === 'stormy' ? 'bolt'
    : 'cloud';

  return (
    <div className="loading-animation" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px' }}>
      <div
        className={`loading-icon ${animationClass}-loading`}
        style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent, #607d8b)', animation: 'pulse 1.2s ease-in-out infinite' }}
        role="status"
        aria-label="Loading"
      />
      {showReassurance && (
        <span style={{ opacity: 0.7, fontSize: '14px', fontStyle: 'italic' }}>
          still thinking…
        </span>
      )}
    </div>
  );
}
