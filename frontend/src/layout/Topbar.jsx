export default function Topbar({ title, subtitle, actions, isOperating, operatingMessage, elapsedTime, currentAction }) {
  const formatElapsedTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <header className="topbar">
      <div className="topbar-content">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="subtitle">{subtitle}</p> : null}
        </div>

        {actions || isOperating ? (
          <div className="topbar-actions">
            {isOperating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  className="spinner topbar-spinner"
                  title={operatingMessage || 'Operation in progress...'}
                ></span>
                {currentAction && (
                  <span style={{ fontSize: '0.9em', color: '#666' }}>
                    {currentAction} {formatElapsedTime(elapsedTime)}
                  </span>
                )}
              </div>
            )}
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
