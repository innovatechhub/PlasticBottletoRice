import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import { useData } from "../app/DataContext";
import { notificationLink } from "../admin/notificationLinks";
import { isNotificationForUser } from "../services/localStore";
import { formatDateTime } from "../utils/format";

const SHOWN = 8;

export default function NotificationBell() {
  const { currentUser } = useAuth();
  const { notifications, actions } = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const panelId = useId();

  const visible = useMemo(() => {
    if (!currentUser) return [];
    return notifications.filter((notification) => isNotificationForUser(notification, currentUser));
  }, [notifications, currentUser]);

  const isUnread = (notification) => !(notification.readBy || []).includes(currentUser?.id);
  const unreadCount = visible.filter(isUnread).length;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = (notification) => {
    if (isUnread(notification)) actions.markNotificationRead(notification.id, currentUser.id);
    const to = notificationLink(notification);
    if (to) {
      setOpen(false);
      navigate(to);
    }
  };

  const recent = visible.slice(0, SHOWN);

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        ref={buttonRef}
        className="icon-btn"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="badge-count" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown" id={panelId} role="dialog" aria-label="Notifications">
          <div className="notification-header">
            <strong>Notifications</strong>
            <button
              type="button"
              className="adm-btn adm-btn--link"
              disabled={unreadCount === 0}
              onClick={() => actions.markAllNotificationsRead(currentUser)}
            >
              Mark all read
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="adm-muted notification-empty">No notifications yet.</p>
          ) : (
            <ul className="notification-list">
              {recent.map((notification) => {
                const unread = isUnread(notification);
                const to = notificationLink(notification);
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      className={`notification-item${unread ? " unread" : ""}`}
                      onClick={() => openItem(notification)}
                    >
                      <span className="notification-item__title">
                        {unread ? <span className="notification-dot" aria-hidden="true" /> : null}
                        <strong>{notification.title}</strong>
                        {unread ? <span className="adm-sr-only"> (unread)</span> : null}
                      </span>
                      <span className="notification-item__message">{notification.message}</span>
                      <span className="notification-item__meta">
                        {formatDateTime(notification.createdAt)}
                        {to ? <span className="notification-item__go">Open</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {visible.length > SHOWN ? (
            <p className="adm-muted adm-small">
              Showing the latest {SHOWN} of {visible.length}.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
