import { useEffect, useState } from 'react';

export default function Banner({ banner }) {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (!banner || !banner.message) return;

    // Don't auto-fade if there's a progress indicator
    if (banner.progress) return;

    // Error messages stay visible longer (8 seconds), others fade after 4 seconds
    const fadeDuration = banner.type === 'error' ? 8000 : 4000;
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, fadeDuration);

    return () => clearTimeout(fadeTimer);
  }, [banner?.message, banner?.progress, banner?.type]);

  // Reset fading state when banner message changes
  useEffect(() => {
    setIsFading(false);
  }, [banner?.message]);

  if (!banner || !banner.message) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  const progressPercentage = banner.progress?.percentage || 0;

  return (
    <div className={`banner ${isFading ? 'banner-fading' : ''}`}>
      <div className="banner-icon" data-type={banner.type}>
        {getIcon(banner.type)}
      </div>
      <div className="banner-content">
        <div>{banner.message}</div>
        {banner.progress && (
          <div className="banner-progress-bar">
            <div
              className="banner-progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
            <span className="banner-progress-text">{progressPercentage}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
