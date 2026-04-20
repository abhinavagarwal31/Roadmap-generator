// src/pages/Login.jsx
// Email/password login + signup form with toggle.
// Redirects to /dashboard on success.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isFirebaseConfigured } from "../services/firebase";
import ThemeToggle from "../components/ThemeToggle";

export default function Login() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Form submit ──────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignup) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
      navigate("/dashboard");
    } catch (err) {
      // Map common Firebase error codes to user-friendly messages
      const msg = friendlyError(err.code);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex justify-end mb-3">
          <ThemeToggle />
        </div>

        {/* Card */}
        <div className="bg-bg-card rounded-lg p-8 shadow-2xl border border-neutral-800">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-accent-red tracking-wide mb-1">
              LumosPath
            </h1>
            <p className="text-gray-400 text-sm">Learning Path Visualizer</p>
          </div>

          {/* Demo mode banner */}
          {!isFirebaseConfigured && (
            <div className="mb-5 px-3 py-2.5 rounded border border-yellow-800 bg-yellow-950 text-yellow-300 text-xs leading-relaxed">
              <strong>Demo Mode</strong> — Firebase is not configured. Any email/password will work.
              Progress is saved locally in your browser.{" "}
              <a
                href="https://console.firebase.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-yellow-100"
              >
                Set up Firebase →
              </a>
            </div>
          )}

          {/* Toggle */}
          <div className="flex rounded-md overflow-hidden border border-neutral-700 mb-6">
            <button
              type="button"
              onClick={() => { setIsSignup(false); setError(""); }}
              className={`flex-1 py-2 text-sm font-medium transition-all ${
                !isSignup
                  ? "bg-accent-red text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setIsSignup(true); setError(""); }}
              className={`flex-1 py-2 text-sm font-medium transition-all ${
                isSignup
                  ? "bg-accent-red text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm text-gray-400 mb-1" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-bg-elevated border border-neutral-700 rounded px-3 py-2.5 text-sm
                           text-white placeholder-gray-600 outline-none
                           focus:border-accent-red transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-400 mb-1" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full bg-bg-elevated border border-neutral-700 rounded px-3 py-2.5 text-sm
                           text-white placeholder-gray-600 outline-none
                           focus:border-accent-red transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-400 text-sm bg-red-950 border border-red-900 rounded px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded font-semibold text-sm bg-accent-red text-white
                         hover:bg-accent-redHover active:bg-accent-redDim transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Please wait..." : isSignup ? "Create Account" : "Sign In"}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-gray-600 mt-6">
            {isSignup ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={() => { setIsSignup(!isSignup); setError(""); }}
              className="text-accent-red hover:underline"
            >
              {isSignup ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function friendlyError(code) {
  const map = {
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/email-already-in-use": "That email is already registered.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
  };
  return map[code] || "Something went wrong. Please try again.";
}
