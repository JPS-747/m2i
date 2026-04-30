import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PeriodApi } from '../api/periodApi';

// Debounce helper
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const TransactionHistoryPage = () => {
  const [transactions, setTransactions] = useState([]);
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
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  
  // Pagination - now server-side aware
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalPages, setTotalPages] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  // Fetch transactions from server with pagination
  useEffect(() => {
    fetchTransactionsWithPage(currentPage, pageSize, searchTerm, statusFilter, sourceFilter, policyNoFilter, periodFilter);
  }, [currentPage, pageSize]);

  // Filter changes no longer trigger automatic fetch - use dedicated Filter button
  // Removed the useEffect that was watching filter state changes

  // Handle sort changes
  useEffect(() => {
    fetchTransactionsWithPage(currentPage, pageSize, searchTerm, statusFilter, sourceFilter, policyNoFilter, periodFilter);
  }, [sortConfig]);

  const handleSearch = () => {
    console.log('[handleSearch] Button clicked, searchTerm:', searchTerm);
    setCurrentPage(1);
    // Fetch with current search term and filters
    fetchTransactionsWithPage(1, pageSize, searchTerm, statusFilter, sourceFilter, policyNoFilter, periodFilter);
  };

  const handleFilter = () => {
    console.log('[handleFilter] Filter button clicked');
    setCurrentPage(1);
    // Fetch with current filters
    fetchTransactionsWithPage(1, pageSize, searchTerm, statusFilter, sourceFilter, policyNoFilter, periodFilter);
  };

  const fetchTransactionsWithPage = async (page, size, term, status, source, policyNo, period) => {
    console.log('[fetchTransactionsWithPage] Fetching with page:', page, 'pageSize:', size, 'search:', term, 'filters:', { status, source, policyNo, period }, 'sort:', sortConfig);
    setLoading(true);
    setError(null);
    try {
      const response = await PeriodApi.getTransactionHistory(
        page, 
        size, 
        term, 
        status, 
        source, 
        policyNo, 
        period,
        sortConfig.key,
        sortConfig.direction
      );
      console.log('API Response:', response);
      console.log('Transactions fetched:', response.transactions?.length || 0, 'records');
      setTransactions(response.transactions || []);
      setTotalCount(response.total_count || 0);
      setTotalAmount(response.total_amount || 0);
      setTotalPages(response.total_pages || 0);
    } catch (err) {
      setError(err.message || 'Failed to fetch transactions');
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    // Convert to CSV
    const headers = [
      'ID',
      'Amount',
      'Type',
      'Source',
      'PolicyNo',
      'FileOrigin',
      'MovementType',
      'Reference',
      'Status',
      'MatchType',
      'Period',
      'Created At',
    ];
    
    const rows = transactions.map((txn) => {
      const absAmount = Math.abs(txn.Amount);
      const type = txn.Amount < 0 ? 'Debit' : 'Credit';
      return [
        txn.id,
        absAmount,
        type,
        txn.Source,
        txn.PolicyNo,
        txn.FileOrigin,
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
    link.download = `transaction-history_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Server-side sorting is applied via API call
  // Just use transactions as-is since they're already sorted from backend
  const filteredAndSortedTransactions = transactions;

  // Log results
  console.log('Transactions received from server:', {
    count: transactions.length,
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
        <div style={{ fontSize: '18px', color: 'var(--text)' }}>Loading transaction history...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 20px 0', color: 'var(--text)' }}>Transaction History</h1>
        
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
            Showing page <strong>{currentPage}</strong> of <strong>{totalPages || 1}</strong> ({filteredAndSortedTransactions.length} filtered records on this page, Total in database: <strong>{totalCount}</strong>)
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
            {filteredAndSortedTransactions.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                  No transactions found
                </td>
              </tr>
            ) : (
              filteredAndSortedTransactions.map((txn, idx) => (
                <tr
                  key={txn.id}
                  style={{
                    backgroundColor: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-alt)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '15px',
          padding: '12px 15px',
          backgroundColor: 'var(--surface)',
          borderRadius: '4px',
          border: '1px solid var(--border)',
          fontSize: '13px',
          fontWeight: '500',
          color: 'var(--text)',
        }}>
          <div>
            <strong>Filtered Records Count:</strong> {totalCount}
          </div>
          <div>
            <strong>Total Amount (Credit - Debit):</strong> {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        <strong>Tip:</strong> Click on column headers to sort. Use filters to narrow down results. Export CSV for further analysis.
      </div>
    </div>
  );
};

export default TransactionHistoryPage;
