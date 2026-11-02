import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useData } from "../../app/DataContext";
import { tibiaoBarangays } from "../../constants/tibiaoBarangays";
import Pagination from "../../components/Pagination";
import { AdminSection, EmptyRow, LoadErrorNotice, StatusBadge } from "../../components/admin/AdminUI";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import MoreMenu from "../../components/admin/MoreMenu";
import { balanceDiffers, ledgerByResident } from "../../admin/ledger";
import useNow from "../../admin/useNow";
import { USERNAME_RULES, isUsernameLogin } from "../../services/firebaseClient";
import { formatKg, formatRelative, formatDateTime, toDate } from "../../utils/format";

const emptyNewUser = {
  name: "",
  username: "",
  barangay: "",
  password: "",
};

const PAGE_SIZE = 10;
const ACTIVE_WITHIN_DAYS = 30;
const MIN_REDEEM_KG = 0.5;

// Username logins are stored as <username>@<project>.firebaseapp.com; older accounts use a real email.
const usernameOf = (user) =>
  user.username || (isUsernameLogin(user.email) ? String(user.email).split("@")[0] : "");
const realEmailOf = (user) => (user.email && !isUsernameLogin(user.email) ? user.email : "");

const SORTS = {
  name: { label: "Name, A to Z", compare: (a, b) => a.name.localeCompare(b.name) },
  balance: { label: "Balance, highest first", compare: (a, b) => (b.weightKg || 0) - (a.weightKg || 0) },
  lifetime: {
    label: "Plastic recycled, most first",
    compare: (a, b) => (b.totalRecycledWeightKg || 0) - (a.totalRecycledWeightKg || 0),
  },
  activity: {
    label: "Last activity, newest first",
    compare: (a, b) => String(b.lastActivity || "").localeCompare(String(a.lastActivity || "")),
  },
};

