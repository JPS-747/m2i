export default function StatCard({ label, value, hint }) {
  return (
    <article className="card stat-card">
      <p className="stat-label">{label}</p>
      <h3>{value}</h3>
      {hint ? <p className="stat-hint">{hint}</p> : null}
    </article>
  );
}
