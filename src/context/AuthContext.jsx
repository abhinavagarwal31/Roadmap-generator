// src/context/AuthContext.jsx
// Provides Firebase auth state to the entire app.
// Exposes: user, loading, login(), signup(), logout()
// Demo mode is enabled only when VITE_ENABLE_DEMO_MODE=true.

/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useState } from "react";
import Loader from "../components/Loader";
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { auth, isDemoModeEnabled, isFirebaseConfigured } from "../services/firebase";

// Create the context
const AuthContext = createContext(null);

// ─── Demo mode helpers (no Firebase needed) ───────────────────────────────────
// When Firebase credentials are not set up, we fall back to a simple in-memory
// session so the UI can still be tested without a real Firebase project.

const DEMO_USER_KEY = "lumospath_demo_user";
const LEGACY_DEMO_USER_KEY = "skillpath_demo_user";

function getDemoUser() {
  try {
    const raw = localStorage.getItem(DEMO_USER_KEY);
    if (raw) return JSON.parse(raw);

    const legacyRaw = localStorage.getItem(LEGACY_DEMO_USER_KEY);
    const legacyUser = legacyRaw ? JSON.parse(legacyRaw) : null;
    if (legacyUser) {
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(legacyUser));
      localStorage.removeItem(LEGACY_DEMO_USER_KEY);
    }
    return legacyUser;
  } catch {
    return null;
  }
}

function setDemoUser(userData) {
  if (userData) localStorage.setItem(DEMO_USER_KEY, JSON.stringify(userData));
  else {
    localStorage.removeItem(DEMO_USER_KEY);
    localStorage.removeItem(LEGACY_DEMO_USER_KEY);
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const useDemoMode = isDemoModeEnabled && !isFirebaseConfigured;

  const [user, setUser] = useState(() => (useDemoMode ? getDemoUser() : null));
  const [loading, setLoading] = useState(() => !useDemoMode && isFirebaseConfigured && !!auth);

  useEffect(() => {
    if (useDemoMode) {
      return;
    }

    if (!isFirebaseConfigured || !auth) {
      return;
    }

    // Real Firebase mode: listen to auth state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      },
      (error) => {
        console.error("Auth observer error:", error.message);
        setLoading(false);
      }
    );

    const timeout = setTimeout(() => setLoading(false), 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [useDemoMode]);

  function ensureFirebaseAuthAvailable() {
    if (!isFirebaseConfigured || !auth) {
      throw new Error("Firebase authentication is not configured for this environment.");
    }
  }

  // ── Auth actions ────────────────────────────────────────────────────────

  async function signup(email, password) {
    if (useDemoMode) {
      // Demo mode: fake signup
      const demoUser = {
        uid: `demo-${Date.now()}`,
        email,
        displayName: email.split("@")[0],
        demoPassword: password,
      };
      setDemoUser(demoUser);
      setUser(demoUser);
      return { user: demoUser };
    }
    ensureFirebaseAuthAvailable();
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result;
  }

  async function login(email, password) {
    if (useDemoMode) {
      // Demo mode: any email/password combo works
      const demoUser = {
        uid: `demo-${email.replace(/\W/g, "")}`,
        email,
        displayName: email.split("@")[0],
        demoPassword: password,
      };
      setDemoUser(demoUser);
      setUser(demoUser);
      return { user: demoUser };
    }
    ensureFirebaseAuthAvailable();
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result;
  }

  async function logout() {
    if (useDemoMode) {
      setDemoUser(null);
      setUser(null);
      return;
    }
    ensureFirebaseAuthAvailable();
    await signOut(auth);
  }

  async function changePasswordForUser(currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw new Error("Please enter both current and new password.");
    }

    if (newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters.");
    }

    if (useDemoMode) {
      const demoUser = getDemoUser();
      if (!demoUser) throw new Error("No active user session.");
      if ((demoUser.demoPassword || "") !== currentPassword) {
        throw new Error("Current password is incorrect.");
      }

      const updated = { ...demoUser, demoPassword: newPassword };
      setDemoUser(updated);
      setUser(updated);
      return;
    }

    ensureFirebaseAuthAvailable();

    const activeUser = auth?.currentUser;
    if (!activeUser?.email) {
      throw new Error("No authenticated user found.");
    }

    const credential = EmailAuthProvider.credential(activeUser.email, currentPassword);
    await reauthenticateWithCredential(activeUser, credential);
    await updatePassword(activeUser, newPassword);
  }

  async function updateDisplayNameForUser(nextDisplayName) {
    const displayName = String(nextDisplayName || "").trim();
    if (!displayName) {
      throw new Error("Display name cannot be empty.");
    }

    if (useDemoMode) {
      const demoUser = getDemoUser();
      if (!demoUser) throw new Error("No active user session.");

      const updated = { ...demoUser, displayName };
      setDemoUser(updated);
      setUser(updated);
      return;
    }

    ensureFirebaseAuthAvailable();

    const activeUser = auth?.currentUser;
    if (!activeUser) {
      throw new Error("No authenticated user found.");
    }

    await updateProfile(activeUser, { displayName });
    setUser((prev) => (prev ? { ...prev, displayName } : prev));
  }

  const value = {
    user,
    loading,
    signup,
    login,
    logout,
    changePassword: changePasswordForUser,
    updateDisplayName: updateDisplayNameForUser,
    isDemoMode: useDemoMode,
  };

  // Show a full-screen spinner while Firebase resolves the auth state.
  // This prevents a flash of the login page for already-authenticated users.
  if (loading) return <Loader message="Authenticating..." />;

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }
  return ctx;
}
