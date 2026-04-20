// src/components/ProtectedRoute.jsx
// Redirects unauthenticated users to /login.

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loader from "./Loader";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Still resolving Firebase auth state
  if (loading) return <Loader />;

  // Not logged in — send to login page
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