export default function AdminUsersPage() {
  const { users, transactions, actions, syncErrors } = useData();
  const [searchParams] = useSearchParams();
  const now = useNow();

  const [newUser, setNewUser] = useState(emptyNewUser);
  const [editingId, setEditingId] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingForm, setEditingForm] = useState({ name: "", barangay: "", weightKg: 0 });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [filters, setFilters] = useState(() => ({
    search: "",
    barangay: searchParams.get("barangay") === "missing" ? "__missing" : "",
    activity: "",
    balance: searchParams.get("check") === "balance" ? "differs" : "",
    sort: "name",
  }));

  const ledger = useMemo(() => ledgerByResident(transactions), [transactions]);

  const residents = useMemo(
    () =>
      users
        .filter((user) => user.role === "user")
        .map((user) => {
          const entry = ledger.get(user.id);
          return {
            ...user,
            username: usernameOf(user),
            realEmail: realEmailOf(user),
            lastActivity: entry?.lastActivity || null,
            balanceDiffers: balanceDiffers(user, entry),
          };
        }),
    [users, ledger]
  );

  const barangayOptions = useMemo(() => {
    const present = residents.map((user) => user.barangay).filter(Boolean);
    return [...new Set([...tibiaoBarangays, ...present])].sort((a, b) => a.localeCompare(b));
  }, [residents]);
  const showEmailColumn = residents.some((user) => user.realEmail);

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const activeSince = now - ACTIVE_WITHIN_DAYS * 24 * 60 * 60 * 1000;
    return residents
      .filter((user) => {
        if (query) {
          const haystack = [user.name, user.username, user.realEmail, user.barangay, user.id]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (filters.barangay === "__missing" && user.barangay) return false;
        if (filters.barangay && filters.barangay !== "__missing" && user.barangay !== filters.barangay) {
          return false;
        }
        const last = toDate(user.lastActivity);
        if (filters.activity === "active" && !(last && last.getTime() >= activeSince)) return false;
        if (filters.activity === "inactive" && last && last.getTime() >= activeSince) return false;
        if (filters.activity === "never" && last) return false;
        if (filters.balance === "redeemable" && (user.weightKg || 0) < MIN_REDEEM_KG) return false;
        if (filters.balance === "zero" && (user.weightKg || 0) > 0) return false;
        if (filters.balance === "differs" && !user.balanceDiffers) return false;
        return true;
      })
      .sort(SORTS[filters.sort].compare);
  }, [residents, filters, now]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };
  const filtersActive =
    filters.search || filters.barangay || filters.activity || filters.balance;

  const startEdit = (user) => {
    setEditingId(user.id);
    setEditingForm({ name: user.name, barangay: user.barangay || "", weightKg: user.weightKg });
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");
    const result = await actions.addUser({ ...newUser });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus(`Created account for ${result.user.name}.`);
    setNewUser(emptyNewUser);
    setShowCreateForm(false);
  };

  const handleSaveUser = async (userId) => {
    setError("");
    setStatus("");
    const result = await actions.updateUser(userId, editingForm);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus(`Updated ${result.user.name}.`);
    setEditingId("");
  };

  // Same delete as before; only the confirmation changed.
  const confirmDelete = async () => {
    const { id, name } = pendingDelete;
    setDeleting(true);
    setError("");
    setStatus("");
    const result = await actions.deleteUser(id);
    setDeleting(false);
    setPendingDelete(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus(`Deleted ${name}. Their login can no longer access any data.`);
  };

  const colCount = showEmailColumn ? 9 : 8;

  return (
    <div className="adm-page">
      <LoadErrorNotice errors={syncErrors} sources={["users", "transactions"]} />

      {status ? (
        <div className="adm-notice adm-notice--good" role="status">
          {status}
        </div>
      ) : null}
      {error ? (
        <div className="adm-notice adm-notice--critical" role="alert">
          {error}
        </div>
      ) : null}

      <AdminSection
        title={`${residents.length} resident${residents.length === 1 ? "" : "s"}`}
        description="Bottles and plastic are lifetime totals from each resident's stored counter. Balance is current."
        actions={
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => setShowCreateForm(true)}>
            Add resident
          </button>
        }
      >
        <div className="adm-filters" role="search" aria-label="Filter residents">
          <label className="adm-field adm-field--grow">
            <span>Search</span>
            <input
              type="search"
              className="adm-input"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder="Name, username or barangay"
            />
          </label>
          <label className="adm-field">
            <span>Barangay</span>
            <select className="adm-input" value={filters.barangay} onChange={(e) => setFilter("barangay", e.target.value)}>
              <option value="">All barangays</option>
              <option value="__missing">Missing barangay</option>
              {barangayOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="adm-field">
            <span>Activity</span>
            <select className="adm-input" value={filters.activity} onChange={(e) => setFilter("activity", e.target.value)}>
              <option value="">Any</option>
              <option value="active">Active in last {ACTIVE_WITHIN_DAYS} days</option>
              <option value="inactive">Not active in {ACTIVE_WITHIN_DAYS} days</option>
              <option value="never">No activity yet</option>
            </select>
          </label>
          <label className="adm-field">
            <span>Balance</span>
            <select className="adm-input" value={filters.balance} onChange={(e) => setFilter("balance", e.target.value)}>
              <option value="">Any</option>
              <option value="redeemable">Can redeem (500 g or more)</option>
              <option value="zero">Zero</option>
              <option value="differs">Differs from transaction log</option>
            </select>
          </label>
          <label className="adm-field">
            <span>Sort by</span>
            <select className="adm-input" value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}>
              {Object.entries(SORTS).map(([key, sort]) => (
                <option key={key} value={key}>
                  {sort.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="adm-muted adm-result-count" aria-live="polite">
          Showing {filtered.length} of {residents.length}
        </p>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Resident</th>
                <th scope="col">Username</th>
                {showEmailColumn ? <th scope="col">Email</th> : null}
                <th scope="col">Barangay</th>
                <th scope="col" className="adm-num">Bottles</th>
                <th scope="col" className="adm-num">Plastic</th>
                <th scope="col" className="adm-num">Balance</th>
                <th scope="col">Last activity</th>
                <th scope="col">
                  <span className="adm-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <EmptyRow colSpan={colCount}>
                  {residents.length === 0
                    ? "No residents yet. Use Add resident to create the first account."
                    : "No residents match these filters."}
                  {filtersActive && residents.length > 0 ? (
                    <button
                      type="button"
                      className="adm-btn adm-btn--link"
                      onClick={() => setFilters((prev) => ({ ...prev, search: "", barangay: "", activity: "", balance: "" }))}
                    >
                      Clear filters
                    </button>
                  ) : null}
                </EmptyRow>
              ) : (
                paged.map((user) => {
                  const isEditing = editingId === user.id;
                  return (
                    <tr key={user.id}>
                      <td>
                        {isEditing ? (
                          <input
                            className="adm-input"
                            aria-label="Name"
                            value={editingForm.name}
                            onChange={(e) => setEditingForm((prev) => ({ ...prev, name: e.target.value }))}
                          />
                        ) : (
                          <strong>{user.name}</strong>
                        )}
                        {user.balanceDiffers && !isEditing ? (
                          <span className="adm-block">
                            <StatusBadge tone="warning">Balance differs from log</StatusBadge>
                          </span>
                        ) : null}
                      </td>
                      <td>{user.username || "—"}</td>
                      {showEmailColumn ? <td>{user.realEmail || "—"}</td> : null}
                      <td>
                        {isEditing ? (
                          <select
                            className="adm-input"
                            aria-label="Barangay"
                            value={editingForm.barangay}
                            onChange={(e) => setEditingForm((prev) => ({ ...prev, barangay: e.target.value }))}
                            required
                          >
                            <option value="">Select barangay</option>
                            {tibiaoBarangays.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        ) : user.barangay ? (
                          user.barangay
                        ) : (
                          <StatusBadge tone="warning">Missing</StatusBadge>
                        )}
                      </td>
                      <td className="adm-num">{user.recycledItemCount ?? 0}</td>
                      <td className="adm-num">{formatKg(user.totalRecycledWeightKg)}</td>
                      <td className="adm-num">
                        {isEditing ? (
                          <>
                            <input
                              className="adm-input adm-input--narrow"
                              aria-label="Balance in kg"
                              type="number"
                              min="0"
                              step="0.001"
                              value={editingForm.weightKg}
                              onChange={(e) =>
                                setEditingForm((prev) => ({ ...prev, weightKg: Math.max(0, Number(e.target.value)) }))
                              }
                            />
                            <span className="adm-muted adm-block adm-small">kg; not recorded in the log</span>
                          </>
                        ) : (
                          formatKg(user.weightKg)
                        )}
                      </td>
                      <td>
                        {user.lastActivity ? (
                          <span title={formatDateTime(user.lastActivity)}>{formatRelative(user.lastActivity, now)}</span>
                        ) : (
                          <span className="adm-muted">None yet</span>
                        )}
                      </td>
                      <td>
                        <div className="adm-row-actions">
                        {isEditing ? (
                          <>
                            <button type="button" className="adm-btn adm-btn--primary adm-btn--small" onClick={() => handleSaveUser(user.id)}>
                              Save
                            </button>
                            <button type="button" className="adm-btn adm-btn--secondary adm-btn--small" onClick={() => setEditingId("")}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <Link
                              to={`/admin/users/${user.id}`}
                              className="adm-btn adm-btn--secondary adm-btn--small"
                              aria-label={`View ${user.name}`}
                            >
                              View
                            </Link>
                            <MoreMenu
                              label={`More actions for ${user.name}`}
                              items={[
                                { label: "Edit", onSelect: () => startEdit(user) },
                                {
                                  label: "Delete",
                                  danger: true,
                                  onSelect: () => setPendingDelete({ id: user.id, name: user.name }),
                                },
                              ]}
                            />
                          </>
                        )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalCount={filtered.length}
          onPageChange={setPage}
          label="resident"
        />
      </AdminSection>

      {pendingDelete ? (
        <ConfirmDialog
          title={`Delete ${pendingDelete.name}?`}
          confirmLabel={deleting ? "Deleting…" : `Delete ${pendingDelete.name}`}
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => (deleting ? null : setPendingDelete(null))}
        >
          <p>
            Their resident profile is removed, so their login can no longer see any data. Their past
            transactions stay in the logs.
          </p>
          <p>This can't be undone from the app.</p>
        </ConfirmDialog>
      ) : null}

      {showCreateForm ? (
        <div className="modal-overlay" role="presentation" onClick={() => setShowCreateForm(false)}>
          <div
            className="modal-card household-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="household-create-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="card-title" id="household-create-title">
                Add resident
              </h2>
              <button type="button" className="adm-btn adm-btn--secondary" onClick={() => setShowCreateForm(false)}>
                Close
              </button>
            </div>

            <form className="split-grid" onSubmit={handleCreateUser}>
              <label>
                Name
                <input
                  className="input-field"
                  value={newUser.name}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                Username
                <input
                  className="input-field"
                  type="text"
                  value={newUser.username}
                  onChange={(event) =>
                    setNewUser((prev) => ({ ...prev, username: event.target.value.toLowerCase() }))
                  }
                  placeholder="e.g. juan.delacruz"
                  pattern="[a-z0-9][a-z0-9._\-]{2,29}"
                  title={USERNAME_RULES}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </label>
              <label className="split-grid__full">
                Barangay
                <select
                  className="input-field"
                  value={newUser.barangay}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, barangay: event.target.value }))}
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
              <label className="split-grid__full">
                Password (at least 6 characters)
                <input
                  className="input-field"
                  type="text"
                  minLength={6}
                  autoComplete="new-password"
                  value={newUser.password}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
              </label>
              <button className="adm-btn adm-btn--primary split-grid__full" type="submit">
                Save resident
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
