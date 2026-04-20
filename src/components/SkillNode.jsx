// src/components/SkillNode.jsx
// Custom React Flow node component.
// Displays topic title with color-coded state: locked / unlocked / completed.

import { memo } from "react";
import { Handle, Position } from "reactflow";

/**
 * Node state → visual style mapping
 *   locked    → dark gray, non-interactive look
 *   unlocked  → red accent with pulse animation (ready to learn)
 *   completed → green (done)
 */
const STATE_STYLES = {
  locked: {
    border: "border-neutral-700",
    bg: "bg-neutral-800",
    text: "text-neutral-500",
    icon: "🔒",
    label: "Locked",
    labelColor: "text-neutral-600",
  },
  unlocked: {
    border: "border-red-600",
    bg: "bg-bg-card",
    text: "text-white",
    icon: "🔴",
    label: "Unlocked",
    labelColor: "text-red-500",
    pulse: true,
  },
  completed: {
    border: "border-green-600",
    bg: "bg-bg-card",
    text: "text-white",
    icon: "✅",
    label: "Completed",
    labelColor: "text-green-500",
  },
};

function SkillNode({ data }) {
  const { label, state = "locked", onClick } = data;
  const style = STATE_STYLES[state] || STATE_STYLES.locked;
  const isLocked = state === "locked";

  return (
    <div
      onClick={isLocked ? undefined : onClick}
      className={`
        relative w-44 rounded-lg border-2 px-4 py-3 text-center
        transition-all duration-200 select-none
        ${style.bg} ${style.border} ${style.text}
        ${isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:scale-105 hover:shadow-lg"}
        ${style.pulse ? "animate-pulse-red" : ""}
      `}
    >
      {/* Handles for edges */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-neutral-600 !w-2 !h-2 !border-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-neutral-600 !w-2 !h-2 !border-0"
      />

      {/* Icon */}
      <div className="text-lg mb-1">{style.icon}</div>

      {/* Topic title */}
      <div className="font-semibold text-sm leading-tight">{label}</div>

      {/* State badge */}
      <div className={`text-xs mt-1 font-medium ${style.labelColor}`}>
        {style.label}
      </div>
    </div>
  );
}

// Memoize to avoid unnecessary re-renders when parent re-renders
export default memo(SkillNode);
