import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

function LoadingScreen() {
  return (
    <div className="centered-screen">
      <p>Checking access...</p>
    </div>
  );
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    const redirectPath =
      currentUser.role === "admin" ? "/admin/dashboard" : "/user/home";
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}
