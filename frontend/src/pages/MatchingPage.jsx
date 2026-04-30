import { useState, useEffect, useRef } from 'react';
import IDColumnMapperModal from '../components/IDColumnMapperModal';
import MatchingPanel from '../components/MatchingPanel';
import { PeriodApi } from '../api/periodApi';
import { useMatchStatsWebSocket } from '../hooks/useMatchStatsWebSocket';

// Add CSS animation for spinner
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(spinnerStyle);
}

// File matching configuration
const FILE_MATCHING = {
  key: 'fromFile',
  title: 'Match from File',
  description: 'Upload a file with transaction IDs to match them to the current period.',
  isFileUpload: true,
};

// Matching panels configuration will be loaded from API
let MATCHING_PANELS = [];

// Helper function to load and merge match types from both settings and database
const reloadMatchTypes = async () => {
  try {

    
    // Load static configuration from settings.json
    const response = await PeriodApi.getSettingsMatchTypes();
    const matchTypes = response.match_types || [];
    
    // Dynamic values are loaded separately via getMatchTypeTotals
    // which is called in its own useEffect and state management
    
    // Sort by display_order to ensure correct panel order
    const sortedMatchTypes = matchTypes.sort((a, b) => {
      return (a.display_order ?? 999) - (b.display_order ?? 999);
    });
    
    // Return the panel configuration with defaults for dynamic stats
    const flattenedMatchTypes = sortedMatchTypes.map((panel) => {
      return {
        ...panel,
        // Default stats - will be updated by getMatchTypeTotals
        total_count: panel.stats?.total_count || 0,
        total_amount: panel.stats?.total_amount || 0,
        elapsed_time: panel.stats?.elapsed_time || 0,
        status: panel.stats?.status || 'pending',
      };
    });
    
    // Validate each panel has a unique key and is active
    const keySet = new Set();
    const validPanels = flattenedMatchTypes.filter((panel) => {
      // Only show panels that are active
      if (panel.is_active === false) {
        return false;
      }
      if (!panel.key || panel.key.trim() === '') {
        console.warn('Panel missing or empty key:', panel);
        return false;
      }
      if (keySet.has(panel.key)) {
        console.warn('Duplicate key found:', panel.key);
        return false;
      }
      keySet.add(panel.key);
      return true;
    });
    
    return validPanels;
  } catch (error) {
    console.error('Failed to reload match types:', error);
    throw error;
  }
};

