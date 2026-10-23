#pragma once

// Copy this file to include/secrets.h and fill in real values.
// secrets.h is git-ignored; never commit it.

#define WIFI_SSID         "your-wifi-name"
#define WIFI_PASSWORD     "your-wifi-password"

#define FIREBASE_API_KEY  "your-firebase-web-api-key"
#define FIREBASE_DB_URL   "https://your-project-default-rtdb.firebaseio.com"

// This bin's ID and its device login, created with:
//   npm run admin -- create-device <username> <password> <binId>
// The script prints the DEVICE_EMAIL to use (<username>@<project-id>.firebaseapp.com).
#define BIN_ID            "bin_001"
#define DEVICE_EMAIL      "bin_001@your-project.firebaseapp.com"
#define DEVICE_PASSWORD   "device-login-password"
