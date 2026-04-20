// src/components/Navbar.jsx
// Fixed top navigation bar with LumosPath branding and logout button.

import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const userName = getNavbarUserName(user);

  async function handleLogout() {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-bg-primary border-b border-neutral-800">
      {/* Logo */}
      <Link
        to="/dashboard"
        className="text-xl font-bold tracking-wide text-accent-red hover:text-accent-redHover transition-colors"
      >
        LumosPath
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <ThemeToggle compact />

        {user && (
          <span className="text-sm text-gray-400 hidden sm:block">
            Hi, {userName}
          </span>
        )}

        {user && (
          <button
            onClick={() => navigate("/profile")}
            className="text-sm px-4 py-1.5 rounded border border-neutral-600 text-gray-300
                       hover:border-accent-red hover:text-white transition-all duration-200"
          >
            Profile
          </button>
        )}

        {user && (
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-1.5 rounded border border-neutral-600 text-gray-300 
                       hover:border-accent-red hover:text-white transition-all duration-200"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}

function getNavbarUserName(user) {
  const fallback = user?.email ? user.email.split("@")[0] : "Learner";
  const rawName = (user?.displayName || fallback || "Learner").trim();
  const firstToken = rawName.split(" ").filter(Boolean)[0];
  return firstToken || "Learner";
}
