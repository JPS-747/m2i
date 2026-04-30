import PeriodTable from '../components/PeriodTable';

export default function HistoryPage({ periods, banner }) {
  return (
    <>
      <section id="history">
        <PeriodTable periods={periods} />
      </section>

      <section className={`banner banner-${banner.type}`}>{banner.message}</section>
    </>
  );
}
