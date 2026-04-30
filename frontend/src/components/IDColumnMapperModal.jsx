export default function IDColumnMapperModal({
  isOpen,
  fileName,
  previewRows,
  availableColumns,
  selectedIdColumn,
  onIdColumnChange,
  onConfirm,
  onCancel,
  isLoading,
  onFileSelect,
  hasFileSelected,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Select ID Column for Matching</h2>
          <button className="modal-close" onClick={onCancel} disabled={isLoading}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {!hasFileSelected ? (
            <div className="file-selection-section">
              <h3>Step 1: Select a File</h3>
              <p className="muted" style={{ marginBottom: 16 }}>
                Choose a CSV or text file containing transaction IDs to match.
              </p>
              <div style={{ marginBottom: 20 }}>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={onFileSelect}
                  disabled={isLoading}
                  style={{
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                />
              </div>
            </div>
          ) : null}

          {hasFileSelected && (
            <>
              <div className="preview-section">
            <h3>File Preview</h3>
            <p className="muted" style={{ marginBottom: 10 }}>
              File: <strong>{fileName}</strong>
            </p>
            <div className="table-wrap">
              <table className="preview-table">
                <thead>
                  <tr>
                    {availableColumns.map((col, colIdx) => (
                      <th key={`header-${colIdx}-${col}`}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={`row-${idx}`}>
                      {availableColumns.map((col, colIdx) => (
                        <td key={`cell-${idx}-${colIdx}`}>{row[col] || '-'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mapping-section">
            <h3>Column Mapping</h3>
            <p className="muted" style={{ marginBottom: 16 }}>
              Select which column contains the transaction IDs to match:
            </p>

            <div className="mapping-row">
              <label htmlFor="map-IdColumn">
                <strong>Transaction ID Column</strong>
              </label>
              <select
                id="map-IdColumn"
                value={selectedIdColumn || ''}
                onChange={(e) => onIdColumnChange(e.target.value || null)}
                disabled={isLoading}
              >
                <option value="">-- Select Column --</option>
                {availableColumns.map((col, idx) => (
                  <option key={`col-${idx}-${col}`} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>

              <button
                className="btn btn-secondary"
                onClick={onCancel}
                style={{ marginTop: 16 }}
              >
                ← Select Different File
              </button>
            </>
          )}
        </div>

        <div className="modal-footer">
          {hasFileSelected && (
            <>
              <button
                className="btn btn-secondary"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={onConfirm}
                disabled={isLoading || !selectedIdColumn}
              >
                {isLoading ? 'Matching...' : 'Match Records'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
