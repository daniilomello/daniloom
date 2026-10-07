import { useState, RefObject } from "react";
import { Clip, ExportConfig, SubtitleItem } from "../types";
import { replaceVideoAudio, bufferToWav } from "../utils/audioReplacer";
import { mergeVideoClips } from "../utils/videoMerger";
import { clearClipsDB } from "../utils/projectDB";
import { playActionCompleteSound } from "../utils/soundEffects";

interface UseVideoManipulationProps {
  clips: Clip[];
  setClips: React.Dispatch<React.SetStateAction<Clip[]>>;
  currentClips: Clip[];
  selectedClip: Clip | null;
  setSelectedClip: React.Dispatch<React.SetStateAction<Clip | null>>;
  getCurrentVideoUrl: () => string | null;
  mergedVideoUrl: string | null;
  setMergedVideo: React.Dispatch<React.SetStateAction<Blob | null>>;
  setMergedVideoUrl: React.Dispatch<React.SetStateAction<string | null>>;
  recordingFormat: "landscape" | "portrait";
  exportConfig: ExportConfig;
  enhanceAudio: boolean;
  exportWithSubtitles: boolean;
  subtitles: SubtitleItem[];
  subtitleConfig: any;
  mainVideoPlayerRef: RefObject<HTMLVideoElement>;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
  askAlert: (msg: string) => Promise<void>;
}

