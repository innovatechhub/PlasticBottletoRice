import { useMemo } from "react";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";

const formatDateTime = (timestamp) =>
  new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function AdminStatCard({ label, value, sub, subColor, icon }) {
  return (
    <div className="adm-stat-card">
      <div className="adm-stat-top">
        <span className="adm-stat-label">{label}</span>
        <div className="adm-stat-icon">{icon}</div>
      </div>
      <div className="adm-stat-value">{value}</div>
      {sub && (
        <div className={`adm-stat-sub adm-stat-sub--${subColor || "green"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { currentUser } = useAuth();
  const { users, transactions, system } = useData();

  const households = useMemo(
    () => users.filter((u) => u.role === "user"),
    [users]
  );

  const activeBins = useMemo(
    () => Object.keys(system.bins || {}).length,
    [system.bins]
  );

  const recentTransactions = transactions.slice(0, 10);

  const storagePercent = Math.min(
    100,
    (system.bottleStorage / system.maxBottleCapacity) * 100
  );

  const bottleTx = useMemo(
    () => transactions.filter((t) => t.type === "bottle"),
    [transactions]
  );
  const redeemTx = useMemo(
    () => transactions.filter((t) => t.type === "redeem"),
    [transactions]
  );

  return (
    <div className="adm-shell">

      {/* ── Top bar ── */}
      <div className="adm-topbar">
        <div>
          <p className="adm-topbar-sub">MAIN MENU</p>
        </div>
        <div className="adm-topbar-user">
          <div className="adm-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>
            </svg>
          </div>
          <span className="adm-topbar-name">{currentUser?.name || "Admin"}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* ── Alert banners ── */}
      {system.riceStock <= 0 && (
        <div className="adm-alert adm-alert--danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Rice stock is out — restock immediately to continue redemptions.
        </div>
      )}
      {system.bottleStorage >= system.maxBottleCapacity && (
        <div className="adm-alert adm-alert--warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Bottle storage at max capacity — schedule collection now.
        </div>
      )}

      {/* ── Stat cards grid ── */}
      <div className="adm-stat-grid">
        <AdminStatCard
          label="Total Users"
          value={households.length.toLocaleString()}
          sub="Registered households"
          subColor="green"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
        />
        <AdminStatCard
          label="Active Bins"
          value={activeBins}
          sub="All operational"
          subColor="blue"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          }
        />
        <AdminStatCard
          label="Pending Redemptions"
          value={redeemTx.length}
          sub={`${bottleTx.length} bottle insert logs`}
          subColor="amber"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <path d="M20 12V22H4V12"/>
              <path d="M22 7H2v5h20V7z"/>
              <path d="M12 22V7"/>
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
            </svg>
          }
        />
        <AdminStatCard
          label="Items Recycled"
          value={(system.totalItemsRecycled ?? 0).toLocaleString()}
          sub={`${Number(system.totalWeightRecycledKg ?? 0).toFixed(3)} kg recycled total`}
          subColor="green"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <polyline points="1 4 1 10 7 10"/>
              <polyline points="23 20 23 14 17 14"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
          }
        />
      </div>

      {/* ── Rice & Storage overview ── */}
      <div className="adm-overview-grid">
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Rice Stock</h3>
            <span className="adm-badge adm-badge--green">Live</span>
          </div>
          <div className="adm-big-number">{system.riceStock} <span className="adm-big-unit">kg</span></div>
          <p className="adm-card-sub">Available for redemption</p>
        </div>

        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Bottle Storage</h3>
            <span className={`adm-badge ${storagePercent >= 90 ? "adm-badge--red" : storagePercent >= 70 ? "adm-badge--amber" : "adm-badge--green"}`}>
              {storagePercent.toFixed(0)}%
            </span>
          </div>
          <div className="adm-big-number">{system.bottleStorage} <span className="adm-big-unit">/ {system.maxBottleCapacity}</span></div>
          <div className="adm-progress-track">
            <div
              className={`adm-progress-fill ${storagePercent >= 90 ? "adm-progress-fill--red" : storagePercent >= 70 ? "adm-progress-fill--amber" : "adm-progress-fill--green"}`}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <p className="adm-card-sub" style={{ marginTop: 8 }}>Bin storage utilization</p>
        </div>

        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Transaction Summary</h3>
          </div>
          <div className="adm-tx-summary">
            <div className="adm-tx-row">
              <span className="adm-badge adm-badge--green">Bottle Inserts</span>
              <strong>{bottleTx.length}</strong>
            </div>
            <div className="adm-tx-row">
              <span className="adm-badge adm-badge--amber">Redemptions</span>
              <strong>{redeemTx.length}</strong>
            </div>
            <div className="adm-tx-row">
              <span className="adm-badge adm-badge--blue">Total Logs</span>
              <strong>{transactions.length}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent System Logs ── */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Recent System Logs</h3>
          <span className="adm-badge adm-badge--blue">Last 10</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Type</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan="4" className="muted-cell">
                    <div className="empty-activity">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <p>No logs yet.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                recentTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.timestamp)}</td>
                    <td><strong>{item.userName}</strong></td>
                    <td>
                      <span className={`badge badge-${item.type}`}>{item.type}</span>
                    </td>
                    <td>{item.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
