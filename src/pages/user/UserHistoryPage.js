import { useMemo, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import ActivityList from "../../components/ActivityList";
import Pagination from "../../components/Pagination";

const PAGE_SIZE = 10;

const FILTERS = [
  { label: "All", matches: () => true },
  { label: "Bottles", matches: (item) => item.type === "bottle" },
  { label: "Rice", matches: (item) => item.type === "redeem" },
];

function RiceBowlIcon() {
  return (
    <svg className="eco-empty__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M6.5 11a5.5 4 0 0 1 11 0M3 11h18a9 7.5 0 0 1-6 7.1V20H9v-1.9A9 7.5 0 0 1 3 11Z"
      />
    </svg>
  );
}

export default function UserHistoryPage() {
  const { currentUser } = useAuth();
  const { transactions } = useData();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState(FILTERS[0]);

  const rows = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    return transactions.filter((item) => item.userId === currentUser.id && filter.matches(item));
  }, [transactions, currentUser, filter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, currentPage]);

  return (
    <div className="eco-page eco-history">
      <h1 className="eco-page__title">History</h1>

      <div className="eco-chips" role="group" aria-label="Show">
        {FILTERS.map((option) => (
          <button
            key={option.label}
            type="button"
            className={`eco-chip${option === filter ? " is-active" : ""}`}
            aria-pressed={option === filter}
            onClick={() => {
              setFilter(option);
              setPage(1);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="eco-empty">
          <RiceBowlIcon />
          <p>No activity yet.</p>
        </div>
      ) : (
        <div className="eco-history__list">
          {/* Column labels for wide screens, where rows line up as a table. */}
          <div className="eco-history__head" aria-hidden="true">
            <span>Activity</span>
            <span>Date</span>
            <span>Amount</span>
          </div>
          <ActivityList items={pagedRows} />
        </div>
      )}

      {rows.length > PAGE_SIZE ? (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalCount={rows.length}
          onPageChange={setPage}
          label="record"
        />
      ) : null}
    </div>
  );
}
