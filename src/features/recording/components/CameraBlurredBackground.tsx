import { useEffect, useRef } from "react";
import { Camera } from "lucide-react";

interface CameraBlurredBackgroundProps {
  stream: MediaStream | null;
  blurAmount?: number;
  brightness?: number;
  className?: string;
}

export function CameraBlurredBackground({
  stream,
  blurAmount = 24,
  brightness = 0.75,
  className = "",
}: CameraBlurredBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  }, [stream]);

  if (!stream) {
    return (
      <div
        className={`absolute inset-0 bg-surface/40 pointer-events-none z-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none z-0 select-none ${className}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover scale-110 transition-all duration-300"
        style={{
          filter: `blur(${blurAmount}px) brightness(${brightness})`,
          transform: "scale(1.15)", // extra scale to prevent edge bleed during blur
        }}
      />
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-black/25 pointer-events-none" />
    </div>
  );
}
