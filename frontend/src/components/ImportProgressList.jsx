export default function ImportProgressList({ importingFiles }) {
  if (importingFiles.length === 0) return null;

  const decimal = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <section className="card import-progress-card">
      <div className="card-header">
        <h2>Importing Files</h2>
      </div>

      <div className="import-progress-list">
        {importingFiles.map((importTask) => (
          <div key={importTask.id} className="import-progress-item">
            <div className="import-progress-header">
              <span className="import-file-name">{importTask.fileName}</span>
              <span className="import-progress-text">
                {importTask.currentRows} / {importTask.totalRows} rows ({importTask.percentage}%)
              </span>
            </div>

            <div className="import-progress-bar-container">
              <div className="import-progress-bar">
                <div
                  className="import-progress-fill"
                  style={{ width: `${importTask.percentage}%` }}
                />
              </div>
            </div>

            {importTask.status && (
              <div className={`import-status ${importTask.status}`}>
                {importTask.status === 'completed' && '✓ Import completed'}
                {importTask.status === 'error' && `✕ ${importTask.errorMessage}`}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
