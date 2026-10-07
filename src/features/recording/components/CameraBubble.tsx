import { useEffect, useRef, useState } from "react";
import { Video, VideoOff, Zap } from "lucide-react";
import { processVideoBackgroundBlur } from "../../../utils/backgroundBlur";

interface CameraBubbleProps {
  stream: MediaStream | null;
  size: "sm" | "md" | "lg";
  isVisible: boolean;
  shape?:
    "circle" | "rectangle" | "split" | "hidden" | "centralized" | "fullscreen";
  filter?: string;
  brightness?: number;
  contrast?: number;
  shadow?: number;
  blackPoint?: number;
  flipH?: boolean;
  flipV?: boolean;
  performanceMode?: boolean;
  cameraBlurEnabled?: boolean;
  cameraBgBlurAmount?: number;
  studioLightEnabled?: boolean;
  studioLightIntensity?: number;
  micPulseEnabled?: boolean;
  isSpeaking?: boolean;
}

export const CameraBubble = ({
  stream,
  size,
  isVisible,
  shape = "circle",
  filter = "none",
  brightness = 100,
  contrast = 100,
  shadow = 0,
  blackPoint = 0,
  flipH = true,
  flipV = false,
  performanceMode = false,
  cameraBlurEnabled = false,
  cameraBgBlurAmount = 12,
  studioLightEnabled = false,
  studioLightIntensity = 50,
  micPulseEnabled = false,
  isSpeaking = false,
}: CameraBubbleProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [position, setPosition] = useState({ x: 30, y: 30 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (videoRef.current && stream && !performanceMode) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, performanceMode]);

  // Handle continuous canvas rendering when background blur is enabled
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

  if (
    !isVisible ||
    shape === "hidden" ||
    shape === "split" ||
    shape === "centralized" ||
    shape === "fullscreen"
  )
    return null;

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...position };
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    // Bounds check to keep inside screen
    const newX = Math.max(
      10,
      Math.min(window.innerWidth - 300, positionStartRef.current.x + dx),
    );
    const newY = Math.max(
      10,
      Math.min(window.innerHeight - 300, positionStartRef.current.y + dy),
    );

    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add event listeners on window during drag for smooth tracking
  if (isDragging) {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  } else {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }

  // Bubble size dimensions
  const isCircle = shape === "circle";
  const dimensions = isCircle
    ? {
        sm: "w-56 h-56 md:w-64 md:h-64",
        md: "w-80 h-80 md:w-96 md:h-96",
        lg: "w-[448px] h-[448px] md:w-[512px] md:h-[512px]",
      }[size]
    : {
        sm: "w-72 h-56 md:w-80 md:h-60",
        md: "w-[416px] h-80 md:w-[480px] md:h-90",
        lg: "w-[576px] h-[448px] md:w-[640px] md:h-[480px]",
      }[size];

  const getFilterStyleValue = (filterName: string) => {
    let baseFilter = "";
    switch (filterName) {
      case "grayscale":
        baseFilter = "grayscale(100%)";
        break;
      case "warm":
        baseFilter = "sepia(30%) saturate(140%) hue-rotate(-10deg)";
        break;
      case "cool":
        baseFilter =
          "saturate(85%) contrast(106%) brightness(103%) hue-rotate(-10deg)";
        break;
      default:
        baseFilter = "";
        break;
    }

    let adjustedContrast = Math.max(
      10,
      contrast + blackPoint * 0.5 - shadow * 0.3,
    );
    let adjustedBrightness = Math.max(
      10,
      brightness - blackPoint * 0.2 + shadow * 0.15,
    );

    // Apply Studio Light Curve if enabled
    if (studioLightEnabled) {
      adjustedBrightness += studioLightIntensity * 0.18;
      adjustedContrast += studioLightIntensity * 0.1;
    }

    return `${baseFilter} brightness(${adjustedBrightness}%) contrast(${adjustedContrast}%)`.trim();
  };

  const isPulseActive = micPulseEnabled && isSpeaking;

  return (
    <div
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
      }}
      className={`relative cursor-move border border-white/20 shadow-2xl overflow-hidden transition-all duration-300 group ${dimensions} ${
        isCircle ? "rounded-full" : "rounded-3xl"
      } ${isDragging ? "shadow-xs scale-[1.02]" : ""} ${
        isPulseActive
          ? "ring-4 ring-line-strong animate-pulse shadow-xs shadow-xl"
          : ""
      }`}
      onMouseDown={handleMouseDown}
    >
      {performanceMode ? (
        <div className="w-full h-full bg-app/90 backdrop-blur border border-line flex flex-col items-center justify-center text-fg-muted p-2 text-center">
          <Zap className="w-6 h-6 mb-1 animate-bounce text-fg-muted" />
          <span className="text-meta font-bold uppercase font-mono tracking-wider">
            Modo Desempenho
          </span>
          <span className="text-meta text-fg-muted mt-0.5">
            Prévia pausada para economizar CPU
          </span>
        </div>
      ) : stream ? (
        <div className="relative w-full h-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              display: cameraBlurEnabled ? "none" : "block",
              filter: getFilterStyleValue(filter),
              transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
            }}
            className="w-full h-full object-cover"
          />

          {cameraBlurEnabled && (
            <canvas
              ref={canvasRef}
              style={{
                filter: getFilterStyleValue(filter),
                transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
              }}
              className="w-full h-full object-cover"
            />
          )}

          {/* Studio Light Warm Portrait Ring & Soft Center Spotlight Overlay */}
          {studioLightEnabled && (
            <div
              className="absolute inset-0 pointer-events-none rounded-inherit transition-opacity duration-300 mix-blend-soft-light"
              style={{
                background: `radial-gradient(circle at 50% 40%, rgba(255, 248, 230, ${0.35 * (studioLightIntensity / 100)}) 0%, rgba(255, 215, 180, ${0.15 * (studioLightIntensity / 100)}) 50%, rgba(0, 0, 0, ${0.25 * (studioLightIntensity / 100)}) 100%)`,
                boxShadow: `inset 0 0 ${20 + studioLightIntensity * 0.3}px rgba(255, 235, 200, ${0.2 + studioLightIntensity * 0.003})`,
              }}
            />
          )}
        </div>
      ) : (
        <div className="w-full h-full bg-surface flex flex-col items-center justify-center text-fg-muted">
          <VideoOff className="w-8 h-8 mb-1 animate-pulse" />
          <span className="text-meta font-mono">Sem Câmera</span>
        </div>
      )}

      {/* Floating Indicator */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
        <div className="bg-app/80 rounded-full px-2.5 py-1 flex items-center gap-1.5 text-fg shadow-lg">
          <Video className="w-3.5 h-3.5 text-fg-muted animate-pulse" />
          <span className="text-meta font-medium tracking-wide uppercase font-sans">
            Câmera ativa
          </span>
        </div>
      </div>
    </div>
  );
};
