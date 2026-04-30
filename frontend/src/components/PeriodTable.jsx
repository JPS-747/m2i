import StatusBadge from './StatusBadge';

const decimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function PeriodTable({ 
  periods, 
  latest, 
  loading, 
  currentAction, 
  elapsedTime, 
  canActivate, 
  canCloseOrOpen,
  onActivate, 
  onClose, 
  onOpen, 
  onRefresh 
}) {
  const formatElapsedTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <section className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Latest 12 Periods</h2>
          <p className="muted" style={{ margin: '0.5rem 0 0 0' }}>
            Latest period: <strong>{latest?.period || '-'}</strong> | Status: <strong>{(latest?.status || '-').toUpperCase()}</strong>
          </p>
        </div>
        <div className="action-buttons" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button onClick={onActivate} disabled={loading || !latest?.period || !canActivate} className="success-btn">
              Activate
            </button>
            {loading && currentAction === 'Activate' && (
              <small style={{ color: '#666', fontSize: '0.85em' }}>
                {formatElapsedTime(elapsedTime)}
              </small>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button onClick={onClose} disabled={loading || !latest?.period || !canCloseOrOpen} className="danger-btn">
              Close
            </button>
            {loading && currentAction === 'Close' && (
              <small style={{ color: '#666', fontSize: '0.85em' }}>
                {formatElapsedTime(elapsedTime)}
              </small>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button onClick={onOpen} disabled={loading || !latest?.period || !canCloseOrOpen}>
              Open
            </button>
            {loading && currentAction === 'Open' && (
              <small style={{ color: '#666', fontSize: '0.85em' }}>
                {formatElapsedTime(elapsedTime)}
              </small>
            )}
          </div>

          <button onClick={onRefresh} disabled={loading} className="secondary-btn">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="compact-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Bank Total</th>
              <th style={{ textAlign: 'right' }}>Bank Count</th>
              <th style={{ textAlign: 'right' }}>System Total</th>
              <th style={{ textAlign: 'right' }}>System Count</th>
              <th style={{ textAlign: 'right' }}>BBF Total</th>
              <th style={{ textAlign: 'right' }}>BBF Count</th>
              <th style={{ textAlign: 'right' }}>Matched Total</th>
              <th style={{ textAlign: 'right' }}>Matched Count</th>
              <th style={{ textAlign: 'right' }}>Reconciled Total</th>
              <th style={{ textAlign: 'right' }}>Reconciled Count</th>
              <th style={{ textAlign: 'right' }}>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 ? (
              <tr>
                <td colSpan={12} className="empty-cell">
                  No period data available.
                </td>
              </tr>
            ) : (
              periods.map((row) => (
                <tr key={row.period}>
                  <td>{row.period}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td style={{ textAlign: 'right' }}>{decimal.format(Number(row.bank_total || 0))}</td>
                  <td style={{ textAlign: 'right' }}>{row.bank_count ?? 0}</td>
                  <td style={{ textAlign: 'right' }}>{decimal.format(Number(row.system_total || 0))}</td>
                  <td style={{ textAlign: 'right' }}>{row.system_count ?? 0}</td>
                   <td style={{ textAlign: 'right' }}>{decimal.format(Number(row.bbf_total || 0))}</td>
                  <td style={{ textAlign: 'right' }}>{row.bbf_count ?? 0}</td>
                  <td style={{ textAlign: 'right' }}>{decimal.format(Number(row.matched_total || 0))}</td>
                  <td style={{ textAlign: 'right' }}>{row.matched_count ?? 0}</td>
                  <td style={{ textAlign: 'right' }}>{decimal.format(Number(row.reconciled_total || 0))}</td>
                  <td style={{ textAlign: 'right' }}>{row.reconciled_count ?? 0}</td>
                  <td style={{ textAlign: 'right' }}>{formatDate(row.last_updated)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
