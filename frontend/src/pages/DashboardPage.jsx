import StatCard from '../components/StatCard';
import PeriodTable from '../components/PeriodTable';

function toDecimal(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function DashboardPage({
  latest,
  periods,
  loading,
  currentAction,
  elapsedTime,
  canActivate,
  canCloseOrOpen,
  onActivate,
  onClose,
  onOpen,
  onRefresh,
}) {
  const formatElapsedTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <>
      <section id="history">
        <PeriodTable 
          periods={periods}
          latest={latest}
          loading={loading}
          currentAction={currentAction}
          elapsedTime={elapsedTime}
          canActivate={canActivate}
          canCloseOrOpen={canCloseOrOpen}
          onActivate={onActivate}
          onClose={onClose}
          onOpen={onOpen}
          onRefresh={onRefresh}
        />
      </section>
    </>
  );
}
