// Notifications have no link field, so admin links come from the titles the app
// itself creates (see services/localStore.js). Unknown titles get no link.
const LINKS = {
  "Bottle Storage Full": "/admin/storage",
  "Bottle Storage Cleared": "/admin/storage",
  "Out of Rice": "/admin/storage",
  "Rice Stock Insufficient": "/admin/storage",
  "Rice Restocked": "/admin/storage",
  "Large Redemption Request": "/admin/logs",
  "New Household Added": "/admin/users",
  "Household Removed": "/admin/users",
};

export function notificationLink(notification) {
  return LINKS[notification?.title] || null;
}
