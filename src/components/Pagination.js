export default function Pagination({ page, totalPages, totalCount, onPageChange, label = "log" }) {
  if (totalCount === 0) {
    return null;
  }

  return (
    <div className="row-between" style={{ marginTop: 12 }}>
      <p className="muted-text">
        Page {page} of {totalPages} — {totalCount} {label}
        {totalCount === 1 ? "" : "s"}
      </p>
      <div className="actions-cell">
        <button
          type="button"
          className="outline-btn"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Previous
        </button>
        <button
          type="button"
          className="outline-btn"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
