import { useId } from "react";
import { formatDateTime, formatRelative } from "../../utils/format";

// Status badges always pair the colour with a word and a shape, never colour alone.
// tone: good | warning | critical | neutral | info
const TONE_ICON = { good: "●", warning: "▲", critical: "■", neutral: "○", info: "●" };

export function StatusBadge({ tone = "neutral", children }) {
  return (
    <span className={`adm-status adm-status--${tone}`}>
      <span className="adm-status__icon" aria-hidden="true">
        {TONE_ICON[tone]}
      </span>
      {children}
    </span>
  );
}

export function TypeBadge({ tx }) {
  if (tx.type === "bottle") return <StatusBadge tone="good">Bottles</StatusBadge>;
  if (tx.type === "redeem") {
    return tx.status === "declined" ? (
      <StatusBadge tone="neutral">Redemption, declined</StatusBadge>
    ) : (
      <StatusBadge tone="info">Redemption</StatusBadge>
    );
  }
  return <StatusBadge tone="neutral">System</StatusBadge>;
}

export function AdminSection({ title, description, actions, id, children, className = "" }) {
  const generatedId = useId();
  const headingId = title ? (id ? `${id}-title` : generatedId) : undefined;
  return (
    <section className={`adm-section ${className}`} id={id} aria-labelledby={headingId}>
      {title || actions ? (
        <header className="adm-section__header">
          <div>
            {title ? (
              <h2 className="adm-section__title" id={headingId}>
                {title}
              </h2>
            ) : null}
            {description ? <p className="adm-section__desc">{description}</p> : null}
          </div>
          {actions ? <div className="adm-section__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

const SOURCE_NAMES = {
  "users:all": "residents",
  "transactions:all": "transactions",
  "notifications:all": "notifications",
  bin_status: "bin status",
};

// Shown when a data source failed to load, so an empty table isn't mistaken for "no data".
export function LoadErrorNotice({ errors, sources }) {
  const relevant = errors.filter((key) =>
    sources.some((source) => key === source || key.startsWith(`${source}:`))
  );
  if (relevant.length === 0) return null;
  const names = [...new Set(relevant.map((key) => SOURCE_NAMES[key] || key.split(":")[0]))];
  return (
    <div className="adm-notice adm-notice--critical" role="alert">
      <strong>Couldn't load {names.join(" and ")}.</strong> What you see may be incomplete. Check
      your connection and reload the page.
    </div>
  );
}

export function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="adm-table__empty">
        {children}
      </td>
    </tr>
  );
}

// "5 min ago" with the full date on hover and for screen readers.
export function LastSeen({ value, now }) {
  if (!value) return <span className="adm-muted">Never</span>;
  return (
    <span>
      {formatRelative(value, now)}
      <span className="adm-muted adm-block adm-small adm-nowrap">{formatDateTime(value)}</span>
    </span>
  );
}
