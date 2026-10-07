import React, { useState, useRef, useEffect } from "react";
import {
  Scissors,
  Split,
  Check,
  Trash2,
  Loader2,
  X,
  RotateCcw,
} from "lucide-react";
import { Clip } from "../types";
import { mergeVideoClips } from "../utils/videoMerger";

interface Segment {
  id: string;
  start: number;
  end: number;
  deleted: boolean;
}

interface TrimSectionProps {
  clip: Clip | null;
  onFinish: (newBlob: Blob, newDuration: number, newUrl: string) => void;
  onClose: () => void;
  currentTime: number;
}

export function TrimSection({
  clip,
  onFinish,
  onClose,
  currentTime,
}: TrimSectionProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [splitMode, setSplitMode] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [dragState, setDragState] = useState<{
    index: number;
    edge: "left" | "right";
  } | null>(null);

  const duration = clip?.duration || 1;

  useEffect(() => {
    if (previewVideoRef.current && clip) {
      if (dragState !== null) {
        const seg = segments[dragState.index];
        const time = dragState.edge === "left" ? seg.start : seg.end;
        previewVideoRef.current.currentTime = time;
      } else if (hoverTime !== null) {
        previewVideoRef.current.currentTime = hoverTime;
      } else {
        previewVideoRef.current.currentTime = currentTime;
      }
    }
  }, [dragState, hoverTime, segments, clip, currentTime]);

  useEffect(() => {
    if (clip) {
      setSegments([
        {
          id: Math.random().toString(),
          start: 0,
          end: clip.duration,
          deleted: false,
        },
      ]);
      setSplitMode(false);
    } else {
      setSegments([]);
    }
  }, [clip]);

  // Generate Thumbnails
  useEffect(() => {
    if (!clip || !clip.url) return;

    let isCancelled = false;
    const generate = async () => {
      const video = document.createElement("video");
      video.src = clip.url;
      video.muted = true;
      video.crossOrigin = "anonymous";

      await new Promise((resolve) => {
        video.onloadeddata = resolve;
        video.onerror = resolve;
      });

      if (isCancelled || !video.videoWidth) return;

      const vidDuration = clip.duration || video.duration || 1;
      const count = 10;
      const thumbs: string[] = [];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = 160;
      canvas.height = (160 / video.videoWidth) * video.videoHeight;

      for (let i = 0; i < count; i++) {
        if (isCancelled) return;
        video.currentTime = (vidDuration / count) * i;
        await new Promise((r) => {
          video.onseeked = r;
          setTimeout(r, 500); // timeout fallback
        });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbs.push(canvas.toDataURL("image/jpeg", 0.5));
      }
      if (!isCancelled) {
        setThumbnails(thumbs);
      }
    };
    generate();

    return () => {
      isCancelled = true;
    };
  }, [clip]);

  // Handle Dragging Globally
  useEffect(() => {
    const handleGlobalMove = (e: PointerEvent) => {
      if (!dragState || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const time = (x / rect.width) * duration;

      setSegments((prev) => {
        const newSegments = [...prev];
        const seg = { ...newSegments[dragState.index] };

        if (dragState.edge === "left") {
          const minTime =
            dragState.index > 0 ? newSegments[dragState.index - 1].end : 0;
          const maxTime = seg.end - 0.1;
          seg.start = Math.max(minTime, Math.min(time, maxTime));
        } else {
          const maxTime =
            dragState.index < newSegments.length - 1
              ? newSegments[dragState.index + 1].start
              : duration;
          const minTime = seg.start + 0.1;
          seg.end = Math.max(minTime, Math.min(time, maxTime));
        }
        newSegments[dragState.index] = seg;
        return newSegments;
      });
    };

    const handleGlobalUp = () => {
      setDragState(null);
    };

    if (dragState) {
      window.addEventListener("pointermove", handleGlobalMove);
      window.addEventListener("pointerup", handleGlobalUp);
    }

    return () => {
      window.removeEventListener("pointermove", handleGlobalMove);
      window.removeEventListener("pointerup", handleGlobalUp);
    };
  }, [dragState, duration]);

  if (!clip) {
    return (
      <div className="bg-surface/40 border border-line/60 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[120px] backdrop-blur-md">
        <p className="text-fg-muted font-medium">Selecione um clip</p>
      </div>
    );
  }

  const handleTrackClick = () => {
    if (!splitMode || hoverTime === null) return;

    const segIndex = segments.findIndex(
      (s) => hoverTime >= s.start && hoverTime < s.end,
    );
    if (segIndex === -1) return;

    const seg = segments[segIndex];
    const seg1: Segment = { ...seg, end: hoverTime };
    const seg2: Segment = {
      id: Math.random().toString(),
      start: hoverTime,
      end: seg.end,
      deleted: seg.deleted,
    };

    const newSegments = [...segments];
    newSegments.splice(segIndex, 1, seg1, seg2);
    setSegments(newSegments);
    setSplitMode(false);
    setHoverTime(null);
  };

  const toggleSegmentDeleted = (index: number) => {
    if (splitMode) return;
    const newSegments = [...segments];
    newSegments[index].deleted = !newSegments[index].deleted;
    setSegments(newSegments);
  };

  const handleFinish = async () => {
    const kept = segments
      .filter((s) => !s.deleted)
      .sort((a, b) => a.start - b.start);
    if (kept.length === 0) {
      alert("Você não pode deletar todas as partes do clipe.");
      return;
    }

    // Check if anything was actually trimmed
    const isFullyIntact =
      kept.length === 1 && kept[0].start === 0 && kept[0].end === duration;
    if (isFullyIntact) {
      onClose();
      return;
    }

    setIsProcessing(true);

    const cuts: { start: number; end: number }[] = [];
    let currentPos = 0;

    for (const seg of kept) {
      if (seg.start > currentPos) {
        cuts.push({ start: currentPos, end: seg.start });
      }
      currentPos = seg.end;
    }
    if (currentPos < duration) {
      cuts.push({ start: currentPos, end: duration });
    }

    try {
      const mergedBlob = await mergeVideoClips(
        [clip],
        {
          format: "webm",
          aspectRatio: clip.format || "landscape",
          quality: "high",
          cuts,
        },
        (progress) => {},
      );

      const newDuration = kept.reduce((acc, s) => acc + (s.end - s.start), 0);
      const newUrl = URL.createObjectURL(mergedBlob);

      onFinish(mergedBlob, newDuration, newUrl);
    } catch (err) {
      console.error(err);
      alert("Erro ao processar trim.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-surface/40 border border-line/60 rounded-2xl p-4 flex flex-col gap-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-fg-muted" />
            <h3 className="text-fg-default font-semibold text-sm">
              Trim / Cortar
            </h3>
          </div>

          <div className="h-10 w-16 bg-black rounded border border-line-strong overflow-hidden shadow-lg shadow-black/50">
            <video
              ref={previewVideoRef}
              src={clip.url}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSegments([
                {
                  id: Math.random().toString(),
                  start: 0,
                  end: duration,
                  deleted: false,
                },
              ]);
            }}
            className="p-2 rounded-lg transition-all border bg-app border-line text-fg-muted hover:text-fg"
            title="Desfazer Trim"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSplitMode(!splitMode)}
            className={`p-2 rounded-lg transition-all border ${splitMode ? "ds-active border-transparent" : "bg-app border-line text-fg-muted hover:text-fg"}`}
            title="Dividir Clipe"
          >
            <Split className="w-4 h-4" />
          </button>

          <button
            onClick={handleFinish}
            disabled={isProcessing}
            className="p-2 rounded-lg transition-all border bg-inverse border-line-strong hover:bg-inverse-hover text-on-inverse disabled:opacity-50"
            title="Finalizar Trim"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-all border bg-app border-line text-fg-muted hover:text-fg-muted"
            title="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className="relative w-full h-16 bg-app rounded-xl overflow-hidden border border-line/80 cursor-pointer select-none"
        ref={trackRef}
        onPointerMove={(e) => {
          if (splitMode && trackRef.current) {
            const rect = trackRef.current.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            setHoverTime((x / rect.width) * duration);
          }
        }}
        onPointerLeave={() => {
          if (splitMode) setHoverTime(null);
        }}
        onPointerUp={handleTrackClick}
      >
        {/* Thumbnails Background */}
        <div className="absolute inset-0 flex items-center justify-between pointer-events-none opacity-80">
          {thumbnails.map((thumb, i) => (
            <img
              key={i}
              src={thumb}
              className="h-full object-cover flex-1 min-w-0"
              alt=""
            />
          ))}
        </div>

        {/* Render Gaps (removed laterals) explicitly with red overlay */}
        {(() => {
          const sortedSegs = [...segments].sort((a, b) => a.start - b.start);
          const gaps = [];
          let currentPos = 0;
          for (const seg of sortedSegs) {
            if (seg.start > currentPos) {
              gaps.push({ start: currentPos, end: seg.start });
            }
            currentPos = seg.end;
          }
          if (currentPos < duration) {
            gaps.push({ start: currentPos, end: duration });
          }

          return gaps.map((gap, i) => {
            const leftPercent = (gap.start / duration) * 100;
            const widthPercent = ((gap.end - gap.start) / duration) * 100;
            return (
              <div
                key={`gap-${i}`}
                className="absolute top-0 bottom-0 bg-muted pointer-events-none z-0 backdrop-blur-[1px]"
                style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
              />
            );
          });
        })()}

        {segments.map((seg, i) => {
          const leftPercent = (seg.start / duration) * 100;
          const widthPercent = ((seg.end - seg.start) / duration) * 100;
          return (
            <div
              key={seg.id}
              onClick={(e) => {
                e.stopPropagation();
                toggleSegmentDeleted(i);
              }}
              className={`absolute top-0 bottom-0 border-r border-line/50 group transition-colors duration-200 flex items-center justify-center ${seg.deleted ? "bg-muted backdrop-blur-[1px]" : "bg-transparent border-y-2 border-line hover:bg-white/5"} z-10`}
              style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
            >
              {seg.deleted && (
                <Trash2 className="w-4 h-4 text-fg-muted opacity-50 pointer-events-none" />
              )}

              {/* Drag Handles for active segments */}
              {!seg.deleted && (
                <>
                  <div
                    className="absolute left-0 top-0 bottom-0 w-3 bg-inverse cursor-ew-resize hover:bg-inverse-hover flex items-center justify-center -translate-x-1/2 z-20"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDragState({ index: i, edge: "left" });
                    }}
                  >
                    <div className="w-0.5 h-4 bg-white/50 rounded-full pointer-events-none" />
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-3 bg-inverse cursor-ew-resize hover:bg-inverse-hover flex items-center justify-center translate-x-1/2 z-20"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDragState({ index: i, edge: "right" });
                    }}
                  >
                    <div className="w-0.5 h-4 bg-white/50 rounded-full pointer-events-none" />
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Playhead indicator based on video current time */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-30"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />

        {/* Hover cut indicator */}
        {splitMode && hoverTime !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-inverse pointer-events-none z-40 flex flex-col items-center"
            style={{ left: `${(hoverTime / duration) * 100}%` }}
          >
            <div className="absolute -top-3 w-6 h-6 bg-inverse rounded-full flex items-center justify-center shadow-lg transform -translate-x-1/2">
              <Scissors className="w-3 h-3 text-fg" />
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-fg-muted text-center">
        {splitMode
          ? "Clique no trecho para dividir o vídeo."
          : "Arraste as bordas para cortar. Clique no meio de um trecho para marcá-lo como removido."}
      </p>
    </div>
  );
}
