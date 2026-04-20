import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded border border-neutral-600 px-3 py-1.5 text-xs font-medium text-gray-300
                 hover:border-accent-red hover:text-white transition-colors"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {compact ? (isDark ? "☀" : "☾") : isDark ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
