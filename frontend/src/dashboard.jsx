import { useEffect, useMemo, useState } from 'react';
import AdminLayout from './layout/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import SystemFilesPage from './pages/SystemFilesPage';
import BankFilesPage from './pages/BankFilesPage';
import MatchingPage from './pages/MatchingPage';
import TransactionsPage from './pages/TransactionsPage';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
import { PeriodApi } from './api/periodApi';

const MENU_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    title: 'Dashboard',
    subtitle: 'Summary, actions, and history for financial periods',
  },
  {
    id: 'system-files',
    label: 'System Files',
    title: 'System Files',
    subtitle: 'Summary of imported System files',
  },
  {
    id: 'bank-files',
    label: 'Bank Files',
    title: 'Bank Files',
    subtitle: 'Summary of imported Bank files',
  },
  {
    id: 'match',
    label: 'Match',
    title: 'Match Records',
    subtitle: 'Match transactions from file or suspense account',
  },
  {
    id: 'transactions',
    label: 'Transactions',
    title: 'All Transactions',
    subtitle: 'View, search, filter, and export all unreconciled transactions',
  },
  {
    id: 'transaction-history',
    label: 'Transaction History',
    title: 'Transaction History',
    subtitle: 'View, search, filter, and export all transaction history',
  },
];

export default function App() {
  const [selectedPage, setSelectedPage] = useState('dashboard');
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });
  const [latest, setLatest] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [systemFiles, setSystemFiles] = useState([]);
  const [bankFiles, setBankFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState(null); // Track which action (Activate/Close/Open) is running
  const [importingSystem, setImportingSystem] = useState(false);
  const [importingBank, setImportingBank] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [deletingSystemRows, setDeletingSystemRows] = useState(new Set());
  const [deletingBankRows, setDeletingBankRows] = useState(new Set());
  const [banner, setBanner] = useState({ type: 'info', message: 'Loading dashboard...', progress: null });
  const [actionStartTime, setActionStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const refresh = async () => {
    setCurrentAction('Refreshing');
    setLoading(true);
    
    try {
      const [latestPeriod, latest12, systemSummary, bankSummary, matchTypesTotals] = await Promise.all([
        PeriodApi.latest(),
        PeriodApi.latest12(),
        PeriodApi.systemFilesSummary(),
        PeriodApi.bankFilesSummary(),
        PeriodApi.getMatchTypeTotals(),
      ]);
      setLatest(latestPeriod);
      setPeriods(latest12);
      setSystemFiles(systemSummary);
      setBankFiles(bankSummary);
      setBanner({ type: 'success', message: 'Dashboard synced successfully.' });
    } catch (error) {
      setBanner({ type: 'error', message: `Refresh failed: ${error.message}` });
    } finally {
      setLoading(false);
      setCurrentAction(null);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  // Track elapsed time during action execution
  useEffect(() => {
    if (!loading || !actionStartTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - actionStartTime) / 1000);
      setElapsedTime(elapsed);
    }, 100);

    return () => clearInterval(interval);
  }, [loading, actionStartTime]);

  const currentPage = useMemo(
    () => MENU_ITEMS.find((item) => item.id === selectedPage) || MENU_ITEMS[0],
    [selectedPage]
  );

  const latestStatus = (latest?.status || '').toLowerCase();
  const canActivate = latestStatus === 'open';
  const canCloseOrOpen = latestStatus === 'active';
  const canImportFiles = latestStatus === 'open';
  const canMatch = latestStatus === 'active';

  // Check if any file operations are running
  const isOperating =
    loading ||
    importingSystem ||
    importingBank ||
    deletingSystemRows.size > 0 ||
    deletingBankRows.size > 0;

  // Generate dynamic message based on current operations
  const getOperatingMessage = () => {
    const messages = [];
    
    if (loading && currentAction) {
      messages.push(`${currentAction} in progress...`);
    }
    
    if (importingSystem) {
      messages.push('Importing System file...');
    }
    
    if (importingBank) {
      messages.push('Importing Bank file...');
    }
    
    if (deletingSystemRows.size > 0) {
      messages.push(`Deleting ${deletingSystemRows.size} System file${deletingSystemRows.size > 1 ? 's' : ''}...`);
    }
    
    if (deletingBankRows.size > 0) {
      messages.push(`Deleting ${deletingBankRows.size} Bank file${deletingBankRows.size > 1 ? 's' : ''}...`);
    }
    
    return messages.length > 0 ? messages.join(', ') : '';
  };

  // Update banner message when operations change
  const operatingMessage = getOperatingMessage();
  useEffect(() => {
    if (operatingMessage && isOperating) {
      setBanner({ type: 'info', message: operatingMessage });
    }
  }, [operatingMessage, isOperating]);

  const importSystemFile = async (file, columnMapping, columnTransformations, onProgress) => {
    if (!canImportFiles) {
      setBanner({ type: 'error', message: 'Import allowed only when current period status is open.' });
      return;
    }
    setImportingSystem(true);
    
    try {
      const result = columnMapping
        ? await PeriodApi.importSystemFileWithMapping(file, columnMapping, columnTransformations, onProgress)
        : await PeriodApi.importSystemFile(file, onProgress);
      setBanner({
        type: 'success',
        message: `Successfully imported ${result.inserted_count} rows from ${result.FileOrigin} into period ${result.period}.`,
      });
      await refresh();
    } catch (error) {
      setBanner({ type: 'error', message: `Import failed: ${error.message}` });
    } finally {
      setImportingSystem(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const importBankFile = async (file, columnMapping, columnTransformations, onProgress) => {
    if (!canImportFiles) {
      setBanner({ type: 'error', message: 'Import allowed only when current period status is open.' });
      return;
    }
    setImportingBank(true);
    
    try {
      const result = columnMapping
        ? await PeriodApi.importBankFileWithMapping(file, columnMapping, columnTransformations, onProgress)
        : await PeriodApi.importBankFile(file, onProgress);
      setBanner({
        type: 'success',
        message: `Successfully imported ${result.inserted_count} rows from ${result.FileOrigin} into period ${result.period}.`,
      });
      await refresh();
    } catch (error) {
      setBanner({ type: 'error', message: `Import failed: ${error.message}` });
    } finally {
      setImportingBank(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const deleteSystemFile = async (row) => {
    const confirmed = window.confirm(
      `Delete all System transactions for file '${row.FileOrigin}' (index ${row.file_index})?`
    );
    if (!confirmed) return;

    const rowKey = `${row.FileOrigin}-${row.file_index}`;
    setDeletingSystemRows((prev) => new Set([...prev, rowKey]));

    try {
      const result = await PeriodApi.deleteSystemFile({
        FileOrigin: row.FileOrigin,
        file_index: row.file_index,
      });
      setBanner({
        type: 'success',
        message: `Successfully deleted ${result.deleted_count} transactions for file ${result.FileOrigin}.`,
      });
      // Refresh in background without blocking UI
      refresh().catch((error) => setBanner({ type: 'error', message: error.message }));
    } catch (error) {
      setBanner({ type: 'error', message: `Delete failed: ${error.message}` });
    } finally {
      setDeletingSystemRows((prev) => {
        const updated = new Set(prev);
        updated.delete(rowKey);
        return updated;
      });
    }
  };

  const deleteBankFile = async (row) => {
    const confirmed = window.confirm(
      `Delete all Bank transactions for file '${row.FileOrigin}' (index ${row.file_index})?`
    );
    if (!confirmed) return;

    const rowKey = `${row.FileOrigin}-${row.file_index}`;
    setDeletingBankRows((prev) => new Set([...prev, rowKey]));

    try {
      const result = await PeriodApi.deleteBankFile({
        FileOrigin: row.FileOrigin,
        file_index: row.file_index,
      });
      setBanner({
        type: 'success',
        message: `Successfully deleted ${result.deleted_count} transactions for file ${result.FileOrigin}.`,
      });
      // Refresh in background without blocking UI
      refresh().catch((error) => setBanner({ type: 'error', message: error.message }));
    } catch (error) {
      setBanner({ type: 'error', message: `Delete failed: ${error.message}` });
    } finally {
      setDeletingBankRows((prev) => {
        const updated = new Set(prev);
        updated.delete(rowKey);
        return updated;
      });
    }
  };

  const handleAction = (action, actionLabel, isAllowed) => async () => {
    const period = latest?.period;
    if (!period) {
      setBanner({ type: 'error', message: 'No latest period available yet.' });
      return;
    }

    if (!isAllowed) {
      setBanner({
        type: 'error',
        message: `Action not allowed for status '${latestStatus || 'unknown'}'.`,
      });
      return;
    }

    const confirmed = window.confirm(
      `${actionLabel} period ${period}?\n\nThis operation applies to the current latest period only.`
    );

    if (!confirmed) {
      return;
    }

    setCurrentAction(actionLabel);
    setActionStartTime(Date.now());
    setLoading(true);
    
    try {
      await action(period);
      setBanner({ type: 'success', message: `${actionLabel} completed successfully for period ${period}.` });
      await refresh();
    } catch (error) {
      setBanner({ type: 'error', message: `${actionLabel} failed: ${error.message}` });
      setLoading(false);
    } finally {
      setCurrentAction(null);
      setActionStartTime(null);
    }
  };

  return (
    <AdminLayout
      title={currentPage.title}
      subtitle={currentPage.subtitle}
      menuItems={MENU_ITEMS}
      selectedPage={selectedPage}
      onSelectPage={setSelectedPage}
      isOperating={isOperating}
      operatingMessage={operatingMessage}
      banner={banner}
      disabledMenuItems={canMatch ? [] : ['match']}
      elapsedTime={elapsedTime}
      currentAction={currentAction}
      topbarActions={
        <button
          onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          className="topbar-icon-btn"
          disabled={loading}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
        </button>
      }
    >
      {currentPage.id === 'system-files' ? (
        <SystemFilesPage
          files={systemFiles}
          banner={banner}
          canImport={canImportFiles}
          openPeriod={latest?.period || ''}
          onImport={importSystemFile}
          onDelete={deleteSystemFile}
          importing={importingSystem}
          deletingRows={deletingSystemRows}
        />
      ) : currentPage.id === 'bank-files' ? (
        <BankFilesPage
          files={bankFiles}
          canImport={canImportFiles}
          openPeriod={latest?.period || ''}
          onImport={importBankFile}
          onDelete={deleteBankFile}
          importing={importingBank}
          deletingRows={deletingBankRows}
        />
      ) : currentPage.id === 'match' ? (
        <MatchingPage />
      ) : currentPage.id === 'transactions' ? (
        <TransactionsPage />
      ) : currentPage.id === 'transaction-history' ? (
        <TransactionHistoryPage />
      ) : (
        <DashboardPage
          latest={latest}
          periods={periods}
          loading={loading}
          currentAction={currentAction}
          elapsedTime={elapsedTime}
          canActivate={canActivate}
          canCloseOrOpen={canCloseOrOpen}
          onActivate={handleAction(PeriodApi.activate, 'Activate', canActivate)}
          onClose={handleAction(PeriodApi.close, 'Close', canCloseOrOpen)}
          onOpen={handleAction(PeriodApi.open, 'Open', canCloseOrOpen)}
          onRefresh={refresh}
        />
      )}
    </AdminLayout>
  );
}
