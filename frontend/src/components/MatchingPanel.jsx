import { useState } from 'react';

const DEFAULT_SIDE_PARAMS = {
  source: 'System',
  movement_types: [],
  reference: '',
  multi_period: false,
  debit_credit: '',
};

const MOVEMENT_TYPE_OPTIONS = [
  "Agency",
  "Alteration_ChangeCommencementDate",
  "Alteration_ChangePaymentFrequency",
  "Alteration_PaidUpReinstatement",
  "Alteration_Reinstatement",
  "Alteration_ReinstatementInForce",
  "APS",
  "Bank",
  "Cash Received",
  "Cash Received Reversal",
  "Debit Order Received",
  "Debit Order Received Reversal",
  "Non_Forfeiture",
  "Paid_Up",
  "Paid_Up_Automatic",
  "PaymentReceived_PaymentDeduction",
  "Reverse_PaymentReceived_Debitorder",
  "Reverse_PaymentReceived_PaymentDeduction",
  "Suspense",
  "Suspense Correction",
  "suspense reversal",
  "Unpaid",
  "W/Off",
];

const normalizeSideParams = (sideParams, fallbackSource) => {
  const safe = sideParams || {};
  return {
    source: safe.source || fallbackSource,
    movement_types: Array.isArray(safe.movement_types) ? safe.movement_types : [],
    reference: safe.reference || '',
    multi_period: Boolean(safe.multi_period),
    debit_credit: safe.debit_credit || '',
  };
};

const buildFormSettings = ({
  title,
  description,
  isActive,
  matchType,
  parameters,
}) => {
  const debitParams = normalizeSideParams(parameters?.debit, 'System');
  const creditParams = normalizeSideParams(parameters?.credit, 'Bank');

  return {
    title: title || '',
    description: description || '',
    is_active: Boolean(isActive),
    type: matchType || 'OneToMany',
    parameters: {
      debit: {
        ...DEFAULT_SIDE_PARAMS,
        ...debitParams,
      },
      credit: {
        ...DEFAULT_SIDE_PARAMS,
        ...creditParams,
      },
    },
  };
};

