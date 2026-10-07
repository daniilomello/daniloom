import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Download,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Slider } from "./ui";

interface CustomPlayerProps {
  src: string;
  subtitles?: any[];
  subtitleConfig?: any;
  downloadName?: string;
  onTimeUpdateCallback?: (currentTime: number) => void;
  cuts?: { start: number; end: number }[];
  theme?: "emerald" | "purple";
  isDanscript?: boolean;
}

export const CustomPlayer = forwardRef<HTMLVideoElement, CustomPlayerProps>(
  (
    {
      src,
      downloadName = "video.mp4",
      onTimeUpdateCallback,
      cuts = [],
      theme = "emerald",
      isDanscript = false,
    },
    ref,
  ) => {
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Expose the video ref properly
    useImperativeHandle(ref, () => localVideoRef.current as HTMLVideoElement);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
      try {
        const saved = localStorage.getItem("daniloom_player_playback_speed");
        if (saved) {
          const parsed = parseFloat(saved);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
      } catch (e) {}
      return 1;
    });
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isControlsVisible, setIsControlsVisible] = useState(true);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Popups for volume and speed controls
    const [isVolumeOpen, setIsVolumeOpen] = useState(false);
    const [isSpeedOpen, setIsSpeedOpen] = useState(false);
    const volumeRef = useRef<HTMLDivElement>(null);
    const speedRef = useRef<HTMLDivElement>(null);

    // Auto-close popups when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          volumeRef.current &&
          !volumeRef.current.contains(event.target as Node)
        ) {
          setIsVolumeOpen(false);
        }
        if (
          speedRef.current &&
          !speedRef.current.contains(event.target as Node)
        ) {
          setIsSpeedOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    // Handle auto-hiding controls during inactivity
    const resetControlsTimeout = () => {
      setIsControlsVisible(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setIsControlsVisible(false);
        }
      }, 2500);
    };

    useEffect(() => {
      resetControlsTimeout();
      return () => {
        if (controlsTimeoutRef.current)
          clearTimeout(controlsTimeoutRef.current);
      };
    }, [isPlaying]);

    const handlePlayPause = () => {
      if (!localVideoRef.current) return;
      if (isPlaying) {
        localVideoRef.current.pause();
      } else {
        localVideoRef.current
          .play()
          .catch((err) => console.warn("Playback error:", err));
      }
    };

    const handleSkip = (seconds: number) => {
      if (!localVideoRef.current) return;
      localVideoRef.current.currentTime = Math.max(
        0,
        Math.min(duration, localVideoRef.current.currentTime + seconds),
      );
    };

    const handleSpeedChange = (speed: number) => {
      if (localVideoRef.current) {
        localVideoRef.current.playbackRate = speed;
      }
      setPlaybackSpeed(speed);
      try {
        localStorage.setItem("daniloom_player_playback_speed", String(speed));
      } catch (e) {}
    };

    useEffect(() => {
      if (localVideoRef.current) {
        localVideoRef.current.playbackRate = playbackSpeed;
      }
    }, [src, playbackSpeed]);

    const handleVolumeChange = (e: number | React.ChangeEvent<HTMLInputElement>) => {
      const val = typeof e === "number" ? e : Number(e.target.value);
      setVolume(val);
      if (localVideoRef.current) {
        localVideoRef.current.volume = val;
        localVideoRef.current.muted = val === 0;
        setIsMuted(val === 0);
      }
    };

    const toggleMute = () => {
      if (!localVideoRef.current) return;
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      localVideoRef.current.muted = newMuted;
    };

    const handleSeek = (e: number | React.ChangeEvent<HTMLInputElement>) => {
      const val = typeof e === "number" ? e : Number(e.target.value);
      setCurrentTime(val);
      if (localVideoRef.current) {
        localVideoRef.current.currentTime = val;
      }
    };

    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
        containerRef.current
          .requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch((err) => console.error("Error enabling fullscreen:", err));
      } else {
        document
          .exitFullscreen()
          .then(() => setIsFullscreen(false))
          .catch((err) => console.error("Error exiting fullscreen:", err));
      }
    };

    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => {
        document.removeEventListener(
          "fullscreenchange",
          handleFullscreenChange,
        );
      };
    }, []);

    const formatTime = (timeInSeconds: number) => {
      if (isNaN(timeInSeconds)) return "00:00";
      const mins = Math.floor(timeInSeconds / 60);
      const secs = Math.floor(timeInSeconds % 60);
      return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const downloadVideo = () => {
      if (!src) return;
      const a = document.createElement("a");
      a.href = src;
      let finalName = (downloadName || "video.mp4").replace(/\.(webm|mov|mkv)$/i, "");
      if (!finalName.toLowerCase().endsWith(".mp4")) {
        finalName += ".mp4";
      }
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    return (
      <div
        id="custom-player-container"
        ref={containerRef}
        onMouseMove={resetControlsTimeout}
        onMouseLeave={() => isPlaying && setIsControlsVisible(false)}
        className="relative w-full h-full flex items-center justify-center bg-app rounded-2xl overflow-hidden group/player select-none transition-all duration-300"
      >
        {/* Video element */}
        <video
          ref={localVideoRef}
          src={src}
          playsInline
          className="w-full h-full object-contain cursor-pointer bg-app"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;

            if (cuts && cuts.length > 0) {
              const activeCut = cuts.find(
                (cut) => t >= cut.start && t < cut.end,
              );
              if (activeCut) {
                e.currentTarget.currentTime = activeCut.end;
                setCurrentTime(activeCut.end);
                if (onTimeUpdateCallback) {
                  onTimeUpdateCallback(activeCut.end);
                }
                return;
              }
            }

            setCurrentTime(t);
            if (onTimeUpdateCallback) {
              onTimeUpdateCallback(t);
            }
          }}
          onClick={handlePlayPause}
        />

        {/* Play/Pause Overlay indicator on click */}
        <div
          onClick={handlePlayPause}
          className="absolute inset-0 bg-transparent flex items-center justify-center z-5"
        />

        {/* Custom Controller Overlay Panel */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-app via-app/80 to-transparent flex flex-col gap-3 transition-opacity duration-300 z-10 ${
            isControlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Seek timeline */}
          <div className="flex items-center gap-3 w-full">
            <span className="text-meta font-mono text-fg-secondary w-10 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <div className="flex-grow flex items-center">
              <Slider
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                aria-label="Linha do tempo de reprodução"
              />
            </div>
            <span className="text-meta font-mono text-fg-secondary w-10 text-left shrink-0">
              {formatTime(duration)}
            </span>
          </div>

          {/* Action Controls Toolbar */}
          <div className="flex items-center justify-between w-full">
            {/* Left: Playback Controls */}
            <div className="flex items-center gap-2">
              {/* Play/Pause Button */}
              <button
                onClick={handlePlayPause}
                className="w-8 h-8 rounded-full bg-inverse hover:bg-inverse text-on-inverse flex items-center justify-center transition-all shadow-md cursor-pointer shrink-0"
                title={isPlaying ? "Pausar" : "Reproduzir"}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                )}
              </button>

              {/* Back 10s */}
              <button
                onClick={() => handleSkip(-10)}
                className="h-8 px-2.5 rounded-lg bg-surface/60 hover:bg-muted text-fg-secondary hover:text-fg border border-line/40 transition-all flex items-center justify-center cursor-pointer"
                title="Voltar 10 segundos"
              >
                <span className="text-meta font-bold font-mono">-10s</span>
              </button>

              {/* Forward 10s */}
              <button
                onClick={() => handleSkip(10)}
                className="h-8 px-2.5 rounded-lg bg-surface/60 hover:bg-muted text-fg-secondary hover:text-fg border border-line/40 transition-all flex items-center justify-center cursor-pointer"
                title="Avançar 10 segundos"
              >
                <span className="text-meta font-bold font-mono">+10s</span>
              </button>

              {/* Volume control */}
              <div ref={volumeRef} className="relative">
                <button
                  onClick={() => setIsVolumeOpen(!isVolumeOpen)}
                  className="w-8 h-8 rounded-lg bg-surface/60 hover:bg-muted text-fg-secondary hover:text-fg border border-line/40 flex items-center justify-center cursor-pointer"
                  title="Ajustar Volume"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-fg-muted" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>

                {isVolumeOpen && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-app border border-line/80 rounded-xl p-3 shadow-2xl flex flex-col items-center gap-2 z-50 animate-fade-in w-10">
                    <div className="h-24 flex items-center justify-center py-1">
                      <Slider
                        orientation="vertical"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        aria-label="Volume"
                      />
                    </div>
                    <span className="text-meta font-mono font-bold text-fg-secondary">
                      {Math.round((isMuted ? 0 : volume) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Speed, Download and Fullscreen Controls */}
            <div className="flex items-center gap-2">
              {/* Playback Speed selector */}
              <div ref={speedRef} className="relative">
                <button
                  onClick={() => setIsSpeedOpen(!isSpeedOpen)}
                  className="h-8 px-2.5 rounded-lg border bg-surface/60 border-line/60 text-fg-secondary hover:text-fg hover:bg-muted transition-all flex items-center justify-center gap-1 cursor-pointer"
                  title="Ajustar Velocidade"
                >
                  <span className="text-meta font-mono font-bold">
                    {playbackSpeed}x
                  </span>
                </button>

                {isSpeedOpen && (
                  <div className="absolute bottom-full right-0 mb-2 bg-app border border-line/80 rounded-xl p-1 shadow-2xl flex flex-col gap-0.5 z-50 animate-fade-in w-14">
                    {[1, 1.5, 2, 3].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => {
                          handleSpeedChange(speed);
                          setIsSpeedOpen(false);
                        }}
                        className={`w-full py-1 rounded text-meta font-bold font-mono transition-all cursor-pointer text-center ${
                          playbackSpeed === speed
                            ? "ds-active"
                            : "text-fg-muted hover:text-fg-default hover:bg-muted"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Download Video button */}
              <button
                onClick={downloadVideo}
                className="w-8 h-8 rounded-lg bg-surface/60 hover:bg-muted text-fg-secondary hover:text-fg border border-line/60 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                title="Baixar vídeo"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {/* Fullscreen button */}
              <button
                onClick={toggleFullscreen}
                className="w-8 h-8 rounded-lg bg-surface/60 hover:bg-muted text-fg-secondary hover:text-fg border border-line/60 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                title="Tela cheia"
              >
                {isFullscreen ? (
                  <Minimize className="w-3.5 h-3.5" />
                ) : (
                  <Maximize className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

CustomPlayer.displayName = "CustomPlayer";
