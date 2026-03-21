import { useEffect, useState } from 'react';
import type { WeatherTheme } from '../../types';

interface LoadingAnimationProps {
  isLoading: boolean;
  theme: WeatherTheme;
}

export function LoadingAnimation({ isLoading, theme: _theme }: LoadingAnimationProps) {
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

  return (
    <div className="loading-animation" role="status" aria-label="Loading response">
      <div className="loading-dots">
        <div className="loading-dot" />
        <div className="loading-dot" />
        <div className="loading-dot" />
      </div>
      {showReassurance && (
        <span className="loading-label">still thinking…</span>
      )}
    </div>
  );
}
