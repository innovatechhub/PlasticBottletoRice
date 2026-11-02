// Address the household QR code points to (the admin page and the resident's Account page).
// Set REACT_APP_PUBLIC_APP_URL for production builds (e.g. https://plastictorice.web.app);
// local development falls back to this page's origin.
export const APP_URL = (process.env.REACT_APP_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, "");

// True when the QR would point to this computer (no production URL set, running locally).
export const APP_URL_MISSING =
  !process.env.REACT_APP_PUBLIC_APP_URL && /^(localhost|127\.)/.test(window.location.hostname);

// The household QR opens the sign-in page for that resident.
export const householdQrValue = (userId) => `${APP_URL}/login?hid=${userId}`;
