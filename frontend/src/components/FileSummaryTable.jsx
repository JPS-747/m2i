const decimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function FileSummaryTable({ 
  title, 
  files, 
  sourceLabel, 
  onDeleteFile, 
  deletingRows, 
  canDelete,
  openPeriod,
  canImport,
  isLoadingPreview,
  onFileSelect
}) {
  const summary = files.reduce(
    (acc, row) => {
      acc.totalFiles += 1;
      acc.totalItems += Number(row.item_count || 0);
      acc.totalAmount += Number(row.total_amount || 0);
      return acc;
    },
    { totalFiles: 0, totalItems: 0, totalAmount: 0 }
  );

  return (
    <section className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{title}</h2>
          {openPeriod && (
            <p className="muted" style={{ margin: '0.5rem 0 0 0' }}>
              Current open period: <strong>{openPeriod || '-'}</strong>
            </p>
          )}
        </div>
        {onFileSelect && (
          <label className={`import-btn ${!canImport || isLoadingPreview ? 'disabled' : ''}`}>
            {isLoadingPreview ? 'Reading file...' : `Import ${sourceLabel} CSV`}
            <input
              type="file"
              accept={sourceLabel === 'Bank' ? '.csv,.txt' : '.csv'}
              disabled={!canImport || isLoadingPreview}
              onChange={onFileSelect}
              hidden
            />
          </label>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>File Name</th>
              <th>File Index</th>
              <th>Source</th>
              <th>Period</th>
              <th style={{ textAlign: 'right' }}>No. of Items</th>
              <th style={{ textAlign: 'right' }}>Sum Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  No imported {sourceLabel.toLowerCase()} files found.
                </td>
              </tr>
            ) : (
              files.map((row) => (
                <tr key={`${row.FileOrigin}-${row.file_index}-${row.period ?? 'none'}`}>
                  <td>{row.FileOrigin || '-'}</td>
                  <td style={{ textAlign: 'center' }}>{row.file_index}</td>
                  <td>{row.source}</td>
                  <td style={{ textAlign: 'center' }}>{row.period ?? '-'}</td>
                  <td style={{ textAlign: 'right' }}>{row.item_count}</td>
                  <td style={{ textAlign: 'right' }}>{decimal.format(Number(row.total_amount || 0))}</td>
                  <td>
                    <div className="delete-btn-container">
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => {
                          if (!onDeleteFile) return;
                          onDeleteFile(row);
                        }}
                        disabled={!canDelete || !onDeleteFile || deletingRows?.has(`${row.FileOrigin}-${row.file_index}`)}
                        title={!canDelete ? 'Delete available only when period is open' : ''}
                      >
                        Delete File
                      </button>
                      {deletingRows?.has(`${row.FileOrigin}-${row.file_index}`) && (
                        <span className="spinner" title="Deleting..."></span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="file-summary-footer">
        <h3>All Files Summary</h3>
        <div className="file-summary-grid">
          <p>
            <span>Total Files</span>
            <strong>{summary.totalFiles}</strong>
          </p>
          <p>
            <span>Total Items</span>
            <strong>{summary.totalItems}</strong>
          </p>
          <p>
            <span>Total Amount</span>
            <strong>{decimal.format(summary.totalAmount)}</strong>
          </p>
        </div>
      </section>
    </section>
  );
}
