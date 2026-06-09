export default function StatCard({ label, value, subtle }) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <h3 className="stat-value">{value}</h3>
      {subtle ? <p className="stat-subtle">{subtle}</p> : null}
    </div>
  );
}
