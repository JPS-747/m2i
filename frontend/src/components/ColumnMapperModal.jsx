export default function ColumnMapperModal({
  isOpen,
  fileName,
  previewRows,
  availableColumns,
  columnMapping,
  columnTransformations,
  onMappingChange,
  onTransformationChange,
  onConfirm,
  onCancel,
  isLoading,
}) {
  if (!isOpen) return null;

  const requiredColumns = ['MovementType', 'PolicyNo', 'Amount', 'Reference'];

  const isComplete = requiredColumns.every((col) => columnMapping[col]);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Map CSV Columns</h2>
          <button className="modal-close" onClick={onCancel} disabled={isLoading}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="preview-section">
            <h3>File Preview</h3>
            <p className="muted" style={{ marginBottom: 10 }}>
              File: <strong>{fileName}</strong>
            </p>
            <div className="table-wrap">
              <table className="preview-table">
                <thead>
                  <tr>
                    {availableColumns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx}>
                      {availableColumns.map((col) => (
                        <td key={`${idx}-${col}`}>{row[col] || '-'}</td>
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
              Select which column from your CSV maps to each required field:
            </p>

            {requiredColumns.map((requiredCol) => (
              <div key={`mapping-${requiredCol}`}>
                <div className="mapping-row">
                  <label htmlFor={`map-${requiredCol}`}>
                    <strong>{requiredCol}</strong>
                  </label>
                  <select
                    id={`map-${requiredCol}`}
                    value={columnMapping[requiredCol] || ''}
                    onChange={(e) =>
                      onMappingChange(requiredCol, e.target.value || null)
                    }
                    disabled={isLoading}
                  >
                    <option value="">-- Select Column --</option>
                    {availableColumns.map((col) => (
                      <option key={`${requiredCol}-option-${col}`} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
                {columnMapping[requiredCol] && onTransformationChange && (
                  <div style={{ marginBottom: 12, paddingLeft: 0 }}>
                    <label htmlFor={`trans-${requiredCol}`} style={{ display: 'block', marginBottom: 4 }}>
                      <small className="muted">Transform (optional)</small>
                    </label>
                    <input
                      id={`trans-${requiredCol}`}
                      type="text"
                      placeholder="e.g., uppercase; left_of:C1; skip_if:SKIP"
                      value={columnTransformations?.[requiredCol] || ''}
                      onChange={(e) =>
                        onTransformationChange(requiredCol, e.target.value)
                      }
                      disabled={isLoading}
                      style={{ width: '100%', padding: '8px', fontSize: '0.9rem' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="info-section">
            <h3>Default Values</h3>
            <ul className="muted" style={{ fontSize: '0.9rem' }}>
              <li>Status: unreconciled</li>
              <li>Period: Current open period</li>
              <li>Source: {columnMapping.source || 'System'}</li>
              <li>Line Number: Auto-generated</li>
              <li>Match Type: None</li>
              <li>Match ID: 0</li>
              <li>Record ID: From Reference column</li>
            </ul>
          </div>

          {onTransformationChange && (
            <div className="info-section">
              <h3>Transformation Functions (Optional)</h3>
              <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 12 }}>
                Use semicolon (;) to chain multiple transformations. Examples:
              </p>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <th style={{ textAlign: 'left', padding: '8px 4px' }}>Function</th>
                    <th style={{ textAlign: 'left', padding: '8px 4px' }}>Description</th>
                    <th style={{ textAlign: 'left', padding: '8px 4px' }}>Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 4px' }}><code>convert_negative</code></td>
                    <td style={{ padding: '8px 4px' }}>Convert negative to positive</td>
                    <td style={{ padding: '8px 4px' }}>-100 → 100</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 4px' }}><code>abs</code></td>
                    <td style={{ padding: '8px 4px' }}>Absolute value</td>
                    <td style={{ padding: '8px 4px' }}>-100 → 100</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 4px' }}><code>substring:start,end</code></td>
                    <td style={{ padding: '8px 4px' }}>Extract substring</td>
                    <td style={{ padding: '8px 4px' }}>substring:0,5</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 4px' }}><code>left_of:chars</code></td>
                    <td style={{ padding: '8px 4px' }}>Extract text left of chars</td>
                    <td style={{ padding: '8px 4px' }}>90406597C1CLIFECOVER → 90406597</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 4px' }}><code>skip_if:value</code></td>
                    <td style={{ padding: '8px 4px' }}>Skip row if value matches</td>
                    <td style={{ padding: '8px 4px' }}>skip_if:SKIP</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 4px' }}><code>skip_if:empty</code></td>
                    <td style={{ padding: '8px 4px' }}>Skip row if field is empty or blank</td>
                    <td style={{ padding: '8px 4px' }}>skip_if:empty</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 4px' }}><code>uppercase</code></td>
                    <td style={{ padding: '8px 4px' }}>Convert to uppercase</td>
                    <td style={{ padding: '8px 4px' }}>abc → ABC</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 4px' }}><code>trim</code></td>
                    <td style={{ padding: '8px 4px' }}>Remove whitespace</td>
                    <td style={{ padding: '8px 4px' }}>" text " → "text"</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 4px' }}><code>change_value:value</code></td>
                    <td style={{ padding: '8px 4px' }}>Replace with constant value</td>
                    <td style={{ padding: '8px 4px' }}>change_value:NEW</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 4px' }}><code>replace_if:find=replace</code></td>
                    <td style={{ padding: '8px 4px' }}>Replace whole value if substring found</td>
                    <td style={{ padding: '8px 4px' }}>replace_if:JAN=0C1</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 4px' }}><code>negate_if:value</code></td>
                    <td style={{ padding: '8px 4px' }}>Negate Amount if field value matches (check any field, apply to Amount)</td>
                    <td style={{ padding: '8px 4px' }}>MovementType: negate_if:REVERSAL</td>
                  </tr>
                </tbody>
              </table>
              <p className="muted" style={{ fontSize: '0.85rem', marginTop: 12 }}>
                <strong>Notes:</strong>
                <ul style={{ marginTop: 6, marginBottom: 0 }}>
                  <li>Chain transformations with semicolon: <code>skip_if:NEW; skip_if:TERMINATED; skip_if:empty; change_value:GRN;</code></li>
                  <li><code>skip_if</code> conditions are always evaluated first to avoid unnecessary processing. Use <code>skip_if:empty</code> to skip rows where a field is blank or empty</li>
                  <li><code>negate_if</code> can be on any field (MovementType, PolicyNo, etc.) but always negates the Amount. Example: if MovementType is "REVERSAL", negate the Amount</li>
                </ul>
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onCancel} disabled={isLoading} className="secondary-btn">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isComplete || isLoading}
            className="success-btn"
          >
            {isLoading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
