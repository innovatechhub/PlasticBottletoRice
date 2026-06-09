# 📦 Plastic Bottle to Rice System (Admin + User) – Master Prompt Documentation

---

## 📄 features.md

### 🎯 Core Features
- Bottle-to-points conversion system (like piso vendo machine)
- Points can be redeemed into rice
- Real-time storage monitoring (rice level + bottle count)
- Push notifications when:
  - Storage is FULL
  - Rice is OUT OF STOCK
- Role-based system:
  - Admin
  - Household User
- Unified login system (auto-detect role)
- Admin can create/manage household accounts
- Transaction logging (every rice redemption & bottle input)
- Rewards system (points/credits wallet per user)

---

### 👤 Household User Features
- Insert plastic bottles → earn points
- View current points/credits
- Redeem rice based on available points
- View transaction history
- Receive notifications (low rice, successful redemption)

---

### 🛠️ Admin Features
- Dashboard overview:
  - Total rice available
  - Total bottles collected
  - Active users
- Manage users:
  - Add/Edit/Delete household accounts
- Monitor system logs:
  - Bottle insert logs
  - Rice redemption logs
- Configure system:
  - Points per bottle
  - Rice per point ratio
- Trigger/manual notifications
- Monitor storage levels in real-time

---

## 📄 frontend.md

### ⚛️ Tech Stack
- React (Vite)
- Tailwind CSS
- Firebase SDK

---

### 📱 Pages / Screens

#### 🔐 Authentication
- Login Page (single login system)
- Detect role → redirect:
  - Admin → /admin/dashboard
  - User → /user/home

#### 👤 User Pages
- Home Dashboard
  - Points balance
  - Insert bottle button (simulate hardware trigger)
- Redeem Page
  - Convert points → rice
- History Page
  - Logs of transactions

#### 🛠️ Admin Pages
- Admin Dashboard
- User Management Page
- Logs & Reports Page
- Storage Monitor Page

---

### 🎨 UI Requirements
- Clean, kiosk-style interface
- Mobile responsive (tablet-friendly)
- Notification bell icon with badge
- Real-time updates using Firebase listeners

---

## 📄 backend.md

### 🔥 Firebase Services
- Firebase Authentication
- Firestore Database
- Firebase Cloud Messaging (FCM)

---

### 🧱 Firestore Structure

#### users
- id
- name
- role (admin | user)
- points

#### transactions
- id
- userId
- type (bottle | redeem)
- amount
- timestamp

#### system
- riceStock
- bottleStorage
- maxBottleCapacity

---

### 🔐 Authentication Logic
- Single login system
- After login:
  - Fetch user role
  - Redirect based on role

---

## 📄 notifications.md

### 🔔 Push Notifications (FCM)

#### Triggers
- Rice stock == 0 → "Out of Rice"
- Bottle storage >= max → "Storage Full"
- Successful redemption

#### UI
- Notification bell widget
- Real-time notification dropdown

---

## 📄 logic.md

### ♻️ Bottle Insert Logic
1. Detect bottle insert (hardware trigger / button)
2. Convert to points
3. Update user points
4. Log transaction

---

### 🍚 Rice Redemption Logic
1. User selects redeem
2. Check if points >= required
3. Deduct points
4. Deduct rice stock
5. Log transaction

---

### 🚨 Storage Monitoring
- If bottleStorage >= maxBottleCapacity → notify admin
- If riceStock <= 0 → notify all users

---

## 📄 roles.md

### 👨‍💼 Admin
- Full access
- Manage users
- View logs
- Configure system

### 🏠 Household User
- Insert bottles
- Earn points
- Redeem rice
- View own history

---

## 📄 bonus_features.md

### ⚡ Advanced Ideas
- QR Code user identification
- Offline mode (sync when online)
- Analytics dashboard (charts)
- SMS fallback notifications
- Hardware IoT integration (Arduino / ESP32)

---

## 🧠 MASTER PROMPT (FOR AI GENERATION)

Create a full-stack web application for a "Plastic Bottle to Rice" system with the following specifications:

- Frontend: React (Vite) with Tailwind CSS
- Backend: Firebase (Auth, Firestore, FCM)
- Role-based authentication (Admin & Household User)
- Single login system that redirects based on role

Features:
- Bottle insertion system that converts bottles into points
- Points can be redeemed into rice
- Real-time rice stock and bottle storage monitoring
- Push notifications when storage is full or rice is empty
- Admin dashboard for monitoring users, logs, and system status
- Household dashboard for earning and redeeming points
- Full transaction logging system

UI Requirements:
- Mobile responsive
- Clean and simple interface
- Notification system with bell icon and dropdown

Database:
- Users collection with roles and points
- Transactions collection for logs
- System collection for storage tracking

Ensure:
- Real-time updates using Firebase listeners
- Secure authentication and role validation
- Scalable structure for future IoT integration

Output:
- Modular React components
- Clean folder structure
- Firebase integration ready
- Production-ready UI/UX