export function useVideoManipulation({
  clips,
  setClips,
  currentClips,
  selectedClip,
  setSelectedClip,
  getCurrentVideoUrl,
  mergedVideoUrl,
  setMergedVideo,
  setMergedVideoUrl,
  recordingFormat,
  exportConfig,
  enhanceAudio,
  exportWithSubtitles,
  subtitles,
  subtitleConfig,
  mainVideoPlayerRef,
  showToast,
  askAlert,
}: UseVideoManipulationProps) {
  const [isReplacingAudio, setIsReplacingAudio] = useState(false);
  const [replaceAudioProgress, setReplaceAudioProgress] = useState(0);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [isMergingToTimeline, setIsMergingToTimeline] = useState(false);
  const [mergeTimelineProgress, setMergeTimelineProgress] = useState(0);

  const handleAudioUpload = async (file: File) => {
    if (file.type !== "audio/wav" && !file.name.endsWith(".wav")) {
      await askAlert(
        "Por favor, selecione um arquivo de áudio no formato .wav.",
      );
      return;
    }

    const url = getCurrentVideoUrl();
    if (!url) {
      await askAlert("Nenhum vídeo disponível para substituir o áudio.");
      return;
    }

    // Determine duration
    let duration = 0;
    if (selectedClip?.duration) {
      duration = selectedClip.duration;
    } else if (mergedVideoUrl) {
      duration = currentClips.reduce((acc, c) => acc + c.duration, 0);
    } else if (currentClips.length > 0) {
      duration = currentClips[0].duration;
    }

    if (duration <= 0) {
      await askAlert("Não foi possível determinar a duração do vídeo.");
      return;
    }

    setIsReplacingAudio(true);
    setReplaceAudioProgress(0);

    const audioUrl = URL.createObjectURL(file);

    try {
      const newVideoBlob = await replaceVideoAudio(
        url,
        audioUrl,
        duration,
        (progress) => {
          setReplaceAudioProgress(progress);
        },
      );

      const newVideoUrl = URL.createObjectURL(newVideoBlob);

      // 1. If we have a single clip, replace it in the clips list
      if (currentClips.length === 1) {
        const targetId = currentClips[0].id;
        setClips((prev) =>
          prev.map((c) => {
            if (c.id === targetId) {
              if (c.url.startsWith("blob:")) {
                URL.revokeObjectURL(c.url);
              }
              return {
                ...c,
                url: newVideoUrl,
                blob: newVideoBlob,
              };
            }
            return c;
          }),
        );
      }

      // 2. If mergedVideoUrl exists, update it too
      if (mergedVideoUrl) {
        if (mergedVideoUrl.startsWith("blob:")) {
          URL.revokeObjectURL(mergedVideoUrl);
        }
        setMergedVideo(newVideoBlob);
        setMergedVideoUrl(newVideoUrl);
      }

      // 3. Update selectedClip if it matches the single clip or merged clip
      if (selectedClip) {
        if (selectedClip.id === "merged") {
          setSelectedClip({
            ...selectedClip,
            url: newVideoUrl,
            blob: newVideoBlob,
          });
        } else if (
          currentClips.length === 1 &&
          selectedClip.id === currentClips[0].id
        ) {
          setSelectedClip({
            ...selectedClip,
            url: newVideoUrl,
            blob: newVideoBlob,
          });
        }
      }

      showToast("Áudio do vídeo substituído com sucesso!", "success");
    } catch (err: any) {
      console.error("Erro ao substituir áudio do vídeo:", err);
      await askAlert("Erro ao substituir o áudio do vídeo: " + err.message);
    } finally {
      setIsReplacingAudio(false);
      URL.revokeObjectURL(audioUrl);
    }
  };

  const handleReorderClips = (startIndex: number, endIndex: number) => {
    const updatedCurrent = [...currentClips];
    const [removed] = updatedCurrent.splice(startIndex, 1);
    updatedCurrent.splice(endIndex, 0, removed);

    // Merge back into global clips
    const otherClips = clips.filter(
      (c) => (c.format || "landscape") !== recordingFormat,
    );
    setClips([...otherClips, ...updatedCurrent]);
  };

  const handleRenameClip = (clipId: string, newName: string) => {
    setClips((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, name: newName } : c)),
    );
    if (selectedClip?.id === clipId) {
      setSelectedClip((prev: any) =>
        prev ? { ...prev, name: newName } : null,
      );
    }
  };

  const handleRemoveClip = (clipId: string) => {
    setClips((prev) => prev.filter((c) => c.id !== clipId));
    if (selectedClip?.id === clipId) {
      setSelectedClip(null);
    }
  };

  const handleClearClips = async () => {
    setClips([]);
    setSelectedClip(null);
    if (mergedVideoUrl && mergedVideoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(mergedVideoUrl);
    }
    setMergedVideo(null);
    setMergedVideoUrl(null);
    try {
      await clearClipsDB();
    } catch (err) {
      console.error("Error clearing clips DB:", err);
    }
    showToast("Todos os clipes e prévia foram removidos.", "info");
  };

  const handleMergeClips = async () => {
    if (currentClips.length === 0) return;
    try {
      if (mainVideoPlayerRef.current) {
        mainVideoPlayerRef.current.pause();
      }
    } catch (e) {}

    setIsMerging(true);
    setMergeProgress(0);
    try {
      const mergedBlob = await mergeVideoClips(
        currentClips,
        {
          format: exportConfig.format,
          quality: exportConfig.quality,
          aspectRatio:
            recordingFormat || currentClips[0]?.format || "landscape",
          enhanceAudio,
          subtitles: exportWithSubtitles ? subtitles : [],
          subtitleConfig,
        },
        (progress) => {
          setMergeProgress(progress);
        },
      );

      setMergedVideo(mergedBlob);
      const url = URL.createObjectURL(mergedBlob);
      setMergedVideoUrl(url);

      // Update preview to show the merged clip
      setSelectedClip({
        id: "merged",
        name: "Vídeo Mesclado Final",
        url,
        blob: mergedBlob,
        duration: currentClips.reduce((acc, c) => acc + c.duration, 0),
        createdAt: new Date(),
        format: recordingFormat,
      });

      showToast("Vídeos mesclados com sucesso! Verifique a prévia.", "success");
    } catch (err: any) {
      console.error(err);
      await askAlert("Falha ao mesclar os vídeos: " + err.message);
    } finally {
      setIsMerging(false);
      setMergeProgress(0);
    }
  };

  const handleMergeClipsToTimeline = async () => {
    if (currentClips.length <= 1) {
      if (currentClips.length === 0) {
        showToast("Nenhum clipe na timeline para mesclar.", "info");
      } else {
        showToast("Adicione 2 ou mais clipes na timeline para poder mesclar.", "info");
      }
      return;
    }

    try {
      if (mainVideoPlayerRef.current) {
        mainVideoPlayerRef.current.pause();
      }
    } catch (e) {}

    setIsMergingToTimeline(true);
    setMergeTimelineProgress(0);

    try {
      const mergedBlob = await mergeVideoClips(
        currentClips,
        {
          format: exportConfig.format === "gif" ? "mp4" : exportConfig.format,
          quality: exportConfig.quality,
          aspectRatio:
            recordingFormat || currentClips[0]?.format || "landscape",
          enhanceAudio,
          subtitles: exportWithSubtitles ? subtitles : [],
          subtitleConfig,
        },
        (progress) => {
          setMergeTimelineProgress(progress);
        },
      );

      const url = URL.createObjectURL(mergedBlob);
      const totalDuration = currentClips.reduce((acc, c) => acc + c.duration, 0);

      // Generate thumbnail from first frame of merged blob
      let thumbnailUrl = currentClips[0]?.thumbnailUrl;
      try {
        const testVideo = document.createElement("video");
        testVideo.src = url;
        testVideo.currentTime = 0.1;
        testVideo.muted = true;
        await new Promise((res) => {
          testVideo.onseeked = () => res(true);
          testVideo.onerror = () => res(false);
          setTimeout(() => res(false), 1500);
        });
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext("2d");
        if (ctx && testVideo.videoWidth > 0) {
          ctx.drawImage(testVideo, 0, 0, 320, 180);
          thumbnailUrl = canvas.toDataURL("image/jpeg", 0.7);
        }
        testVideo.remove();
      } catch (e) {
        // Fallback to first clip thumbnail
      }

      const mergedClipId = `clip_merged_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newMergedClip: Clip = {
        id: mergedClipId,
        name: `Clipe Mesclado (${currentClips.length} partes)`,
        url,
        blob: mergedBlob,
        duration: totalDuration,
        createdAt: new Date(),
        format: recordingFormat,
        thumbnailUrl,
      };

      // Add as the FIRST item of the video in the timeline!
      setClips((prev) => {
        const otherFormatClips = prev.filter(
          (c) => (c.format || "landscape") !== recordingFormat,
        );
        const sameFormatClips = prev.filter(
          (c) => (c.format || "landscape") === recordingFormat,
        );
        return [...otherFormatClips, newMergedClip, ...sameFormatClips];
      });

      setSelectedClip(newMergedClip);
      playActionCompleteSound();
      showToast(
        "Clipes mesclados com sucesso e adicionados como o 1º item da timeline!",
        "success",
      );
    } catch (err: any) {
      console.error("Falha ao mesclar clipes na timeline:", err);
      await askAlert("Falha ao mesclar clipes na timeline: " + (err.message || err));
    } finally {
      setIsMergingToTimeline(false);
      setMergeTimelineProgress(0);
    }
  };

  const takeScreenshot = () => {
    if (!selectedClip || !mainVideoPlayerRef.current) return;
    const video = mainVideoPlayerRef.current;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;

      // Calculate formatted time
      const minutes = Math.floor(video.currentTime / 60)
        .toString()
        .padStart(2, "0");
      const seconds = Math.floor(video.currentTime % 60)
        .toString()
        .padStart(2, "0");

      a.download = `screenshot_${selectedClip.name}_${minutes}-${seconds}.png`;
      a.click();

      showToast("Frame capturado com sucesso!", "success");
    } catch (e) {
      console.error("Screenshot failed", e);
      showToast("Falha ao tirar screenshot do vídeo.", "error");
    }
  };

  return {
    isReplacingAudio,
    replaceAudioProgress,
    isMerging,
    mergeProgress,
    isMergingToTimeline,
    mergeTimelineProgress,
    handleAudioUpload,
    handleReorderClips,
    handleRenameClip,
    handleRemoveClip,
    handleClearClips,
    handleMergeClips,
    handleMergeClipsToTimeline,
    takeScreenshot,
    setIsMerging,
    setMergeProgress,
  };
}
