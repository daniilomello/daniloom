import { useEffect, useRef } from "react";

interface ScreenPreviewMediaProps {
  stream: MediaStream | null;
  className?: string;
  style?: React.CSSProperties;
}

export const ScreenPreviewMedia = ({
  stream,
  className = "w-full h-full object-contain bg-app",
  style = {},
}: ScreenPreviewMediaProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch((e) => {
          // Play can fail if document is not focused or user hasn't interacted, ignore non-fatal errors
          console.warn("Screen preview play warning:", e);
        });
      }
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={className}
      style={style}
    />
  );
};
