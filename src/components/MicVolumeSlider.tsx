import React, { useEffect, useRef, useState } from "react";
import { Slider } from "./ui";

interface MicVolumeSliderProps {
  stream: MediaStream | null;
  volume: number; // 0 to 200 (100 is default 1.0x gain)
  onChange: (newVolume: number) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  disabled?: boolean;
}

export const MicVolumeSlider: React.FC<MicVolumeSliderProps> = ({
  stream,
  volume,
  onChange,
  onSpeakingChange,
  disabled = false,
}) => {
  const [levelRatio, setLevelRatio] = useState<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Keep refs for callbacks & props so useEffect never tears down on reference changes
  const onSpeakingChangeRef = useRef(onSpeakingChange);
  onSpeakingChangeRef.current = onSpeakingChange;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const gainNodeRef = useRef<GainNode | null>(null);

  // Dynamically update gain without restarting AudioContext
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(volume / 100, 0, 0.03);
    }
  }, [volume]);

  // Audio Context and Analyser setup - ONLY re-runs if stream or disabled changes
  useEffect(() => {
    if (!stream || disabled) {
      setLevelRatio(0);
      if (onSpeakingChangeRef.current) onSpeakingChangeRef.current(false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled) {
      setLevelRatio(0);
      if (onSpeakingChangeRef.current) onSpeakingChangeRef.current(false);
      return;
    }

    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let gainNode: GainNode | null = null;
    let analyser: AnalyserNode | null = null;

    try {
      const AudioCtxClass =
        window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioCtxClass();
      source = audioCtx.createMediaStreamSource(stream);

      gainNode = audioCtx.createGain();
      gainNode.gain.value = volumeRef.current / 100;
      gainNodeRef.current = gainNode;

      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      source.connect(gainNode);
      gainNode.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!analyser || !audioCtx) return;

        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength) / 255;

        let db = -60;
        if (rms > 0.0001) {
          db = Math.max(-60, Math.min(0, 20 * Math.log10(rms)));
        }

        const normRatio = Math.max(0, Math.min(1, (db + 60) / 60));
        setLevelRatio(normRatio);

        if (onSpeakingChangeRef.current) {
          onSpeakingChangeRef.current(db > -38);
        }

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn("Error setting up MicVolumeSlider audio context:", err);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (source) {
        try {
          source.disconnect();
        } catch (e) {}
      }
      if (gainNode) {
        try {
          gainNode.disconnect();
        } catch (e) {}
      }
      if (audioCtx && audioCtx.state !== "closed") {
        try {
          audioCtx.close();
        } catch (e) {}
      }
      gainNodeRef.current = null;
    };
  }, [stream, disabled]);

  return (
    <div
      className={`flex flex-col gap-1.5 text-left ${disabled ? "opacity-40 pointer-events-none" : ""}`}
    >
      {/* Title */}
      <span className="text-xs font-medium text-fg-muted">
        Volume
      </span>

      <Slider
        min={0}
        max={200}
        step={1}
        value={volume}
        onChange={onChange}
        disabled={disabled}
        title={`Volume: ${volume}%`}
        aria-label="Volume do microfone"
      />

      {/* Percentage display below slider */}
      <div className="flex justify-between items-center text-meta font-mono text-fg-muted">
        <span>0%</span>
        <span
          className={`font-semibold ${volume === 0 ? "text-fg-muted" : volume > 100 ? "text-fg-muted" : "text-fg-default"}`}
        >
          {volume === 0 ? "0% (Muto)" : `${volume}%`}
        </span>
        <span>200%</span>
      </div>
    </div>
  );
};
