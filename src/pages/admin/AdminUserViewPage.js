import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { useData } from "../../app/DataContext";
import { tibiaoBarangays } from "../../constants/tibiaoBarangays";
import Pagination from "../../components/Pagination";
import { AdminSection, EmptyRow, LoadErrorNotice, StatusBadge, TypeBadge } from "../../components/admin/AdminUI";
import { balanceDiffers, ledgerByResident } from "../../admin/ledger";
import useNow from "../../admin/useNow";
import { displayLoginId, isUsernameLogin } from "../../services/firebaseClient";
import { formatDate, formatDateTime, formatKg, formatKgChange, formatRelative } from "../../utils/format";
import { APP_URL_MISSING, householdQrValue } from "../../utils/qr";
const PAGE_SIZE = 10;

const escapeHtml = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function Summary({ label, scope, value }) {
  return (
    <div className="adm-summary__item">
      <dt>
        {label}
        <span className="adm-metric__scope">{scope}</span>
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function AdminUserViewPage() {
  const { userId } = useParams();
  const { users, transactions, system, actions, syncErrors } = useData();
  const now = useNow();

  const household = useMemo(
    () => users.find((u) => u.id === userId && u.role === "user") || null,
    [users, userId]
  );
  const ledgerEntry = useMemo(() => ledgerByResident(transactions).get(userId), [transactions, userId]);

  const assignedBinIds = useMemo(
    () =>
      Object.entries(system?.bins || {})
        .filter(([, bin]) => bin?.assignedUserId === userId)
        .map(([binId]) => binId),
    [system, userId]
  );

  const logs = useMemo(
    () => transactions.filter((t) => t.userId === userId && (t.type === "bottle" || t.type === "redeem")),
    [transactions, userId]
  );

  const [logsPage, setLogsPage] = useState(1);
  const logsTotalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const logsCurrentPage = Math.min(logsPage, logsTotalPages);
  const pagedLogs = logs.slice((logsCurrentPage - 1) * PAGE_SIZE, logsCurrentPage * PAGE_SIZE);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", barangay: "", weightKg: 0 });
  const [editStatus, setEditStatus] = useState("");
  const [editError, setEditError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState("");
  const [resetError, setResetError] = useState("");
  const [copied, setCopied] = useState("");

  const qrRef = useRef(null);
  const qrValue = householdQrValue(userId);

  const openEdit = () => {
    setEditForm({
      name: household.name,
      barangay: household.barangay || "",
      weightKg: household.weightKg ?? 0,
    });
    setEditStatus("");
    setEditError("");
    setResetOpen(false);
    setEditOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setEditError("");
    setEditStatus("");
    const result = await actions.updateUser(userId, editForm);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditStatus("Details saved.");
    setEditOpen(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetStatus("");
    setResetError("");
    setResetting(true);
    const result = await actions.resetResidentPassword(userId, newPassword);
    setResetting(false);
    if (!result.ok) {
      setResetError(result.error);
      return;
    }
    setNewPassword("");
    setResetOpen(false);
    setResetStatus(`Password updated. ${household.name} was signed out and must use the new password.`);
  };

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`${what} copied.`);
    } catch {
      setCopied(`Couldn't copy. Select the ${what.toLowerCase()} and copy it manually.`);
    }
  };

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${household?.name || "resident"}-qr.png`;
    a.click();
  };

  const handlePrintQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>QR code: ${escapeHtml(household?.name)}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;gap:16px}
      img{width:260px;height:260px}p{color:#444;font-size:14px}</style></head>
      <body><img src="${dataUrl}" alt="" /><p>${escapeHtml(household?.name)}</p><p>${escapeHtml(displayLoginId(household))}</p></body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  if (!household) {
    return (
      <div className="adm-page">
        <LoadErrorNotice errors={syncErrors} sources={["users"]} />
        <AdminSection title="Resident not found">
          <p className="adm-muted">This resident doesn't exist or was deleted.</p>
          <Link to="/admin/users" className="adm-link">
            Back to Residents
          </Link>
        </AdminSection>
      </div>
    );
  }

  const realEmail = household.email && !isUsernameLogin(household.email) ? household.email : "";
  const differs = balanceDiffers(household, ledgerEntry);

  return (
    <div className="adm-page">
      <LoadErrorNotice errors={syncErrors} sources={["users", "transactions"]} />

      <div className="adm-profile-head">
        <Link to="/admin/users" className="adm-link">
          ← Residents
        </Link>
        <h2 className="adm-profile-head__name">{household.name}</h2>
        <p className="adm-muted">
          {household.barangay || "No barangay"}. Joined {formatDate(household.createdAt)}
        </p>
      </div>

      {editStatus ? (
        <div className="adm-notice adm-notice--good" role="status">
          {editStatus}
        </div>
      ) : null}

      <AdminSection className="adm-summary-section">
        <dl className="adm-summary">
          <Summary label="Balance" scope="Current" value={formatKg(household.weightKg)} />
          <Summary label="Plastic recycled" scope="Lifetime" value={formatKg(household.totalRecycledWeightKg)} />
          <Summary label="Bottles" scope="Lifetime" value={(household.recycledItemCount ?? 0).toLocaleString()} />
          <Summary label="Rice redeemed" scope="From log" value={formatKg(ledgerEntry?.redeemedKg || 0)} />
          <Summary
            label="Last activity"
            scope="From log"
            value={ledgerEntry?.lastActivity ? formatRelative(ledgerEntry.lastActivity, now) : "None yet"}
          />
        </dl>
        {differs ? (
          <p className="adm-section__foot">
            <StatusBadge tone="warning">Balance differs from the log</StatusBadge> Bottles and redemptions add
            up to {formatKg(ledgerEntry?.balanceKg || 0)}. The balance may have been edited by hand.
          </p>
        ) : null}
      </AdminSection>

      <div className="adm-two-col adm-two-col--wide-left">
        <AdminSection
          title="Details"
          actions={
            !editOpen ? (
              <button type="button" className="adm-btn adm-btn--secondary adm-btn--small" onClick={openEdit}>
                Edit details
              </button>
            ) : null
          }
        >
          {!editOpen ? (
            <dl className="adm-dl">
              <div>
                <dt>Name</dt>
                <dd>{household.name}</dd>
              </div>
              <div>
                <dt>Username</dt>
                <dd>{displayLoginId(household)}</dd>
              </div>
              {realEmail ? (
                <div>
                  <dt>Email</dt>
                  <dd>{realEmail}</dd>
                </div>
              ) : null}
              <div>
                <dt>Barangay</dt>
                <dd>{household.barangay || <StatusBadge tone="warning">Missing</StatusBadge>}</dd>
              </div>
              <div>
                <dt>Assigned bins</dt>
                <dd>{assignedBinIds.length > 0 ? assignedBinIds.join(", ") : "None"}</dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd>{formatDate(household.createdAt)}</dd>
              </div>
              <div>
                <dt>Password</dt>
                <dd>
                  {!resetOpen ? (
                    <button
                      type="button"
                      className="adm-btn adm-btn--link"
                      onClick={() => {
                        setResetOpen(true);
                        setResetStatus("");
                        setResetError("");
                      }}
                    >
                      Set a new password
                    </button>
                  ) : (
                    "Setting a new password"
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <form className="adm-form" onSubmit={handleSave}>
              <label className="adm-field">
                <span>Name</span>
                <input
                  className="adm-input"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </label>
              <label className="adm-field">
                <span>Barangay</span>
                <select
                  className="adm-input"
                  value={editForm.barangay}
                  onChange={(e) => setEditForm((p) => ({ ...p, barangay: e.target.value }))}
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
              <label className="adm-field">
                <span>Balance (kg)</span>
                <input
                  className="adm-input"
                  type="number"
                  min="0"
                  step="0.001"
                  value={editForm.weightKg}
                  onChange={(e) => setEditForm((p) => ({ ...p, weightKg: Math.max(0, Number(e.target.value)) }))}
                />
                <small className="adm-muted">Changing the balance here is not recorded in the transaction log.</small>
              </label>
              {editError ? (
                <p className="adm-error" role="alert">
                  {editError}
                </p>
              ) : null}
              <div className="adm-form__actions">
                <button type="submit" className="adm-btn adm-btn--primary">
                  Save details
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn--secondary"
                  onClick={() => {
                    setEditOpen(false);
                    setEditError("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {!editOpen && resetOpen ? (
            <form className="adm-form adm-form--inset" onSubmit={handleResetPassword}>
              <label className="adm-field">
                <span>New password (at least 6 characters)</span>
                <input
                  className="adm-input"
                  type="text"
                  minLength={6}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </label>
              {resetError ? (
                <p className="adm-error" role="alert">
                  {resetError}
                </p>
              ) : null}
              <div className="adm-form__actions">
                <button type="submit" className="adm-btn adm-btn--primary" disabled={resetting}>
                  {resetting ? "Saving…" : "Save password"}
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn--secondary"
                  onClick={() => {
                    setResetOpen(false);
                    setNewPassword("");
                    setResetError("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
          {!editOpen && resetStatus ? (
            <p className="adm-muted" role="status">
              {resetStatus}
            </p>
          ) : null}

          <details className="adm-details">
            <summary>Technical details</summary>
            <dl className="adm-dl adm-dl--mono">
              <div>
                <dt>Resident ID</dt>
                <dd>
                  <code>{household.id}</code>
                  <button type="button" className="adm-btn adm-btn--link" onClick={() => copy(household.id, "Resident ID")}>
                    Copy
                  </button>
                </dd>
              </div>
              <div>
                <dt>Login email</dt>
                <dd>
                  <code>{household.email || "—"}</code>
                </dd>
              </div>
              <div>
                <dt>Created at</dt>
                <dd>
                  <code>{household.createdAt}</code>
                </dd>
              </div>
            </dl>
            {copied ? (
              <p className="adm-muted" role="status">
                {copied}
              </p>
            ) : null}
          </details>
        </AdminSection>

        <AdminSection title="QR code" description="Opens the EcoRice sign-in page.">
          <div className="adm-qr" ref={qrRef}>
            <QRCodeCanvas value={qrValue} size={180} bgColor="#ffffff" fgColor="#154212" level="M" includeMargin />
          </div>
          <p className="adm-qr__url">{qrValue}</p>
          {APP_URL_MISSING ? (
            <p className="adm-notice adm-notice--warning">
              This QR points to this computer. Set REACT_APP_PUBLIC_APP_URL before building for production.
            </p>
          ) : null}
          <div className="adm-form__actions">
            <button type="button" className="adm-btn adm-btn--primary" onClick={handleDownloadQR}>
              Download PNG
            </button>
            <button type="button" className="adm-btn adm-btn--secondary" onClick={handlePrintQR}>
              Print
            </button>
          </div>
        </AdminSection>
      </div>

      <AdminSection title="Activity">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col" className="adm-num">Balance change</th>
                <th scope="col" className="adm-num">Rice</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <EmptyRow colSpan={4}>No bottles or redemptions yet.</EmptyRow>
              ) : (
                pagedLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.timestamp)}</td>
                    <td>
                      <TypeBadge tx={log} />
                    </td>
                    <td className="adm-num">{formatKgChange(log.kgDelta)}</td>
                    <td className="adm-num">{log.type === "redeem" ? formatKg(Math.abs(log.riceDeltaKg)) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={logsCurrentPage}
          totalPages={logsTotalPages}
          totalCount={logs.length}
          onPageChange={setLogsPage}
          label="record"
        />
      </AdminSection>
    </div>
  );
}
