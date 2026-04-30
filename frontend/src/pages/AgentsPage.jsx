import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AgentApi } from '../api/agentApi';

// Debounce helper
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const AgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const debounceTimerRef = useRef(null);
  
  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, unreconciled, reconciled
  const [sourceFilter, setSourceFilter] = useState('all'); // all, Bank, System
  const [policyNoFilter, setPolicyNoFilter] = useState(''); // empty or specific PolicyNo
  const [periodFilter, setPeriodFilter] = useState(''); // empty or specific period
  const [agentNameFilter, setAgentNameFilter] = useState(''); // SPECIAL: filter by agent name
  const [actionFilter, setActionFilter] = useState(''); // SPECIAL: filter by action
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  
  // Pagination - now server-side aware
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalPages, setTotalPages] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [excludedRows, setExcludedRows] = useState(new Set()); // Track excluded transaction IDs

  // Toggle exclude for a transaction
  const toggleExcludeRow = (txnId) => {
    setExcludedRows((prev) => {
      const updated = new Set(prev);
      if (updated.has(txnId)) {
        updated.delete(txnId);
      } else {
        updated.add(txnId);
      }
      return updated;
    });
  };

  // Calculate Bank Total, System Total, and Balance
  const { bankTotal, systemTotal, balance, minPeriod, maxPeriod, duplicatePolicies } = useMemo(() => {
    let bank = 0;
    let system = 0;
    let minP = null;
    let maxP = null;
    const policyCount = {};
    
    agents.forEach((txn) => {
      // Skip excluded rows
      if (excludedRows.has(txn.id)) {
        return;
      }
      
      if (txn.Source === 'Bank') {
        bank += txn.Amount;
      } else if (txn.Source === 'System') {
        system += txn.Amount;
      }
      
      // Track min/max period
      if (txn.period) {
        const period = parseInt(txn.period);
        minP = minP === null ? period : Math.min(minP, period);
        maxP = maxP === null ? period : Math.max(maxP, period);
      }
      
      // Count PolicyNo occurrences
      if (txn.PolicyNo) {
        policyCount[txn.PolicyNo] = (policyCount[txn.PolicyNo] || 0) + 1;
      }
    });
    
    // Get policies that appear more than once
    const duplicates = Object.keys(policyCount)
      .filter(policy => policyCount[policy] > 1)
      .sort();
    
    return {
      bankTotal: bank,
      systemTotal: system,
      balance: bank - system,
      minPeriod: minP,
      maxPeriod: maxP,
      duplicatePolicies: duplicates,
    };
  }, [agents, excludedRows]);

  // Fetch agents from server with pagination
  useEffect(() => {
    fetchAgentsWithPage(currentPage, pageSize, searchTerm, statusFilter, sourceFilter, policyNoFilter, periodFilter, agentNameFilter, actionFilter);
  }, [currentPage, pageSize]);

  // Handle sort changes
  useEffect(() => {
    fetchAgentsWithPage(currentPage, pageSize, searchTerm, statusFilter, sourceFilter, policyNoFilter, periodFilter, agentNameFilter, actionFilter);
  }, [sortConfig]);

  const handleSearch = () => {
    console.log('[handleSearch] Button clicked, searchTerm:', searchTerm);
    setCurrentPage(1);
    // Fetch with current search term and filters
    fetchAgentsWithPage(1, pageSize, searchTerm, statusFilter, sourceFilter, policyNoFilter, periodFilter, agentNameFilter, actionFilter);
  };

  const handleFilter = () => {
    console.log('[handleFilter] Filter button clicked');
    setCurrentPage(1);
    // Fetch with current filters
    fetchAgentsWithPage(1, pageSize, searchTerm, statusFilter, sourceFilter, policyNoFilter, periodFilter, agentNameFilter, actionFilter);
  };

  const fetchAgentsWithPage = async (page, size, term, status, source, policyNo, period, agentName, action) => {
    console.log('[fetchAgentsWithPage] Fetching with page:', page, 'pageSize:', size, 'search:', term, 'filters:', { status, source, policyNo, period, agentName, action }, 'sort:', sortConfig);
    setLoading(true);
    setError(null);
    try {
      const response = await AgentApi.getAgentHistory(
        page, 
        size, 
        term, 
        status === 'all' ? '' : status,
        source === 'all' ? '' : source,
        policyNo,
        period,
        agentName,
        action,
        sortConfig.key,
        sortConfig.direction
      );
      console.log('API Response:', response);
      console.log('Agents fetched:', response.transactions?.length || 0, 'records');
      setAgents(response.transactions || []);
      setTotalCount(response.total_count || 0);
      setTotalAmount(response.total_amount || 0);
      setTotalPages(response.total_pages || 0);
    } catch (err) {
      setError(err.message || 'Failed to fetch agents');
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    // Convert to CSV, excluding rows marked for exclusion
    const headers = [
      'ID',
      'Amount',
      'Type',
      'Source',
      'PolicyNo',
      'FileOrigin',
      'LineNo',
      'MovementType',
      'Reference',
      'Status',
      'MatchType',
      'Period',
      'Created At',
    ];
    
    const rows = agents
      .filter((txn) => !excludedRows.has(txn.id)) // Exclude rows that are checked
      .map((txn) => {
        const absAmount = Math.abs(txn.Amount);
        const type = txn.Amount < 0 ? 'Debit' : 'Credit';
        return [
          txn.id,
          absAmount,
          type,
          txn.Source,
          txn.PolicyNo,
          txn.FileOrigin,
          txn.LineNo || '',
          txn.MovementType,
          txn.Reference || '',
          txn.status,
          txn.MatchType || '',
          txn.period || '',
          new Date(txn.created_at).toLocaleString(),
        ];
      });
    
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `agents_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Server-side sorting is applied via API call
  // Just use agents as-is since they're already sorted from backend
  const filteredAndSortedAgents = agents;

  // Log results
  console.log('Agents received from server:', {
    count: agents.length,
    sortConfig,
    totalCount,
    totalAmount,
  });

  const SortIcon = ({ field }) => {
    if (sortConfig.key !== field) return <span style={{ opacity: 0.3 }}>⇅</span>;
    return sortConfig.direction === 'asc' ? <span>▲</span> : <span>▼</span>;
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: 'var(--text)' }}>Loading agent transactions...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 20px 0', color: 'var(--text)' }}>Agent Transactions</h1>
        
        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#341818',
            color: '#ffc7c7',
            border: '1px solid #7d2f2f',
            borderRadius: '4px',
            marginBottom: '20px',
          }}>
            Error: {error}
          </div>
        )}

        {/* Search Bar with Button and Page Size */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '15px',
          padding: '12px 15px',
          backgroundColor: 'var(--surface)',
          borderRadius: '4px',
          border: '1px solid var(--border)',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Left: Search input and button */}
          <div style={{
            display: 'flex',
            gap: '8px',
            flex: '0 0 auto',
          }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              style={{
                width: '250px',
                padding: '6px 8px',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = '#0056b3')}
              onMouseLeave={(e) => (e.target.style.backgroundColor = 'var(--primary)')}
            >
              🔍 Search
            </button>
          </div>

          {/* Right: Page Size */}
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flex: '0 0 auto',
          }}>
            <label style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              Page Size:
            </label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 8px',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: 'var(--surface)',
          borderRadius: '4px',
          border: '1px solid var(--border)',
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
              }}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="unreconciled">Unreconciled</option>
              <option value="reconciled">Reconciled</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
              Source
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
              }}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            >
              <option value="all">All Sources</option>
              <option value="Bank">Bank</option>
              <option value="System">System</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
              PolicyNo
            </label>
            <input
              type="text"
              placeholder="Enter PolicyNo..."
              value={policyNoFilter}
              onChange={(e) => {
                setPolicyNoFilter(e.target.value);
              }}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
              Period
            </label>
            <input
              type="text"
              placeholder="Enter period (e.g., 202301)..."
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value);
              }}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
              Agent Name (Special)
            </label>
            <input
              type="text"
              placeholder="Enter agent name..."
              value={agentNameFilter}
              onChange={(e) => {
                setAgentNameFilter(e.target.value);
              }}
              style={{
                width: '100%',
                padding: '8px',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '13px',
                backgroundColor: '#2a4a6a',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
              Action (Special)
            </label>
            <input
              type="text"
              placeholder="Enter action..."
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
              }}
              style={{
                width: '100%',
                padding: '8px',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '13px',
                backgroundColor: '#2a4a6a',
              }}
            />
          </div>

          {/* Apply Filter Button */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={handleFilter}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = '#0056b3')}
              onMouseLeave={(e) => (e.target.style.backgroundColor = 'var(--primary)')}>
              🔽 Apply Filter
            </button>
          </div>
        </div>

        {/* Stats and Export */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          padding: '12px 15px',
          backgroundColor: 'var(--surface)',
          borderRadius: '4px',
          border: '1px solid var(--border)',
          fontSize: '13px',
          color: 'var(--muted)',
        }}>
          <div>
            Showing page <strong>{currentPage}</strong> of <strong>{totalPages || 1}</strong> ({filteredAndSortedAgents.length} filtered records on this page, Total in database: <strong>{totalCount}</strong>)
          </div>
          <button
            onClick={handleExport}
            style={{
              padding: '6px 12px',
              backgroundColor: '#2ac37b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = '#1da35f')}
            onMouseLeave={(e) => (e.target.style.backgroundColor = '#2ac37b')}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div style={{
        overflowX: 'auto',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        backgroundColor: 'var(--surface)',
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
        }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-alt)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px', textAlign: 'center', width: '50px' }}>
                Exclude
              </th>
              <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('id')}>
                ID <SortIcon field="id" />
              </th>
              <th style={{ padding: '12px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('Amount')}>
                Amount <SortIcon field="Amount" />
              </th>
              <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('type')}>
                Type <SortIcon field="type" />
              </th>
              <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('Source')}>
                Source <SortIcon field="Source" />
              </th>
              <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('PolicyNo')}>
                PolicyNo <SortIcon field="PolicyNo" />
              </th>
              <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('FileOrigin')}>
                FileOrigin <SortIcon field="FileOrigin" />
              </th>
              <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('LineNo')}>
                LineNo <SortIcon field="LineNo" />
              </th>
              <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('MovementType')}>
                MovementType <SortIcon field="MovementType" />
              </th>
              <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('Reference')}>
                Reference <SortIcon field="Reference" />
              </th>
              <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('status')}>
                Status <SortIcon field="status" />
              </th>
              <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('MatchType')}>
                MatchType <SortIcon field="MatchType" />
              </th>
              <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('period')}>
                Period <SortIcon field="period" />
              </th>
              <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('created_at')}>
                Created At <SortIcon field="created_at" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedAgents.length === 0 ? (
              <tr>
                <td colSpan="14" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                  No agent transactions found
                </td>
              </tr>
            ) : (
              filteredAndSortedAgents.map((txn, idx) => (
                <tr
                  key={txn.id}
                  style={{
                    backgroundColor: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-alt)',
                    borderBottom: '1px solid var(--border)',
                    opacity: excludedRows.has(txn.id) ? 0.5 : 1,
                  }}
                >
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={excludedRows.has(txn.id)}
                      onChange={() => toggleExcludeRow(txn.id)}
                      style={{ cursor: 'pointer' }}
                      title="Check to exclude this row from totals"
                    />
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>
                    {txn.id.substring(0, 8)}...
                  </td>
                  <td style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    color: 'var(--text)',
                    fontWeight: '500',
                  }}>
                    {Math.abs(txn.Amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '2px 6px',
                      backgroundColor: txn.Amount < 0 ? '#dc3545' : '#28a745',
                      color: 'white',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: '500',
                    }}>
                      {txn.Amount < 0 ? 'Debit' : 'Credit'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '2px 6px',
                      backgroundColor: txn.Source === 'Bank' ? '#1e40af' : '#991b1b',
                      color: 'white',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: '500',
                    }}>
                      {txn.Source}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{txn.PolicyNo}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--muted)' }}>
                    {txn.FileOrigin}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', textAlign: 'center' }}>
                    {txn.LineNo || '-'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{txn.MovementType}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--muted)' }}>
                    {txn.Reference || '-'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '2px 6px',
                      backgroundColor: txn.status === 'reconciled' ? '#15803d' : '#7d2f2f',
                      color: txn.status === 'reconciled' ? '#86efac' : '#fca5a5',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: '500',
                    }}>
                      {txn.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {txn.MatchType ? (
                      <span style={{
                        padding: '2px 6px',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontWeight: '500',
                      }}>
                        {txn.MatchType}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: '500', color: 'var(--text)' }}>
                    {txn.period || '-'}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--muted)' }}>
                    {new Date(txn.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      {totalCount > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '15px',
          marginTop: '15px',
          padding: '15px',
          backgroundColor: 'var(--surface)',
          borderRadius: '4px',
          border: '1px solid var(--border)',
          fontSize: '13px',
          fontWeight: '500',
          color: 'var(--text)',
        }}>
          <div style={{
            padding: '10px 12px',
            backgroundColor: 'var(--surface-alt)',
            borderRadius: '3px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ color: 'var(--muted)', fontSize: '11px', marginBottom: '4px' }}>Bank Total</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: bankTotal < 0 ? '#dc3545' : '#28a745' }}>
              {Math.abs(bankTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <div style={{
            padding: '10px 12px',
            backgroundColor: 'var(--surface-alt)',
            borderRadius: '3px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ color: 'var(--muted)', fontSize: '11px', marginBottom: '4px' }}>System Total</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: systemTotal < 0 ? '#dc3545' : '#28a745' }}>
              {Math.abs(systemTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <div style={{
            padding: '10px 12px',
            backgroundColor: 'var(--surface-alt)',
            borderRadius: '3px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ color: 'var(--muted)', fontSize: '11px', marginBottom: '4px' }}>Balance (Credit - Debit)</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: balance === 0 ? '#17a2b8' : (balance < 0 ? '#dc3545' : '#28a745') }}>
              {Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <div style={{
            padding: '10px 12px',
            backgroundColor: 'var(--surface-alt)',
            borderRadius: '3px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ color: 'var(--muted)', fontSize: '11px', marginBottom: '4px' }}>Records Count</div>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>
              {totalCount}
            </div>
          </div>

          <div style={{
            padding: '10px 12px',
            backgroundColor: 'var(--surface-alt)',
            borderRadius: '3px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ color: 'var(--muted)', fontSize: '11px', marginBottom: '4px' }}>Period Range</div>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>
              {minPeriod && maxPeriod ? `${minPeriod} - ${maxPeriod}` : '-'}
            </div>
          </div>

          <div style={{
            padding: '10px 12px',
            backgroundColor: 'var(--surface-alt)',
            borderRadius: '3px',
            border: '1px solid var(--border)',
            gridColumn: 'span 1',
          }}>
            <div style={{ color: 'var(--muted)', fontSize: '11px', marginBottom: '4px' }}>Duplicate PolicyNo</div>
            <div style={{ fontSize: '12px', fontWeight: '500', maxHeight: '120px', overflowY: 'auto' }}>
              {duplicatePolicies.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {duplicatePolicies.map((policy) => (
                    <span 
                      key={policy}
                      style={{
                        padding: '2px 6px',
                        backgroundColor: '#ff9800',
                        color: 'white',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontWeight: '600',
                      }}
                    >
                      {policy}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ color: 'var(--muted)' }}>None</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px',
        marginTop: '20px',
        padding: '15px',
        backgroundColor: 'var(--surface)',
        borderRadius: '4px',
        border: '1px solid var(--border)',
      }}>
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{
            padding: '6px 12px',
            backgroundColor: currentPage === 1 ? 'var(--muted)' : 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: '500',
          }}
        >
          ← Previous
        </button>

        <div style={{ color: 'var(--text)', fontSize: '13px', fontWeight: '500' }}>
          Page <input
            type="number"
            min="1"
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const page = Math.max(1, Math.min(totalPages, Number(e.target.value)));
              setCurrentPage(page);
            }}
            style={{
              width: '50px',
              padding: '4px',
              textAlign: 'center',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              fontSize: '13px',
            }}
          /> of {totalPages}
        </div>

        <button
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          style={{
            padding: '6px 12px',
            backgroundColor: currentPage === totalPages ? 'var(--muted)' : 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: '500',
          }}
        >
          Next →
        </button>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '12px 15px',
        backgroundColor: 'var(--surface)',
        borderRadius: '4px',
        border: '1px solid var(--border)',
        fontSize: '12px',
        color: 'var(--muted)',
      }}>
        <strong>Tip:</strong> Click on column headers to sort. Use filters to narrow down results. Special agent-specific filters (Agent Name, Action) are highlighted. Export CSV for further analysis.
      </div>
    </div>
  );
};

export default AgentsPage;
