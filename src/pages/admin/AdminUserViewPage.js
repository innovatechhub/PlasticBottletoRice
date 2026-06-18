import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { useData } from "../../app/DataContext";
import { tibiaoBarangays } from "../../constants/tibiaoBarangays";

const BASE_URL = window.location.origin;

const formatDateTime = (ts) =>
  new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function toCreditLog(log) {
  if (log.type === "bottle") {
    return `Inserted ${log.amount} bottle(s) — +${Number(log.kgDelta ?? 0).toFixed(3)} kg earned`;
  }
  return `Redeemed ${Math.abs(Number(log.riceDeltaKg ?? 0)).toFixed(3)} kg of rice — −${Math.abs(Number(log.kgDelta ?? 0)).toFixed(3)} kg used`;
}

export default function AdminUserViewPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { users, transactions, system, actions } = useData();

  const household = useMemo(
    () => users.find((u) => u.id === userId && u.role === "user") || null,
    [users, userId]
  );

  const assignedBinIds = useMemo(() => {
    if (!userId) return [];
    return Object.entries(system?.bins || {})
      .filter(([, bin]) => bin?.assignedUserId === userId)
      .map(([binId]) => binId);
  }, [system, userId]);

  const logs = useMemo(() => {
    if (!userId) return [];
    return transactions
      .filter((t) => t.userId === userId && (t.type === "bottle" || t.type === "redeem"))
      .slice(0, 20);
  }, [transactions, userId]);

  // Edit form state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", weightKg: 0, password: "" });
  const [editStatus, setEditStatus] = useState("");
  const [editError, setEditError] = useState("");

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // QR ref for download
  const qrRef = useRef(null);

  const qrValue = `${BASE_URL}/login?hid=${userId}`;

  const openEdit = useCallback(() => {
    if (!household) return;
    setEditForm({
      name: household.name,
      email: household.email,
      barangay: household.barangay || "",
      weightKg: household.weightKg ?? 0,
      password: "",
    });
    setEditStatus("");
    setEditError("");
    setEditOpen(true);
  }, [household]);

  const handleSave = async (e) => {
    e.preventDefault();
    setEditError("");
    setEditStatus("");
    const result = await actions.updateUser(userId, editForm);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditStatus("Account updated successfully.");
    setEditOpen(false);
  };

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${household?.name || "household"}-qr.png`;
    a.click();
  };

  const handlePrintQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>QR Code — ${household?.name || ""}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;gap:16px}
      img{width:260px;height:260px}p{color:#444;font-size:14px}</style></head>
      <body><img src="${dataUrl}" /><p>${household?.name || ""}</p><p>${household?.email || ""}</p></body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  if (!household) {
    return (
      <div className="adm-shell">
        <div className="hv-not-found">
          <p>Household not found.</p>
          <Link to="/admin/users" className="hv-back-link">← Back to Household Management</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-shell">

      {/* ── Back + header ── */}
      <div className="hv-header">
        <button type="button" className="hv-back-btn" onClick={() => navigate("/admin/users")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <div>
          <h1 className="hv-title">{household.name}</h1>
          <p className="hv-sub">Household profile &amp; account portal</p>
        </div>
      </div>

      {editStatus ? <div className="adm-alert adm-alert--success">{editStatus}</div> : null}

      <div className="hv-grid">

        {/* ── LEFT COLUMN ── */}
        <div className="hv-col">

          {/* Section 1 — Info Card */}
          <div className="adm-card">
            <div className="adm-card-header">
              <h3 className="adm-card-title">Household Info</h3>
              <span className="adm-badge adm-badge--green">Active</span>
            </div>
            <dl className="hv-info-list">
              <div className="hv-info-row">
                <dt>Name</dt>
                <dd>{household.name}</dd>
              </div>
              <div className="hv-info-row">
                <dt>Email</dt>
                <dd>{household.email}</dd>
              </div>
              <div className="hv-info-row">
                <dt>Barangay</dt>
                <dd>{household.barangay || "Unassigned"}</dd>
              </div>
              <div className="hv-info-row">
                <dt>Balance</dt>
                <dd><strong>{(household.weightKg ?? 0).toFixed(3)} kg</strong></dd>
              </div>
              <div className="hv-info-row">
                <dt>Bin ID</dt>
                <dd>{assignedBinIds.length > 0 ? assignedBinIds.join(", ") : "Unassigned"}</dd>
              </div>
              <div className="hv-info-row">
                <dt>createdAt</dt>
                <dd className="hv-id-chip">{household.createdAt}</dd>
              </div>
              <div className="hv-info-row">
                <dt>Household ID</dt>
                <dd className="hv-id-chip">{household.id}</dd>
              </div>
            </dl>
          </div>

          {/* Section 3 — Account Portal */}
          <div className="adm-card">
            <div className="adm-card-header">
              <h3 className="adm-card-title">Account Portal</h3>
              {!editOpen && (
                <button type="button" className="adm-badge adm-badge--blue hv-edit-trigger" onClick={openEdit}>
                  Edit
                </button>
              )}
            </div>

            {!editOpen ? (
              <dl className="hv-info-list">
                <div className="hv-info-row">
                  <dt>Email</dt>
                  <dd>{household.email}</dd>
                </div>
                <div className="hv-info-row">
                  <dt>Barangay</dt>
                  <dd>{household.barangay || "Unassigned"}</dd>
                </div>
                <div className="hv-info-row">
                  <dt>Password</dt>
                  <dd className="hv-password-row">
                    <span>{showPassword ? (household.password || "—") : "••••••••"}</span>
                    <button
                      type="button"
                      className="hv-show-btn"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </dd>
                </div>
              </dl>
            ) : (
              <form className="hv-edit-form" onSubmit={handleSave}>
                <label className="hv-label">
                  Name
                  <input
                    className="input-field"
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </label>
                <label className="hv-label">
                  Email
                  <input
                    className="input-field"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    required
                  />
                </label>
                <label className="hv-label">
                  Barangay
                  <select
                    className="input-field"
                    value={editForm.barangay}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, barangay: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select barangay</option>
                    {tibiaoBarangays.map((barangay) => (
                      <option key={barangay} value={barangay}>
                        {barangay}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="hv-label">
                  Balance (kg)
                  <input
                    className="input-field"
                    type="number"
                    min="0"
                    step="0.001"
                    value={editForm.weightKg}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, weightKg: Math.max(0, Number(e.target.value)) }))
                    }
                  />
                </label>
                <label className="hv-label">
                  New Password <span className="hv-label-hint">(leave blank to keep current)</span>
                  <input
                    className="input-field"
                    type="text"
                    value={editForm.password}
                    placeholder="Enter new password"
                    onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                  />
                </label>
                {editError ? <p className="hv-error">{editError}</p> : null}
                <div className="hv-edit-actions">
                  <button type="submit" className="btn-primary">Save Changes</button>
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() => { setEditOpen(false); setEditError(""); }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="hv-col">

          {/* Section 2 — QR Code */}
          <div className="adm-card hv-qr-card">
            <div className="adm-card-header">
              <h3 className="adm-card-title">Household QR Code</h3>
            </div>
            <p className="hv-qr-hint">
              Scan to open the login page with this household pre-selected.
            </p>
            <div className="hv-qr-wrap" ref={qrRef}>
              <QRCodeCanvas
                value={qrValue}
                size={200}
                bgColor="#ffffff"
                fgColor="#154212"
                level="M"
                includeMargin
              />
            </div>
            <p className="hv-qr-url">{qrValue}</p>
            <div className="hv-qr-actions">
              <button type="button" className="btn-primary" onClick={handleDownloadQR}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PNG
              </button>
              <button type="button" className="outline-btn" onClick={handlePrintQR}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4 — Activity Log (full width) */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Activity Log</h3>
          <span className="adm-badge adm-badge--blue">Last 20</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Type</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="3" className="muted-cell">
                    <div className="empty-activity">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <p>No activity logs yet.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.timestamp)}</td>
                    <td>
                      <span className={`adm-badge adm-badge--${log.type === "bottle" ? "green" : "amber"}`}>
                        {log.type === "bottle" ? "Bottle Insert" : "Redemption"}
                      </span>
                    </td>
                    <td>{toCreditLog(log)}</td>
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
