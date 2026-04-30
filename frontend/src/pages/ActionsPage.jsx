export default function ActionsPage({ latest, loading, canActivate, canCloseOrOpen, onActivate, onClose, onOpen, onRefresh, banner }) {
  return (
    <>
      <section id="actions" className="card action-toolbar">
        <div>
          <h2>Current Period Actions</h2>
          <p className="muted">
            Latest period: <strong>{latest?.period || '-'}</strong> | Status: <strong>{(latest?.status || '-').toUpperCase()}</strong>
          </p>
        </div>

        <div className="action-buttons">
          <button onClick={onActivate} disabled={loading || !latest?.period || !canActivate} className="success-btn">
            Activate
          </button>

          <button onClick={onClose} disabled={loading || !latest?.period || !canCloseOrOpen} className="danger-btn">
            Close
          </button>

          <button onClick={onOpen} disabled={loading || !latest?.period || !canCloseOrOpen}>
            Open
          </button>

          <button onClick={onRefresh} disabled={loading} className="secondary-btn">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </section>

      <section className={`banner banner-${banner.type}`}>{banner.message}</section>
    </>
  );
}
