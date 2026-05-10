import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../app/AuthContext";
import { useData } from "../app/DataContext";
import { isNotificationForUser } from "../services/localStore";

const formatDateTime = (timestamp) =>
  new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function NotificationBell() {
  const { currentUser } = useAuth();
  const { notifications, actions } = useData();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const visibleNotifications = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    return notifications.filter((notification) =>
      isNotificationForUser(notification, currentUser)
    );
  }, [notifications, currentUser]);

  const unreadCount = useMemo(() => {
    if (!currentUser) {
      return 0;
    }
    return visibleNotifications.filter(
      (notification) => !notification.readBy.includes(currentUser.id)
    ).length;
  }, [visibleNotifications, currentUser]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const recent = visibleNotifications.slice(0, 8);

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="icon-text">Bell</span>
        {unreadCount > 0 && <span className="badge-count">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <strong>Notifications</strong>
            <button
              type="button"
              className="text-btn"
              onClick={() => actions.markAllNotificationsRead(currentUser)}
            >
              Mark all read
            </button>
          </div>
          {recent.length === 0 && (
            <p className="muted-text">No notifications available.</p>
          )}
          <div className="notification-list">
            {recent.map((notification) => {
              const unread = !notification.readBy.includes(currentUser.id);
              return (
                <button
                  key={notification.id}
                  type="button"
                  className={`notification-item ${unread ? "unread" : ""}`}
                  onClick={() =>
                    actions.markNotificationRead(notification.id, currentUser.id)
                  }
                >
                  <div>
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                  </div>
                  <small>{formatDateTime(notification.createdAt)}</small>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
