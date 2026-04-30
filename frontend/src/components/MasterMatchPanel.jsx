import { useState } from 'react';
import MatchingPanel from './MatchingPanel';

/**
 * MasterMatchPanel Component
 * Organizes matching panels by category (File, OneToMany, OneToOne)
 * Each master panel contains multiple child matching panels
 */
export default function MasterMatchPanel({
  category,
  categoryTitle,
  categoryDescription,
  categoryIcon,
  panels = [],
  matchingStats = {},
  elapsedTimes = {},
  draggedPanel,
  draggedOverIndex,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  globalIndex = 0,
  handlersMap = {},
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Get panels for this category
  const categoryPanels = panels.filter((panel) => panel.type === category);

  if (categoryPanels.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginBottom: '30px',
        backgroundColor: 'var(--surface-alt)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Master Panel Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: 'var(--surface)',
          borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
      >
        {/* Expand/Collapse Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            fontSize: '18px',
            fontWeight: 'bold',
            transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        >
          ▼
        </div>

        {/* Category Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: getCategoryColor(category),
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          {categoryIcon}
        </div>

        {/* Category Info */}
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 4px 0', color: 'var(--text)' }}>{categoryTitle}</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>{categoryDescription}</p>
        </div>

        {/* Count Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '32px',
            height: '32px',
            padding: '0 8px',
            borderRadius: '16px',
            backgroundColor: getCategoryColor(category),
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          {categoryPanels.length}
        </div>
      </div>

      {/* Master Panel Content */}
      {isExpanded && (
        <div style={{ padding: '20px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                categoryPanels.length === 1
                  ? '1fr'
                  : categoryPanels.length === 2
                    ? 'repeat(2, 1fr)'
                    : 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {categoryPanels.map((panel, index) => {
              // Calculate the global index for drag-drop across all panels
              const panelGlobalIndex = globalIndex + index;
              const isBeingDragged = draggedPanel === panelGlobalIndex;
              const isDropZone = draggedOverIndex === panelGlobalIndex;

              return (
                <div
                  key={`panel-${panel.key}-${index}`}
                  onDragOver={(e) => onDragOver(e, panelGlobalIndex)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, panelGlobalIndex)}
                  style={{
                    opacity: isBeingDragged ? 0.5 : 1,
                    border: isDropZone ? '2px dashed var(--primary)' : 'none',
                    borderRadius: '4px',
                    transition: 'opacity 200ms ease, border 200ms ease',
                  }}
                >
                  <MatchingPanel
                    title={panel.title}
                    description={panel.description}
                    isMatching={matchingStats[panel.state_key]?.progress > 0}
                    progress={matchingStats[panel.state_key]?.progress || 0}
                    count={panel.total_count}
                    total={panel.total_amount}
                    isCompleted={panel.total_count > 0}
                    elapsedTime={elapsedTimes[panel.state_key] || panel.elapsed_time || 0}
                    status={panel.status || 'pending'}
                    onClickStart={handlersMap[panel.key]}
                    onClickReset={handlersMap[`${panel.key}-reset`]}
                    matched_total_amount={matchingStats[panel.state_key]?.matched_total_amount}
                    onDragStart={(e) => onDragStart(e, panelGlobalIndex)}
                    onDragEnd={onDragEnd}
                    isDragging={isBeingDragged}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Stats Footer */}
      {isExpanded && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            fontSize: '12px',
            color: 'var(--muted)',
          }}
        >
          {categoryPanels.length} matcher{categoryPanels.length !== 1 ? 's' : ''} • Matched:{' '}
          {categoryPanels
            .reduce((sum, panel) => sum + (panel.total_count || 0), 0)
            .toLocaleString()} transactions
        </div>
      )}
    </div>
  );
}

/**
 * Get color for category based on type
 */
function getCategoryColor(category) {
  switch (category) {
    case 'File':
      return '#2196F3'; // Blue
    case 'OneToMany':
      return '#FF9800'; // Orange
    case 'OneToOne':
      return '#4CAF50'; // Green
    default:
      return '#757575'; // Gray
  }
}
