export default function StatusBadge({ status }) {
  const normalized = (status || 'unknown').toLowerCase();
  return <span className={`badge badge-${normalized}`}>{normalized}</span>;
}
