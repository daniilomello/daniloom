import { useEffect, useRef, useState } from "react";
import { Mic, Volume2, VolumeX } from "lucide-react";

interface VUMeterProps {
  stream: MediaStream | null;
  onVolumeChange?: (volumeRatio: number, dbLevel: number) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  autoDucking?: boolean;
  className?: string;
  showLabels?: boolean;
}

export const VUMeter = ({
  stream,
  onVolumeChange,
  onSpeakingChange,
  autoDucking = true,
  className = "",
  showLabels = true,
}: VUMeterProps) => {
  const [levelRatio, setLevelRatio] = useState<number>(0);
  const [dbValue, setDbValue] = useState<number>(-60);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream) {
      setLevelRatio(0);
      setDbValue(-60);
      if (onVolumeChange) onVolumeChange(0, -60);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled) {
      setLevelRatio(0);
      setDbValue(-60);
      if (onVolumeChange) onVolumeChange(0, -60);
      return;
    }

    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioCtxClass();
      source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!analyser) return;

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength) / 255; // 0 to 1

        // Convert to dB (-60 to 0)
        let db = -60;
        if (rms > 0.0001) {
          db = Math.max(-60, Math.min(0, 20 * Math.log10(rms)));
        }

        const normRatio = Math.max(0, Math.min(1, (db + 60) / 60));

        setLevelRatio(normRatio);
        setDbValue(Math.round(db));

        if (onSpeakingChange) {
          onSpeakingChange(db > -38);
        }

        if (onVolumeChange) {
          onVolumeChange(normRatio, db);
        }

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn("Error starting VU meter audio context:", err);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (source) {
        try { source.disconnect(); } catch (e) {}
      }
      if (audioCtx && audioCtx.state !== "closed") {
        try { audioCtx.close(); } catch (e) {}
      }
    };
  }, [stream]);

  const numBars = 20;

  return (
    <div className={`flex flex-col gap-1.5 p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl ${className}`}>
      {showLabels && (
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            {levelRatio > 0.05 ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Entrada de Microfone (VU)</span>
          </div>
          <span className={dbValue > -10 ? "text-rose-400 font-bold" : dbValue > -25 ? "text-amber-400" : "text-emerald-400"}>
            {dbValue > -60 ? `${dbValue} dB` : "Silêncio"}
          </span>
        </div>
      )}

      {/* LED VU Meter Bars */}
      <div className="flex items-center gap-1 w-full h-3.5 bg-slate-950 p-1 rounded-lg border border-slate-800/80">
        {Array.from({ length: numBars }).map((_, idx) => {
          const barRatio = (idx + 1) / numBars;
          const isActive = levelRatio >= barRatio;

          // Color calculation: green -> yellow -> red
          let activeColor = "bg-emerald-500 shadow-emerald-500/50";
          if (barRatio > 0.8) {
            activeColor = "bg-rose-500 shadow-rose-500/50";
          } else if (barRatio > 0.6) {
            activeColor = "bg-amber-400 shadow-amber-400/50";
          }

          return (
            <div
              key={idx}
              className={`flex-1 h-full rounded-sm transition-all duration-75 ${
                isActive ? `${activeColor} shadow-sm` : "bg-slate-800/50"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};