export default function MatchingPanel({
  title,
  description,
  isMatching,
  progress,
  count,
  total,
  matched_total_amount,
  isCompleted,
  elapsedTime,
  status = "pending",
  onClickStart,
  onClickReset,
  disabled = false,
  onDragStart,
  onDragEnd,
  isDragging = false,
  panelKey,
  onSettingsUpdate,
  isResetting = false,
  isActive = true,
  matchType = 'OneToMany',
  parameters,
}) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedSettings, setEditedSettings] = useState(
    buildFormSettings({
      title,
      description,
      isActive,
      matchType,
      parameters,
    })
  );

  const syncEditedSettingsFromProps = () => {
    setEditedSettings(
      buildFormSettings({
        title,
        description,
        isActive,
        matchType,
        parameters,
      })
    );
  };

  const updateSideField = (side, field, value) => {
    setEditedSettings((prev) => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [side]: {
          ...prev.parameters[side],
          [field]: value,
        },
      },
    }));
  };

  const normalizeMovementTypes = (raw) => {
    if (!raw.trim()) return [];
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const updateMovementTypesFromSelect = (side, selectedOptions) => {
    const values = Array.from(selectedOptions).map((o) => o.value);
    updateSideField(side, 'movement_types', values);
  };

  const handleSaveSettings = () => {
    if (onSettingsUpdate) {
      onSettingsUpdate({
        key: panelKey,
        title: editedSettings.title,
        description: editedSettings.description,
        type: editedSettings.type,
        is_active: editedSettings.is_active,
        parameters: {
          debit: {
            ...editedSettings.parameters.debit,
            movement_types: Array.isArray(editedSettings.parameters.debit.movement_types)
              ? editedSettings.parameters.debit.movement_types
              : [],
          },
          credit: {
            ...editedSettings.parameters.credit,
            movement_types: Array.isArray(editedSettings.parameters.credit.movement_types)
              ? editedSettings.parameters.credit.movement_types
              : [],
          },
        },
      });
    }
    setShowEditModal(false);
  };

  const handleCancelEdit = () => {
    syncEditedSettingsFromProps();
    setShowEditModal(false);
  };

  // Determine icon and color based on status
  const getIconStyle = () => {
    let bgColor = '#e0e0e0';
    let textColor = '#999';
    let icon = '○';
    let iconTitle = 'Matching not started';

    if (status === 'success') {
      bgColor = '#0078d4';
      textColor = 'white';
      icon = '✓';
      iconTitle = 'Matching completed successfully';
    } else if (status === 'error') {
      bgColor = '#f44336';
      textColor = 'white';
      icon = '⚠';
      iconTitle = 'Matching error: Balance mismatch';
    } else if (isCompleted && status !== 'error') {
      bgColor = '#0078d4';
      textColor = 'white';
      icon = '✓';
      iconTitle = 'Matching completed';
    }

    return { bgColor, textColor, icon, iconTitle };
  };

  const { bgColor, textColor, icon, iconTitle } = getIconStyle();

  return (
    <section className="card import-card" style={{ flex: 1, minWidth: '300px', position: 'relative', opacity: disabled || isResetting || !isActive ? 0.5 : 1, pointerEvents: disabled || isResetting || !isActive ? 'none' : 'auto', transition: 'opacity 200ms ease' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px', gap: '12px' }}>
        <h2 style={{ margin: 0, flex: 1, fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h2>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            minWidth: '32px',
            minHeight: '32px',
            borderRadius: '50%',
            backgroundColor: bgColor,
            color: textColor,
            fontSize: '18px',
            fontWeight: 'bold',
            flexShrink: 0,
            title: iconTitle,
          }}
        >
          {icon}
        </div>
      </div>
      <p className="muted" style={{ marginBottom: 10 }}>
        {description}
      </p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', width: 'fit-content' }}>
        <button
          onClick={onClickStart}
          disabled={disabled || isMatching || isResetting}
          style={{
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: '600',
            backgroundColor: disabled || isMatching || isResetting ? '#ccc' : '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: disabled || isMatching || isResetting ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {isMatching ? 'Matching...' : 'Start'}
        </button>
        <button
          onClick={onClickReset}
          disabled={disabled || isMatching || isResetting}
          style={{
            padding: '10px 12px',
            fontSize: '14px',
            fontWeight: '600',
            backgroundColor: disabled || isMatching || isResetting ? '#ccc' : '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: disabled || isMatching || isResetting ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
          title="Reset matching results"
        >
          Reset
        </button>
      </div>

      <div style={{ marginTop: '15px', minHeight: '63px' }}>
        {isMatching && progress > 0 && (
          <>
            <div style={{ fontSize: '14px', marginBottom: '8px', fontWeight: '600' }}>
              Progress: {progress}% {elapsedTime > 0 && `(${elapsedTime}s)`}
            </div>
            <div
              style={{
                width: '100%',
                height: '20px',
                backgroundColor: '#e0e0e0',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid #ccc',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: '#0078d4',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                {progress > 10 && `${progress}%`}
              </div>
            </div>
          </>
        )}
      </div>

        <div style={{ marginTop: '8px', fontSize: '14px', paddingBottom: '40px' }}>
          <div>Count: {count}</div>
          <div>Total: {typeof total === 'number' ? total.toFixed(2) : (0).toFixed(2)}</div>
          {matched_total_amount !== undefined && matched_total_amount !== null && (
            <div style={{ color: Math.abs(matched_total_amount) > 0.01 ? '#f44336' : 'inherit' }}>
              Match Amount: {matched_total_amount.toFixed(2)}
            </div>
          )}
          <div style={{ minHeight: '20px' }}>
            {elapsedTime > 0 && <div>Time: {elapsedTime}s</div>}
          </div>
        </div>      {/* Edit Icon - Bottom Right (left of drag handle) */}
      <div
        onClick={() => {
          syncEditedSettingsFromProps();
          setShowEditModal(true);
        }}
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '45px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '4px',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          cursor: 'pointer',
          color: '#4CAF50',
          fontSize: '16px',
          fontWeight: 'bold',
          transition: 'all 0.2s ease',
          border: '1px solid transparent',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
          e.currentTarget.style.border = '1px solid #4CAF50';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
          e.currentTarget.style.border = '1px solid transparent';
        }}
        title="Edit panel settings"
      >
        ✎
      </div>

      {/* Drag Handle Icon - Bottom Right */}
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '4px',
          backgroundColor: 'rgba(0, 120, 212, 0.1)',
          cursor: 'grab',
          color: '#0078d4',
          fontSize: '16px',
          fontWeight: 'bold',
          transition: 'all 0.2s ease',
          border: isDragging ? '2px solid #0078d4' : '1px solid transparent',
          opacity: isDragging ? 0.7 : 1,
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0, 120, 212, 0.2)';
          e.currentTarget.style.border = '1px solid #0078d4';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = isDragging ? 'rgba(0, 120, 212, 0.1)' : 'rgba(0, 120, 212, 0.1)';
          e.currentTarget.style.border = isDragging ? '2px solid #0078d4' : '1px solid transparent';
        }}
        title="Drag to move this panel"
      >
        ⋮⋮
      </div>

      {/* Edit Settings Modal */}
      {showEditModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              border: '1px solid var(--border)',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text)' }}>Edit Panel Settings</h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text)' }}>
                Title
              </label>
              <input
                type="text"
                value={editedSettings.title}
                onChange={(e) => setEditedSettings((prev) => ({ ...prev, title: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface-alt)',
                  color: 'var(--text)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                placeholder="Agency Period"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text)' }}>
                Description
              </label>
              <textarea
                value={editedSettings.description}
                onChange={(e) => setEditedSettings((prev) => ({ ...prev, description: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface-alt)',
                  color: 'var(--text)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  minHeight: '100px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
                placeholder="Match transactions by Agency"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text)' }}>
                Type
              </label>
              <select
                value={editedSettings.type}
                onChange={(e) => setEditedSettings((prev) => ({ ...prev, type: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface-alt)',
                  color: 'var(--text)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="File">File</option>
                <option value="OneToMany">OneToMany</option>
                <option value="OneToOne">OneToOne</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', width: '100%', textAlign: 'left', fontWeight: '600', color: 'var(--text)', cursor: 'pointer' }}>
                <span>Active</span>
                <input
                  type="checkbox"
                  checked={editedSettings.is_active}
                  onChange={(e) => setEditedSettings((prev) => ({ ...prev, is_active: e.target.checked }))}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                  }}
                />
              </label>
            </div>

            {['debit', 'credit'].map((side) => {
              const sideLabel = side === 'debit' ? 'Debit' : 'Credit';
              const sideParams = editedSettings.parameters[side];
              return (
                <div
                  key={side}
                  style={{
                    marginBottom: '16px',
                    padding: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--surface-alt)',
                  }}
                >
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text)' }}>{sideLabel} Parameters</h3>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                      Source
                    </label>
                    <select
                      value={sideParams.source}
                      onChange={(e) => updateSideField(side, 'source', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text)',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="System">System</option>
                      <option value="Bank">Bank</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                      Reference Pattern
                    </label>
                    <input
                      type="text"
                      value={sideParams.reference}
                      onChange={(e) => updateSideField(side, 'reference', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text)',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                      placeholder="PD00[0-9]{4}"
                    />
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                      Movement Types (select any)
                    </label>
                    <select
                      multiple
                      size={8}
                      value={sideParams.movement_types}
                      onChange={(e) => updateMovementTypesFromSelect(side, e.target.selectedOptions)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text)',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    >
                      {MOVEMENT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                      Debit/Credit
                    </label>
                    <select
                      value={sideParams.debit_credit}
                      onChange={(e) => updateSideField(side, 'debit_credit', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text)',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="">Both</option>
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                    </select>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', width: '100%', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text)', cursor: 'pointer' }}>
                    <span>Multi Period</span>
                    <input
                      type="checkbox"
                      checked={sideParams.multi_period}
                      onChange={(e) => updateSideField(side, 'multi_period', e.target.checked)}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                      }}
                    />
                  </label>
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelEdit}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: 'var(--surface-alt)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-alt)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#45a049';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#4CAF50';
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
