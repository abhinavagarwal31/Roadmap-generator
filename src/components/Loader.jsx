// src/components/Loader.jsx
// Full-screen loading spinner with Netflix-red accent.

export default function Loader({ message = "Loading..." }) {
  return (
    <div className="fixed inset-0 bg-bg-primary flex flex-col items-center justify-center z-50">
      {/* Spinner */}
      <div className="w-10 h-10 border-4 border-neutral-700 border-t-accent-red rounded-full animate-spin mb-4" />
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
}
