export default function PeriodActionsPanel({ latestPeriod, onClosePeriod, onActivatePeriod, onOpenPeriod, loading }) {
  const disabled = loading || !latestPeriod;

  const submit = (handler) => (event) => {
    event.preventDefault();
    if (disabled) return;
    handler();
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>Period Actions</h2>
      </div>

      <p className="muted" style={{ marginBottom: 12 }}>
        Actions are restricted to the latest period only.
      </p>

      <div className="form-grid">
        <form onSubmit={submit(onClosePeriod)}>
          <label htmlFor="period-close">Close Latest Period</label>
          <div className="input-row">
            <input
              id="period-close"
              value={latestPeriod || 'No period loaded'}
              readOnly
              maxLength={6}
            />
            <button type="submit" disabled={disabled} className="danger-btn">Close</button>
          </div>
        </form>

        <form onSubmit={submit(onActivatePeriod)}>
          <label htmlFor="period-activate">Activate Latest Period</label>
          <div className="input-row">
            <input
              id="period-activate"
              value={latestPeriod || 'No period loaded'}
              readOnly
              maxLength={6}
            />
            <button type="submit" disabled={disabled} className="success-btn">Activate</button>
          </div>
        </form>

        <form onSubmit={submit(onOpenPeriod)}>
          <label htmlFor="period-open">Open Latest Period</label>
          <div className="input-row">
            <input
              id="period-open"
              value={latestPeriod || 'No period loaded'}
              readOnly
              maxLength={6}
            />
            <button type="submit" disabled={disabled}>Open</button>
          </div>
        </form>
      </div>
    </section>
  );
}
