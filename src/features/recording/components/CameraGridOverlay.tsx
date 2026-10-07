import React from "react";

interface CameraGridOverlayProps {
  enabled: boolean;
  className?: string;
  showCenterDot?: boolean;
}

/**
 * CameraGridOverlay
 * Minimalist 3x3 alignment grid with a subtle center red reference dot.
 */
export const CameraGridOverlay: React.FC<CameraGridOverlayProps> = ({
  enabled,
  className = "",
  showCenterDot = true,
}) => {
  if (!enabled) return null;

  return (
    <div
      className={`absolute inset-0 pointer-events-none select-none z-20 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* 3x3 Minimalist Rule of Thirds Grid Lines */}
      {/* Vertical Line 1 (33.33%) */}
      <div
        className="absolute top-0 bottom-0 w-[1px] bg-white/25 shadow-[0_0_1px_rgba(0,0,0,0.6)]"
        style={{ left: "33.333%" }}
      />
      {/* Vertical Line 2 (66.67%) */}
      <div
        className="absolute top-0 bottom-0 w-[1px] bg-white/25 shadow-[0_0_1px_rgba(0,0,0,0.6)]"
        style={{ left: "66.666%" }}
      />

      {/* Horizontal Line 1 (33.33%) */}
      <div
        className="absolute left-0 right-0 h-[1px] bg-white/25 shadow-[0_0_1px_rgba(0,0,0,0.6)]"
        style={{ top: "33.333%" }}
      />
      {/* Horizontal Line 2 (66.67%) */}
      <div
        className="absolute left-0 right-0 h-[1px] bg-white/25 shadow-[0_0_1px_rgba(0,0,0,0.6)]"
        style={{ top: "66.666%" }}
      />

      {/* Minimalist Center Red Dot */}
      {showCenterDot && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-inverse shadow-[0_0_4px_rgba(0,0,0,0.8),0_0_8px_rgba(244,63,94,0.4)] ring-1 ring-white/30" />
        </div>
      )}
    </div>
  );
};
