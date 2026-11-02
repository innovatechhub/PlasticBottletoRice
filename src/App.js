import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./app/AuthContext";
import { DataProvider } from "./app/DataContext";
import ProtectedRoute from "./app/ProtectedRoute";
import AppLayout from "./components/Layout";
import LoadingScreen from "./components/LoadingScreen";
import "./App.css";
import "./resident.css";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminHardwarePage from "./pages/admin/AdminHardwarePage";
import AdminLogsPage from "./pages/admin/AdminLogsPage";
import AdminStoragePage from "./pages/admin/AdminStoragePage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminUserViewPage from "./pages/admin/AdminUserViewPage";
import AboutUsPage from "./pages/AboutUsPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RewardsPage from "./pages/RewardsPage";
import UserAccountPage from "./pages/user/UserAccountPage";
import UserHistoryPage from "./pages/user/UserHistoryPage";
import UserHomePage from "./pages/user/UserHomePage";
import UserRedeemPage from "./pages/user/UserRedeemPage";

function LoginRoute() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (currentUser) {
    return (
      <Navigate
        to={currentUser.role === "admin" ? "/admin/dashboard" : "/user/home"}
        replace
      />
    );
  }

  return <LoginPage />;
}

function AppRoutes() {
  const { currentUser, loading } = useAuth();

  const defaultRoute = currentUser
    ? currentUser.role === "admin"
      ? "/admin/dashboard"
      : "/user/home"
    : "/";

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/rewards" element={<RewardsPage />} />
      <Route path="/about-us" element={<AboutUsPage />} />
      <Route path="/login" element={<LoginRoute />} />

      <Route
        path="/user/home"
        element={
          <ProtectedRoute allowedRoles={["user"]}>
            <AppLayout title="Home">
              <UserHomePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/redeem"
        element={
          <ProtectedRoute allowedRoles={["user"]}>
            <AppLayout title="Redeem Rice">
              <UserRedeemPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/history"
        element={
          <ProtectedRoute allowedRoles={["user"]}>
            <AppLayout title="Transaction History">
              <UserHistoryPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/account"
        element={
          <ProtectedRoute allowedRoles={["user"]}>
            <AppLayout title="Account">
              <UserAccountPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppLayout title="Dashboard">
              <AdminDashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppLayout title="Residents">
              <AdminUsersPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users/:userId"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppLayout title="Resident profile">
              <AdminUserViewPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/logs"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppLayout title="Logs">
              <AdminLogsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/hardware"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppLayout title="Hardware">
              <AdminHardwarePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/storage"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppLayout title="Storage">
              <AdminStoragePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={loading ? <LoadingScreen /> : <Navigate to={defaultRoute} replace />}
      />
    </Routes>
  );
}

function App() {
  return (
    <DataProvider>
      <AuthProvider>
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </DataProvider>
  );
}

export default App;