export default function MatchingPage() {
  const [matchingPanels, setMatchingPanels] = useState([]);
  const [draggedPanel, setDraggedPanel] = useState(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState(null);
  const [showIdMapper, setShowIdMapper] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [idColumnMapping, setIdColumnMapping] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [matchingFiles, setMatchingFiles] = useState([]);
  const [elapsedTimes, setElapsedTimes] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false); // Track refresh button loading state
  const [currentFileMatchKey, setCurrentFileMatchKey] = useState(null); // Track which File-type match is active
  const [resettingPanels, setResettingPanels] = useState({}); // Track which panels are currently resetting
  const fileInputRef = useRef(null); // Reference to hidden file input

  // Load match types from API on component mount
  useEffect(() => {
    const loadMatchTypes = async () => {
      try {
        const validPanels = await reloadMatchTypes();
        console.log(`Loaded ${validPanels.length} valid panels`);
        setMatchingPanels(validPanels);
        MATCHING_PANELS = validPanels;
      } catch (error) {
        console.error('Failed to load match types from settings:', error);
        
      }
    };
    loadMatchTypes();
  }, []);

  // Load match type totals on component mount
  useEffect(() => {
    const loadMatchTypeTotals = async () => {
      try {
        const totals = await PeriodApi.getMatchTypeTotals();
        console.log('Loaded match type totals:', totals);
        setMatchTypeTotals(totals);
      } catch (error) {
        console.error('Failed to load match type totals:', error);
      }
    };

    loadMatchTypeTotals();
  }, []);

  const [matchingStats, setMatchingStats] = useState({
    fromFile: { count: 0, total: 0, progress: 0 },
    agencies: { count: 0, total: 0, progress: 0 },
    cashReversals: { count: 0, total: 0, progress: 0 },
    debitOrderReversals: { count: 0, total: 0, progress: 0 },
    paymentDeductReversals: { count: 0, total: 0, progress: 0 },
    bankReversals: { count: 0, total: 0, progress: 0 },
    suspenseReversals: { count: 0, total: 0, progress: 0 },
    apsOfficials: { count: 0, total: 0, progress: 0 },
    apsTeachers: { count: 0, total: 0, progress: 0 },
    individual: { count: 0, total: 0, progress: 0 },
    policy: { count: 0, total: 0, progress: 0 },
    bankSysReversals: { count: 0, total: 0, progress: 0 },
  });

  const [matchTypeTotals, setMatchTypeTotals] = useState({
    match_types: {},
    overall: {
      count_matched: 0,
      total_matched: 0.0,
      count_unreconciled: 0,
      total_unreconciled: 0.0,
    },
  });

  // Track elapsed time for matching operations
  const [matchStartTimes, setMatchStartTimes] = useState({});

  // Handle WebSocket stats updates
  const handleStatsUpdate = (data) => {
    const { matchTypeKey, stats } = data;
    console.log(`📡 WebSocket Stats Update for '${matchTypeKey}':`, stats);
    
    // Update matchTypeTotals with the new stats
    setMatchTypeTotals((prev) => {
      const updated = {
        ...prev,
        match_types: {
          ...prev.match_types,
          [matchTypeKey]: {
            ...prev.match_types?.[matchTypeKey],
            count: stats.matched_count,
            total: stats.matched_total_amount,
            elapsed_time: stats.elapsed_time,
          },
        },
      };
      console.log(`✅ Updated matchTypeTotals[${matchTypeKey}]:`, {
        count: stats.matched_count,
        total: stats.matched_total_amount,
        elapsed_time: stats.elapsed_time,
      });
      return updated;
    });
  };

  // Use WebSocket hook for real-time stats updates
  useMatchStatsWebSocket(handleStatsUpdate, true);

  useEffect(() => {
    // Only update elapsed time if there are active operations
    if (Object.keys(matchStartTimes).length === 0) return;
    
    const interval = setInterval(() => {
      setElapsedTimes((prev) => {
        const updated = { ...prev };
        for (const key in matchStartTimes) {
          updated[key] = Math.floor((Date.now() - matchStartTimes[key]) / 1000);
        }
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [matchStartTimes]);

  const handleRefreshPanels = async () => {
    setIsRefreshing(true);
    try {
      const [validPanels, totals] = await Promise.all([
        reloadMatchTypes(),
        PeriodApi.getMatchTypeTotals()
      ]);
      
      setMatchingPanels(validPanels);
      MATCHING_PANELS = validPanels;
      
      if (totals) {
        setMatchTypeTotals(totals);
      }
      
      console.log('Panels and totals refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh panels:', error);
      alert('Failed to refresh panels. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGlobalReset = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset ALL transactions to unreconciled? This action cannot be undone.'
    );
    if (!confirmed) return;

    setIsRefreshing(true);
    try {
      const result = await PeriodApi.resetAll();
      console.log('Global reset completed:', result);
      
      // Refresh panels to show updated stats
      const validPanels = await reloadMatchTypes();
      setMatchingPanels(validPanels);
      MATCHING_PANELS = validPanels;
      
      // Update match type totals to refresh all panel values and labels
      const totals = await PeriodApi.getMatchTypeTotals();
      setMatchTypeTotals(totals);
      console.log('Match type totals updated after reset:', totals);
      
      alert(`Global reset completed successfully!\nReset ${result.reset_count} transactions across ${result.match_types_reset} match types.`);
    } catch (error) {
      console.error('Failed to perform global reset:', error);
      alert('Failed to perform global reset. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoadingPreview(true);
    try {
      const preview = await PeriodApi.previewFile(file);
      setSelectedFile(file);
      setAvailableColumns(preview.columns || []);
      setPreviewRows(preview.preview_rows || []);
      setIdColumnMapping(null);
      // Automatically show the column mapper modal after file is selected
      setShowIdMapper(true);
    } catch (error) {
      alert(`Error reading file: ${error.message}`);
    } finally {
      setIsLoadingPreview(false);
      event.target.value = '';
    }
  };

  const handleIdColumnChange = (value) => {
    setIdColumnMapping(value);
  };

  const handleDragStart = (e, index) => {
    setDraggedPanel(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverIndex(index);
  };

  const handleDragLeave = () => {
    setDraggedOverIndex(null);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (draggedPanel === null || draggedPanel === dropIndex) {
      setDraggedPanel(null);
      setDraggedOverIndex(null);
      return;
    }

    // Reorder the panels
    const newPanels = [...matchingPanels];
    const draggedItem = newPanels[draggedPanel];
    
    // Remove from old position
    newPanels.splice(draggedPanel, 1);
    
    // Calculate correct insert position
    // If dragging from a higher index to lower, dropIndex is already correct
    // If dragging from a lower index to higher, we need to adjust because we already removed the item
    let insertIndex = dropIndex;
    if (draggedPanel < dropIndex) {
      insertIndex = dropIndex - 1;
    }
    
    // Insert at new position
    newPanels.splice(insertIndex, 0, draggedItem);

    setMatchingPanels(newPanels);
    setDraggedPanel(null);
    setDraggedOverIndex(null);

    // Update the backend with the new order
    try {
      const match_type_keys = newPanels.map((panel) => panel.key);
      await PeriodApi.updateMatchTypeOrder(match_type_keys);
      console.log('Match type order updated successfully');
    } catch (error) {
      console.error('Failed to update match type order:', error);
      alert(`Failed to update order: ${error.message}`);
      // Revert the local change
      reloadMatchTypes()
        .then((validPanels) => {
          setMatchingPanels(validPanels);
          MATCHING_PANELS = validPanels;
        })
        .catch((err) => console.error('Failed to reload match types:', err));
    }
  };

  const handleSettingsUpdate = async (settings) => {
    try {
      // Update the panel in local state
      setMatchingPanels((prev) =>
        prev.map((panel) =>
          panel.key === settings.key
            ? {
                ...panel,
                title: settings.title,
                description: settings.description,
                type: settings.type,
                is_active: settings.is_active,
                parameters: settings.parameters,
              }
            : panel
        )
      );

      // Update the backend
      await PeriodApi.updateMatchTypeSettings(settings.key, {
        title: settings.title,
        description: settings.description,
        type: settings.type,
        is_active: settings.is_active,
        parameters: settings.parameters,
      });
      console.log('Panel settings updated successfully');
    } catch (error) {
      console.error('Failed to update panel settings:', error);
      alert(`Failed to update settings: ${error.message}`);
      // Revert to previous state
      reloadMatchTypes()
        .then((validPanels) => {
          setMatchingPanels(validPanels);
          MATCHING_PANELS = validPanels;
        })
        .catch((err) => console.error('Failed to reload match types:', err));
    }
  };

  const handleDragEnd = () => {
    setDraggedPanel(null);
    setDraggedOverIndex(null);
  };

  const createResetHandler = (panelKey, stateKey, resetMethod) => {
    return async () => {
      const confirmed = window.confirm('Are you sure you want to reset this matching? This will clear all matched records.');
      if (!confirmed) return;

      try {
        // Grey out the panel and show spinner
        setResettingPanels((prev) => ({ ...prev, [panelKey]: true }));
        
        // Call the reset method function if it exists
        if (resetMethod && typeof resetMethod === 'function') {
          await resetMethod();
        }
        
        // Reload panels from API to get updated totals
        Promise.all([
          reloadMatchTypes(),
          PeriodApi.getMatchTypeTotals()
        ])
          .then(([validPanels, totals]) => {
            if (validPanels && validPanels.length > 0) {
              setMatchingPanels(validPanels);
              MATCHING_PANELS = validPanels;
            } else {
              console.warn('No match types returned, keeping existing panels');
            }
            
            if (totals) {
              setMatchTypeTotals(totals);
            }
            
            // Remove greyed-out state
            setResettingPanels((prev) => {
              const updated = { ...prev };
              delete updated[panelKey];
              return updated;
            });
          })
          .catch((error) => {
            console.error('Failed to reload match types or totals:', error);
            // Remove greyed-out state even on error
            setResettingPanels((prev) => {
              const updated = { ...prev };
              delete updated[panelKey];
              return updated;
            });
          });
      } catch (error) {
        alert(`Reset failed: ${error.message}`);
        // Remove greyed-out state on error
        setResettingPanels((prev) => {
          const updated = { ...prev };
          delete updated[panelKey];
          return updated;
        });
      }
    };
  };

  const createSimpleMatchHandler = (matcherName, stateSetter, apiFn, stateKey) => {
    return async () => {
      stateSetter(true);
      const matchId = `${matcherName}-${Date.now()}`;
      const startTime = Date.now();
      
      // Start tracking elapsed time for this operation
      setMatchStartTimes((prev) => ({ ...prev, [stateKey]: startTime }));
      
      setMatchingFiles((prev) => [
        ...prev,
        {
          id: matchId,
          fileName: `${matcherName} Matching`,
          currentRows: 0,
          totalRows: 1,
          percentage: 0,
          status: null,
          errorMessage: null,
        },
      ]);

      let progressInterval;
      try {
        progressInterval = setInterval(() => {
          const elapsedTime = (Date.now() - startTime) / 1000;
          const simProgress = 5 + 94 * (1 - Math.exp(-elapsedTime / 2));
          
          setMatchingFiles((prev) =>
            prev.map((task) => {
              if (task.id === matchId && task.percentage < 99) {
                return {
                  ...task,
                  currentRows: 1,
                  percentage: Math.ceil(simProgress),
                };
              }
              return task;
            })
          );
          
          // Update progress in stats
          setMatchingStats((prev) => ({
            ...prev,
            [stateKey]: {
              ...prev[stateKey],
              progress: Math.ceil(simProgress),
            },
          }));
        }, 300);

        const result = await apiFn();

        clearInterval(progressInterval);

        // Update matching stats with final results
        setMatchingStats((prev) => ({
          ...prev,
          [stateKey]: {
            count: result.matched_count || 0,
            total: result.matched_total || 0,
            progress: 100,
          },
        }));

        setMatchingFiles((prev) =>
          prev.map((task) =>
            task.id === matchId
              ? {
                  ...task,
                  status: 'completed',
                  currentRows: 1,
                  percentage: 100,
                }
              : task
          )
        );

        setTimeout(() => {
          setMatchingFiles((prev) => prev.filter((task) => task.id !== matchId));
          // Stop tracking elapsed time
          setMatchStartTimes((prev) => {
            const updated = { ...prev };
            delete updated[stateKey];
            return updated;
          });
          // Reset progress to hide progress bar
          setMatchingStats((prev) => ({
            ...prev,
            [stateKey]: {
              ...prev[stateKey],
              progress: 0,
            },
          }));
          // Reload panels from API to get updated totals
          reloadMatchTypes()
            .then((validPanels) => {
              if (validPanels && validPanels.length > 0) {
                setMatchingPanels(validPanels);
                MATCHING_PANELS = validPanels;
              } else {
                console.warn('No match types returned, keeping existing panels');
              }
            })
            .catch((error) => {
              console.error('Failed to reload match types, keeping existing panels:', error);
            });
          
          // Reload match type totals to refresh frontend values
          PeriodApi.getMatchTypeTotals()
            .then((totals) => {
              console.log('Loaded match type totals:', totals);
              setMatchTypeTotals(totals);
            })
            .catch((error) => {
              console.error('Failed to load match type totals:', error);
            });
        }, 3000);
      } catch (error) {
        if (progressInterval) clearInterval(progressInterval);
        setMatchingFiles((prev) =>
          prev.map((task) =>
            task.id === matchId
              ? { ...task, status: 'error', errorMessage: error.message }
              : task
          )
        );
        setMatchingStats((prev) => ({
          ...prev,
          [stateKey]: {
            ...prev[stateKey],
            progress: 0,
          },
        }));
      } finally {
        stateSetter(false);
      }
    };
  };

  // Create handlers map dynamically based on loaded panels
  const createHandlers = (panels) => {
    const handlers = {};
    
    panels.forEach((panel) => {
      if (panel.type === 'File') {
        // Special handler for all file-based matching types - trigger file input when user clicks "Start"
        handlers[panel.key] = () => {
          // Reset previous selections and set the current file match key
          setCurrentFileMatchKey(panel.key);
          setSelectedFile(null);
          setAvailableColumns([]);
          setPreviewRows([]);
          setIdColumnMapping(null);
          // Trigger the hidden file input to open file selector
          fileInputRef.current?.click();
        };
        // Add reset handler for file matching
        handlers[`${panel.key}-reset`] = createResetHandler(
          panel.key,
          panel.key,
          () => PeriodApi.resetByKey(panel.key)
        );
      } else {
        // Route to correct API method based on match type
        let apiMethod;
        if (panel.type === 'OneToMany') {
          apiMethod = () => PeriodApi.matchOneToMany(panel.key);
        } else {
          // Default to OneToOne for OneToOne type
          apiMethod = () => PeriodApi.matchOneToOne(panel.key);
        }
        
        handlers[panel.key] = createSimpleMatchHandler(
          panel.title,
          () => {},
          apiMethod,
          panel.key
        );
        // Use universal reset endpoint
        handlers[`${panel.key}-reset`] = createResetHandler(
          panel.key,
          panel.key,
          () => PeriodApi.resetByKey(panel.key)
        );
      }
    });
    
    return handlers;
  };

  const handlersMap = createHandlers(matchingPanels);

  const handleConfirmMatch = async () => {
    console.log('Starting file match, matchingPanels:', matchingPanels);
    if (!selectedFile || !idColumnMapping) {
      console.warn('No file or column mapping selected');
      return;
    }

    const matchId = `${selectedFile.name}-${Date.now()}`;
    const selectedFileName = selectedFile.name;
    const startTime = Date.now();
    
    // Start tracking elapsed time for file matching
    setMatchStartTimes((prev) => ({ ...prev, [currentFileMatchKey]: startTime }));
    
    setMatchingFiles((prev) => [
      ...prev,
      {
        id: matchId,
        fileName: selectedFileName,
        currentRows: 0,
        totalRows: 0,
        percentage: 0,
        status: null,
        errorMessage: null,
      },
    ]);
    
    setShowIdMapper(false);
    setPreviewRows([]);
    setAvailableColumns([]);

    try {
      const fileText = await selectedFile.text();
      const lines = fileText.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length < 2) {
        throw new Error('File must contain at least a header and one data row');
      }

      const headerLine = lines[0];
      const headers = headerLine.split(',').map(h => h.trim());
      const columnIndex = headers.indexOf(idColumnMapping);
      
      if (columnIndex === -1) {
        throw new Error(`Column "${idColumnMapping}" not found in file`);
      }

      const ids = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const id = values[columnIndex];
        if (id && id !== '') {
          ids.push(id);
        }
      }

      if (ids.length === 0) {
        throw new Error('No valid IDs found in the selected column');
      }

      setMatchingFiles((prev) =>
        prev.map((task) =>
          task.id === matchId
            ? {
                ...task,
                totalRows: ids.length,
                currentRows: Math.ceil(ids.length * 0.05),
                percentage: 5,
              }
            : task
        )
      );

      // Update matchingStats for file matching progress display
      setMatchingStats((prev) => ({
        ...prev,
        [currentFileMatchKey]: {
          ...prev[currentFileMatchKey],
          progress: 5,
        },
      }));

      const progressInterval = setInterval(() => {
        setMatchingFiles((prev) =>
          prev.map((task) => {
            if (task.id === matchId && task.percentage < 99) {
              const elapsedTime = (Date.now() - matchId.split('-')[1]) / 1000;
              const simProgress = 5 + 94 * (1 - Math.exp(-elapsedTime / 2));
              return {
                ...task,
                currentRows: Math.ceil(ids.length * (simProgress / 100)),
                percentage: Math.ceil(simProgress),
              };
            }
            return task;
          })
        );
        
        // Also update matchingStats progress
        setMatchingStats((prev) => {
          if (prev[currentFileMatchKey].progress < 99) {
            const newProgress = prev[currentFileMatchKey].progress + 1;
            return {
              ...prev,
              [currentFileMatchKey]: {
                ...prev[currentFileMatchKey],
                progress: newProgress,
              },
            };
          }
          return prev;
        });
      }, 300);

      await PeriodApi.matchFromFile(currentFileMatchKey, { ids, idColumn: idColumnMapping }).then((response) => {
        // Update matchTypeTotals with the response data from backend
        if (response && response.matched_count !== undefined && response.matched_total_amount !== undefined) {
          console.log('Match from file response:', response);
          
          // Immediately reload match type totals and panels to update all stats
          Promise.all([
            reloadMatchTypes(),
            PeriodApi.getMatchTypeTotals()
          ])
            .then(([validPanels, totals]) => {
              console.log('Updated match type totals after file match:', totals);
              
              if (validPanels && validPanels.length > 0) {
                setMatchingPanels(validPanels);
                MATCHING_PANELS = validPanels;
              }
              
              if (totals) {
                setMatchTypeTotals(totals);
              }
            })
            .catch((err) => console.error('Failed to reload totals:', err));
        }
      });

      clearInterval(progressInterval);

      setMatchingFiles((prev) =>
        prev.map((task) =>
          task.id === matchId
            ? {
                ...task,
                status: 'completed',
                currentRows: ids.length,
                percentage: 100,
              }
            : task
        )
      );

      // Set progress to 100% in matchingStats
      setMatchingStats((prev) => ({
        ...prev,
        [currentFileMatchKey]: {
          ...prev[currentFileMatchKey],
          progress: 100,
        },
      }));

      setTimeout(() => {
        setMatchingFiles((prev) => prev.filter((task) => task.id !== matchId));
        setSelectedFile(null);
        setIdColumnMapping(null);
        
        // Stop tracking elapsed time and reset progress
        setMatchStartTimes((prev) => {
          const updated = { ...prev };
          delete updated[currentFileMatchKey];
          return updated;
        });

        // Reset progress bar
        setMatchingStats((prev) => ({
          ...prev,
          [currentFileMatchKey]: {
            ...prev[currentFileMatchKey],
            progress: 0,
          },
        }));
        
        // Reload panels and match type totals from API to get updated data
        // Only update if we get valid data back
        Promise.all([
          reloadMatchTypes(),
          PeriodApi.getMatchTypeTotals()
        ])
          .then(([validPanels, totals]) => {
            console.log('Reloaded match types after file match:', validPanels);
            console.log('Reloaded match type totals:', totals);
            
            if (validPanels && validPanels.length > 0) {
              setMatchingPanels(validPanels);
              MATCHING_PANELS = validPanels;
            } else {
              console.warn('No match types returned from API, keeping existing panels');
            }
            
            if (totals) {
              setMatchTypeTotals(totals);
            }
          })
          .catch((error) => {
            console.error('Failed to reload match types or totals, keeping existing data:', error);
          });
      }, 3000);
    } catch (error) {
      console.error('Error in handleConfirmMatch:', error);
      setMatchingFiles((prev) =>
        prev.map((task) =>
          task.id === matchId
            ? { ...task, status: 'error', errorMessage: error.message }
            : task
        )
      );
    }
  };

  return (
    <>
      {/* Hidden file input for file matching - triggered when user clicks "Start" for fromFile match type */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt,.xlsx,.xls"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        aria-label="Select file for ID matching"
      />
      <div style={{ padding: '20px' }}>
        {matchingPanels.length === 0 ? (
          <div>Loading panels...</div>
        ) : (
          <>
            {/* All Matching Panels */}
            <div style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, color: 'var(--text)' }}>Matching Panels</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {Object.values(resettingPanels).some(Boolean) && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        animation: 'spin 1s linear infinite',
                        fontSize: '16px',
                      }}
                      title="Resetting panel..."
                    >
                      ⟳
                    </div>
                  )}
                  <button
                  onClick={handleRefreshPanels}
                  disabled={isRefreshing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px 12px',
                    border: '1px solid var(--warning)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--warning)',
                    color: '#1f2a44',
                    cursor: isRefreshing ? 'not-allowed' : 'pointer',
                    opacity: isRefreshing ? 0.6 : 1,
                    transition: 'all 200ms ease',
                    fontSize: '13px',
                    fontWeight: '500',
                  }}
                  onMouseEnter={(e) => {
                    if (!isRefreshing) {
                      e.target.style.backgroundColor = '#e08a1a';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'var(--warning)';
                  }}
                  title="Refresh panels and stats"
                >
                  {isRefreshing ? '⟳ Refreshing...' : '↻ Refresh'}
                </button>

                <button
                  onClick={handleGlobalReset}
                  disabled={isRefreshing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px 12px',
                    border: '1px solid #c82333',
                    borderRadius: '4px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    cursor: isRefreshing ? 'not-allowed' : 'pointer',
                    opacity: isRefreshing ? 0.6 : 1,
                    transition: 'all 200ms ease',
                    fontSize: '13px',
                    fontWeight: '500',
                  }}
                  onMouseEnter={(e) => {
                    if (!isRefreshing) {
                      e.target.style.backgroundColor = '#c82333';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#dc3545';
                  }}
                  title="Reset ALL transactions to unreconciled"
                >
                  🗑 Reset All
                </button>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px',
                }}
              >
                {matchingPanels.map((panel, index) => {
                  const panelTotals = matchTypeTotals.match_types?.[panel.key] || { count: 0, total: 0 };
                  return (
                  <div
                    key={`panel-${panel.key}-${index}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDraggedOverIndex(index);
                    }}
                    onDragLeave={() => setDraggedOverIndex(null)}
                    onDrop={(e) => handleDrop(e, index)}
                    style={{
                      opacity: draggedPanel === index ? 0.5 : 1,
                      border: draggedOverIndex === index ? '2px dashed var(--primary)' : 'none',
                      borderRadius: '4px',
                      transition: 'opacity 200ms ease, border 200ms ease',
                    }}
                  >
                    <MatchingPanel
                      title={panel.title}
                      description={panel.description}
                      isMatching={matchingStats[panel.key]?.progress > 0}
                      progress={matchingStats[panel.key]?.progress || 0}
                      count={panelTotals.count}
                      total={panelTotals.total}
                      isCompleted={panelTotals.count > 0}
                      elapsedTime={matchingStats[panel.key]?.progress > 0 ? (elapsedTimes[panel.key] || 0) : (panelTotals.elapsed_time || 0)}
                      status={panel.status || 'pending'}
                      onClickStart={handlersMap[panel.key]}
                      onClickReset={handlersMap[`${panel.key}-reset`]}
                      matched_total_amount={matchingStats[panel.key]?.matched_total_amount}
                      disabled={!handlersMap[panel.key] || matchingStats[panel.key]?.progress > 0}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedPanel === index}
                      panelKey={panel.key}
                      onSettingsUpdate={handleSettingsUpdate}
                      isResetting={resettingPanels[panel.key] || false}
                      isActive={panel.is_active !== false}
                      matchType={panel.type}
                      parameters={panel.parameters}
                    />
                  </div>
                  );
                })}
                {/* Drop zone for last position */}
                {draggedPanel !== null && draggedPanel !== matchingPanels.length - 1 && (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDraggedOverIndex(matchingPanels.length);
                    }}
                    onDragLeave={() => setDraggedOverIndex(null)}
                    onDrop={(e) => handleDrop(e, matchingPanels.length)}
                    style={{
                      minHeight: '200px',
                      border: draggedOverIndex === matchingPanels.length ? '2px dashed var(--primary)' : '2px dashed var(--border)',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--muted)',
                      fontSize: '14px',
                      transition: 'all 200ms ease',
                      backgroundColor: draggedOverIndex === matchingPanels.length ? 'rgba(0, 120, 212, 0.05)' : 'transparent',
                    }}
                  >
                    Drop here for last position
                  </div>
                )}
              </div>
            </div>

            {/* Summary Panel */}
            <div style={{ marginTop: '30px', padding: '20px', backgroundColor: 'var(--surface-alt)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h2 style={{ marginTop: 0, marginBottom: '15px', color: 'var(--text)' }}>Summary - All Matches</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                {/* Matched Count */}
                <div style={{ padding: '15px', backgroundColor: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px', fontWeight: '500' }}>Matched Count</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {(matchTypeTotals.overall?.count_matched || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                    Transactions matched across all matchers
                  </div>
                </div>

                {/* Matched Balance */}
                <div style={{ padding: '15px', backgroundColor: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px', fontWeight: '500' }}>Matched Balance</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: (matchTypeTotals.overall?.total_matched || 0) !== 0 ? 'var(--error)' : 'var(--text)' }}>
                    {(matchTypeTotals.overall?.total_matched || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                    Total value matched
                  </div>
                </div>

                {/*  Unreconciled Count */}
                <div style={{ padding: '15px', backgroundColor: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px', fontWeight: '500' }}> Unreconciled Count</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text)' }}>
                    {(matchTypeTotals.overall?.count_unreconciled || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                    Transactions still to be matched
                  </div>
                </div>

                {/*  Unreconciled Amount */}
                <div style={{ padding: '15px', backgroundColor: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px', fontWeight: '500' }}>Unreconciled Amount</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#FF9800' }}>
                    {(matchTypeTotals.overall?.total_unreconciled || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                    Total value still unreconciled
                  </div>
                </div>
              </div>

              {/* Breakdown by Matcher */}
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '12px', fontWeight: '500' }}>Breakdown by Matcher</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {matchingPanels.map((panel) => {
                    const totals = matchTypeTotals.match_types?.[panel.key] || { count: 0, total: 0 };
                    return (
                      <div key={panel.key} style={{ padding: '12px', backgroundColor: 'var(--surface-alt)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', fontWeight: '500' }}>{panel.title}</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: totals.count > 0 ? 'var(--primary)' : 'var(--muted)' }}>
                          {totals.count}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                          {totals.total > 0 ? `$${totals.total.toFixed(2)}` : '$0.00'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <IDColumnMapperModal
        isOpen={showIdMapper}
        fileName={selectedFile?.name}
        previewRows={previewRows}
        availableColumns={availableColumns}
        selectedIdColumn={idColumnMapping}
        onIdColumnChange={handleIdColumnChange}
        onConfirm={handleConfirmMatch}
        onFileSelect={handleFileSelect}
        hasFileSelected={selectedFile !== null}
        onCancel={() => {
          setShowIdMapper(false);
          setSelectedFile(null);
          setPreviewRows([]);
          setAvailableColumns([]);
          setIdColumnMapping(null);
        }}
        isLoading={false}
      />
    </>
  );
}

      