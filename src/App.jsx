// src/App.jsx
// Root routing component.
// Protected routes require the user to be logged in (via AuthContext).
// Pages are lazy-loaded to reduce initial bundle size (#7 React.lazy + Suspense).

import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Loader from "./components/Loader";

// Lazy-load heavy page components — they are code-split into separate chunks
// so the initial load only downloads the Login page bundle.
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SkillTree = lazy(() => import("./pages/SkillTree"));
const TopicDetails = lazy(() => import("./pages/TopicDetails"));
const Profile = lazy(() => import("./pages/Profile"));

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<Loader message="Loading..." />}>
              <Routes>
                {/* Public */}
                <Route path="/login" element={<Login />} />

                {/* Protected */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/skill/:id"
                  element={
                    <ProtectedRoute>
                      <SkillTree />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topic/:id"
                  element={
                    <ProtectedRoute>
                      <TopicDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />

                {/* Default redirect */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
