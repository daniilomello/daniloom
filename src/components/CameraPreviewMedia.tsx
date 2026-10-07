import { useEffect, useRef } from "react";
import { processVideoBackgroundBlur } from "../utils/backgroundBlur";

interface CameraPreviewMediaProps {
  stream: MediaStream | null;
  cameraBlurEnabled: boolean;
  cameraBgBlurAmount: number;
  filterStyle: string;
  flipH: boolean;
  flipV: boolean;
  className?: string;
  style?: React.CSSProperties;
  objectPosition?: string;
}

export const CameraPreviewMedia = ({
  stream,
  cameraBlurEnabled,
  cameraBgBlurAmount,
  filterStyle,
  flipH,
  flipV,
  className = "w-full h-full object-cover",
  style = {},
  objectPosition,
}: CameraPreviewMediaProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current
          .play()
          .catch((e) => console.warn("Camera preview stream play error:", e));
      }
    }
  }, [stream]);

  useEffect(() => {
    let animId: number;
    const render = () => {
      if (
        cameraBlurEnabled &&
        canvasRef.current &&
        videoRef.current &&
        videoRef.current.readyState >= 2
      ) {
        const processed = processVideoBackgroundBlur(
          videoRef.current,
          cameraBgBlurAmount,
        );
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const vw = videoRef.current.videoWidth || 640;
        const vh = videoRef.current.videoHeight || 480;

        if (ctx && processed) {
          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
          }
          ctx.clearRect(0, 0, vw, vh);
          ctx.drawImage(processed, 0, 0, vw, vh);
        }
      }
      animId = requestAnimationFrame(render);
    };

    if (cameraBlurEnabled) {
      render();
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [cameraBlurEnabled, cameraBgBlurAmount]);

  const transformStyle = `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`;

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          display: cameraBlurEnabled ? "none" : "block",
          filter: filterStyle,
          transform: transformStyle,
          objectPosition: objectPosition || "center",
          ...style,
        }}
        className={className}
      />
      {cameraBlurEnabled && (
        <canvas
          ref={canvasRef}
          style={{
            filter: filterStyle,
            transform: transformStyle,
            objectPosition: objectPosition || "center",
            ...style,
          }}
          className={className}
        />
      )}
    </>
  );
};
