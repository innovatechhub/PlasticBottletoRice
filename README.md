# Plastic Bottle to Rice (Admin + User)

React app for a role-based "Plastic Bottle to Rice" system with:
- Unified login (admin or household user)
- Bottle-to-points and points-to-rice logic
- Admin dashboard, user management, logs, storage monitor
- Notification bell with real-time updates

## Data Mode

The app supports two modes:
- `Firebase` mode: when Firebase env vars are set and connection succeeds
- `Local` mode: fallback mode using browser local storage

Current mode is shown in the app header (`Data: Firebase` or `Data: Local`).

## Firebase Files Included

- `.env.example`
- `.env.local` (placeholder file created for local setup)
- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`

## Firebase Setup

1. Create a Firebase project.
2. Enable `Firestore Database`.
3. Enable `Authentication` -> `Sign-in method` -> `Anonymous`.
4. Copy `.env.example` values into `.env.local` and fill your real project keys.
5. Restart dev server after editing env vars.

## Install and Run

```bash
npm install
npm start
```

## Build and Test

```bash
npm test -- --watchAll=false
npm run build
```

## Firestore Rules Deploy

If Firebase CLI is configured:

```bash
firebase deploy --only firestore:rules
```
