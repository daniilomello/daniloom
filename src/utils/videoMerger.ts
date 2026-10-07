import { Clip, SubtitleItem, SubtitleConfig, CropRegion } from "../types";
import { convertVideoToGif } from "./gifEncoder";
import { saveBlobToOPFS } from "./opfsStorage";

export interface WatermarkConfig {
  enabled: boolean;
  image: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  opacity: number;
  scale: number;
}

export interface MergeConfig {
  format: "mov" | "mp4" | "webm" | "gif";
  quality: "low" | "medium" | "high" | "very_high" | "ultra_4k";
  aspectRatio?: "landscape" | "portrait";
  subtitles?: SubtitleItem[];
  subtitleConfig?: SubtitleConfig;
  enhanceAudio?: boolean;
  watermark?: WatermarkConfig;
  cuts?: { start: number; end: number }[];
  cropRegion?: CropRegion;
  studioLightEnabled?: boolean;
  studioLightIntensity?: number;
  cameraBgBlur?: boolean;
}

export const getSupportedMimeType = (
  format: "mov" | "mp4" | "webm" | "gif",
): string => {
  if (format === "mov") {
    if (MediaRecorder.isTypeSupported("video/quicktime;codecs=h264"))
      return "video/quicktime;codecs=h264";
    if (MediaRecorder.isTypeSupported("video/quicktime"))
      return "video/quicktime";
    if (MediaRecorder.isTypeSupported("video/mp4;codecs=h264"))
      return "video/mp4;codecs=h264";
    if (MediaRecorder.isTypeSupported("video/mp4")) return "video/mp4";
    return "video/webm;codecs=vp8,opus"; // Fallback
  } else if (format === "mp4") {
    if (MediaRecorder.isTypeSupported("video/mp4;codecs=h264"))
      return "video/mp4;codecs=h264";
    if (MediaRecorder.isTypeSupported("video/mp4")) return "video/mp4";
    if (MediaRecorder.isTypeSupported("video/quicktime"))
      return "video/quicktime";
    return "video/webm;codecs=vp8,opus"; // Fallback
  } else {
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus"))
      return "video/webm;codecs=vp9,opus";
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus"))
      return "video/webm;codecs=vp8,opus";
    if (MediaRecorder.isTypeSupported("video/webm")) return "video/webm";
    return "video/webm";
  }
};

export const mergeVideoClips = (
  clips: Clip[],
  config: MergeConfig,
  onProgress: (progress: number) => void,
): Promise<Blob> => {
  return new Promise(async (resolve, reject) => {
    try {
      if (clips.length === 0) {
        throw new Error("Nenhum clipe para mesclar.");
      }

      // 1. Calculate total duration
      const totalDuration = clips.reduce((acc, clip) => acc + clip.duration, 0);
      let elapsedDuration = 0;

      // Determine if format is portrait (vertical) or landscape (horizontal)
      const isPortrait =
        config.aspectRatio === "portrait" || clips[0]?.format === "portrait";

      // Determine dimensions and bitrates based on quality
      let width =
        config.quality === "low"
          ? 854
          : config.quality === "medium"
            ? 1280
            : config.quality === "ultra_4k"
              ? 3840
              : 1920;
      let height =
        config.quality === "low"
          ? 480
          : config.quality === "medium"
            ? 720
            : config.quality === "ultra_4k"
              ? 2160
              : 1080;

      if (isPortrait) {
        const tmp = width;
        width = height;
        height = tmp;
      }

      const videoBitsPerSecond =
        config.quality === "low"
          ? 1500000
          : config.quality === "medium"
            ? 4500000
            : config.quality === "high"
              ? 12000000
              : config.quality === "very_high"
                ? 20000000
                : config.quality === "ultra_4k"
                  ? 45000000
                  : 15000000;

      // 2. Setup canvas element
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Não foi possível criar o contexto 2D do Canvas.");
      }

      // Fill canvas with dark background initially
      ctx.fillStyle = "#0c0d0f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Preload watermark image if configured
      let watermarkImg: HTMLImageElement | null = null;
      if (config.watermark?.enabled && config.watermark.image) {
        watermarkImg = new Image();
        watermarkImg.src = config.watermark.image;
        await new Promise((res) => {
          watermarkImg!.onload = () => res(true);
          watermarkImg!.onerror = () => res(false);
        });
      }

      // 3. Setup Web Audio API to capture audio without interruptions
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const dest = audioCtx.createMediaStreamDestination();

      let currentVideo: HTMLVideoElement | null = null;

      // 4. Setup Canvas capture stream and combine with audio stream
      const canvasStream = canvas.captureStream(30); // 30 FPS
      const tracks = [
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ];
      const combinedStream = new MediaStream(tracks);

      // 5. Setup MediaRecorder for export
      const mimeType = getSupportedMimeType(config.format);

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond,
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const finalBlob = new Blob(chunks, {
          type: chunks[0]?.type || mimeType,
        });
        // Cleanup AudioContext and media
        audioCtx.close();
        if (currentVideo) currentVideo.remove();
        drawWorker.terminate();

        if (config.format === "gif") {
          try {
            const videoUrl = URL.createObjectURL(finalBlob);
            const gifBlob = await convertVideoToGif(videoUrl, {
              width: 480,
              fps: 10,
              maxDuration: 15,
              onProgress: (p) => onProgress(0.9 + (p * 0.1) / 100),
            });
            URL.revokeObjectURL(videoUrl);
            resolve(gifBlob);
          } catch (err) {
            console.warn(
              "Error encoding GIF, falling back to WebM/video:",
              err,
            );
            resolve(finalBlob);
          }
        } else {
          resolve(finalBlob);
        }
      };

      recorder.start();

      // 6. Draw loop
      let isPlaying = false;
      let lastProgressTime = 0;

      // Safe handshaking/throttling loop to avoid flooding the main thread
      const workerCode = `
        let timer;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            self.postMessage('tick');
          } else if (e.data === 'next') {
            timer = setTimeout(() => {
              self.postMessage('tick');
            }, 1000 / 30);
          } else if (e.data === 'stop') {
            clearTimeout(timer);
          }
        };
      `;
      const workerBlob = new Blob([workerCode], {
        type: "application/javascript",
      });
      const drawWorker = new Worker(URL.createObjectURL(workerBlob));

      drawWorker.onmessage = () => {
        if (!isPlaying || !currentVideo) {
          drawWorker.postMessage("next");
          return;
        }
        try {
          if (config.cuts && config.cuts.length > 0) {
            const absoluteTime =
              elapsedDuration + (currentVideo.currentTime || 0);
            const activeCut = config.cuts.find(
              (cut) => absoluteTime >= cut.start && absoluteTime < cut.end,
            );
            if (activeCut) {
              const relativeSeekTime = activeCut.end - elapsedDuration;
              currentVideo.currentTime = relativeSeekTime;
              drawWorker.postMessage("next");
              return;
            }
          }

          // Fill background to prevent ghosting or letterboxing artifacts
          ctx.fillStyle = "#0c0d0f";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const vw = currentVideo.videoWidth;
          const vh = currentVideo.videoHeight;
          if (vw > 0 && vh > 0) {
            if (config.cropRegion && config.cropRegion.enabled) {
              const sx = (config.cropRegion.x / 100) * vw;
              const sy = (config.cropRegion.y / 100) * vh;
              const sw = (config.cropRegion.width / 100) * vw;
              const sh = (config.cropRegion.height / 100) * vh;
              ctx.drawImage(
                currentVideo,
                sx,
                sy,
                sw,
                sh,
                0,
                0,
                canvas.width,
                canvas.height,
              );
            } else {
              const scale = Math.max(canvas.width / vw, canvas.height / vh);
              const w = vw * scale;
              const h = vh * scale;
              const dx = (canvas.width - w) / 2;
              const dy = (canvas.height - h) / 2;
              ctx.drawImage(currentVideo, dx, dy, w, h);
            }

            // Apply Studio Light Warm Spotlight Overlay if enabled
            if (config.studioLightEnabled) {
              ctx.save();
              const intensity = (config.studioLightIntensity || 50) / 100;
              const grad = ctx.createRadialGradient(
                canvas.width / 2,
                canvas.height * 0.4,
                0,
                canvas.width / 2,
                canvas.height * 0.4,
                canvas.width * 0.6,
              );
              grad.addColorStop(0, `rgba(255, 248, 230, ${0.25 * intensity})`);
              grad.addColorStop(
                0.5,
                `rgba(255, 215, 180, ${0.12 * intensity})`,
              );
              grad.addColorStop(1, `rgba(0, 0, 0, ${0.3 * intensity})`);
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.restore();
            }
          }

          // Render subtitles if any are active
          if (config.subtitles && config.subtitles.length > 0) {
            const currentTime =
              elapsedDuration + (currentVideo.currentTime || 0);
            const activeSub = config.subtitles.find(
              (sub) => currentTime >= sub.start && currentTime <= sub.end,
            );
            if (activeSub) {
              ctx.save();
              const scaleMulti = config.subtitleConfig?.fontSizeScale || 1;
              const fontSize =
                Math.max(16, Math.min(64, Math.round(canvas.width / 40))) *
                scaleMulti;
              ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "bottom";
              const text = activeSub.text;

              // Simple word wrap
              const words = text.split(" ");
              let lines = [];
              let currentLine = words[0];
              for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;
                if (width < canvas.width * 0.8) {
                  currentLine += " " + word;
                } else {
                  lines.push(currentLine);
                  currentLine = word;
                }
              }
              lines.push(currentLine);

              const paddingX = 16;
              const paddingY = 8;
              const lineHeight = fontSize * 1.2;
              const totalTextHeight = lines.length * lineHeight;

              const x = canvas.width / 2;

              let y = canvas.height - Math.round(canvas.height / 15);
              if (config.subtitleConfig?.position === "top") {
                y = Math.round(canvas.height / 15) + totalTextHeight;
              } else if (config.subtitleConfig?.position === "center") {
                y = canvas.height / 2 + totalTextHeight / 2;
              }

              // Draw backgrounds and text
              const bg =
                config.subtitleConfig?.backgroundColor || "rgba(0, 0, 0, 0.75)";
              const fg = config.subtitleConfig?.color || "#ffffff";

              lines.forEach((line, i) => {
                const lineY = y - totalTextHeight + i * lineHeight + lineHeight;
                const textWidth = ctx.measureText(line).width;
                const bubbleWidth = textWidth + paddingX * 2;
                const bubbleHeight = fontSize + paddingY * 2;

                ctx.fillStyle = bg;
                ctx.beginPath();
                if (typeof ctx.roundRect === "function") {
                  ctx.roundRect(
                    x - bubbleWidth / 2,
                    lineY - bubbleHeight + paddingY,
                    bubbleWidth,
                    bubbleHeight,
                    8,
                  );
                } else {
                  ctx.rect(
                    x - bubbleWidth / 2,
                    lineY - bubbleHeight + paddingY,
                    bubbleWidth,
                    bubbleHeight,
                  );
                }
                ctx.fill();

                ctx.fillStyle = fg;
                ctx.fillText(line, x, lineY);
              });

              ctx.restore();
            }
          }

          // Render watermark if present
          if (watermarkImg && config.watermark) {
            ctx.save();
            ctx.globalAlpha = config.watermark.opacity;
            const wmScale = config.watermark.scale || 0.15;
            const wmW = canvas.width * wmScale;
            const wmH = (watermarkImg.height / (watermarkImg.width || 1)) * wmW;
            let wmX = 20;
            let wmY = 20;
            if (config.watermark.position.endsWith("right")) {
              wmX = canvas.width - wmW - 20;
            }
            if (config.watermark.position.startsWith("bottom")) {
              wmY = canvas.height - wmH - 20;
            }
            ctx.drawImage(watermarkImg, wmX, wmY, wmW, wmH);
            ctx.restore();
          }

          // Calculate progress
          const currentClipTime = currentVideo.currentTime || 0;
          const currentTotalProgress =
            (elapsedDuration + currentClipTime) / totalDuration;

          const now = Date.now();
          if (now - lastProgressTime > 200) {
            // Throttle UI updates to ~5 times a second
            onProgress(Math.min(currentTotalProgress, 0.99));
            lastProgressTime = now;
          }
        } catch (err) {
          console.warn("Merger draw frame error:", err);
        } finally {
          // Signal worker we are ready to receive the next tick
          drawWorker.postMessage("next");
        }
      };

      const startDrawing = () => {
        drawWorker.postMessage("start");
      };

      const stopDrawing = () => {
        drawWorker.postMessage("stop");
      };

      // 7. Sequentially play each clip and draw it
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];

        await new Promise<void>(async (resolveClip, rejectClip) => {
          let bufferSource: AudioBufferSourceNode | null = null;
          let elementSource: MediaElementAudioSourceNode | null = null;
          let audioBuffer: AudioBuffer | null = null;

          // Attempt to extract raw AudioBuffer for completely silent & pristine audio routing
          try {
            let arrayBuffer: ArrayBuffer | null = null;
            if (clip.blob) {
              arrayBuffer = await clip.blob.arrayBuffer();
            } else if (clip.url) {
              const res = await fetch(clip.url);
              arrayBuffer = await res.arrayBuffer();
            }
            if (arrayBuffer && arrayBuffer.byteLength > 0) {
              audioBuffer = await audioCtx.decodeAudioData(
                arrayBuffer.slice(0),
              );
            }
          } catch (decodeErr) {
            console.warn(
              "Direct AudioBuffer decode skipped/failed, fallback to MediaElementSource:",
              clip.name,
              decodeErr,
            );
          }

          const video = document.createElement("video");
          video.muted = true; // Always muted to ensure 100% silent export to speakers!
          video.playsInline = true;
          video.crossOrigin = "anonymous";
          video.style.position = "fixed";
          video.style.width = "10px";
          video.style.height = "10px";
          video.style.top = "0px";
          video.style.left = "0px";
          video.style.zIndex = "-9999";
          video.style.opacity = "1";
          video.style.transform = "scale(0.001)";
          video.style.pointerEvents = "none";
          document.body.appendChild(video);

          currentVideo = video;

          let lastNode: AudioNode | null = null;

          if (audioBuffer) {
            bufferSource = audioCtx.createBufferSource();
            bufferSource.buffer = audioBuffer;
            lastNode = bufferSource;
          } else {
            try {
              elementSource = audioCtx.createMediaElementSource(video);
              lastNode = elementSource;
            } catch (elemErr) {
              console.warn(
                "MediaElementAudioSourceNode creation warning:",
                elemErr,
              );
            }
          }

          if (lastNode && config.enhanceAudio) {
            // 1. Highpass filter (reduces low frequency rumble & background hum)
            const hpFilter = audioCtx.createBiquadFilter();
            hpFilter.type = "highpass";
            hpFilter.frequency.value = 85;
            lastNode.connect(hpFilter);
            lastNode = hpFilter;

            // 2. Lowpass filter (reduces high frequency hiss)
            const lpFilter = audioCtx.createBiquadFilter();
            lpFilter.type = "lowpass";
            lpFilter.frequency.value = 8000;
            lastNode.connect(lpFilter);
            lastNode = lpFilter;

            // 3. Presence equalizer (boosts presence for voice/speech clarity)
            const presenceEq = audioCtx.createBiquadFilter();
            presenceEq.type = "peaking";
            presenceEq.frequency.value = 2500;
            presenceEq.Q.value = 1.0;
            presenceEq.gain.value = 3.0; // +3 dB clarity boost
            lastNode.connect(presenceEq);
            lastNode = presenceEq;

            // 4. Dynamics Compressor (normalizes levels, evens out peaks)
            const compressor = audioCtx.createDynamicsCompressor();
            compressor.threshold.value = -24;
            compressor.knee.value = 30;
            compressor.ratio.value = 4;
            compressor.attack.value = 0.01;
            compressor.release.value = 0.25;
            lastNode.connect(compressor);
            lastNode = compressor;
          }

          if (lastNode) {
            lastNode.connect(dest);
          }

          video.src = clip.url;
          video.load();

          video.onloadedmetadata = async () => {
            try {
              // Ensure audio context is running
              if (audioCtx.state === "suspended") {
                await audioCtx.resume();
              }
              isPlaying = true;
              startDrawing();

              if (bufferSource) {
                try {
                  bufferSource.start(0);
                } catch (bsErr) {
                  console.warn("BufferSource start error:", bsErr);
                }
              }

              // Play video silently
              await video.play().catch(async (playErr) => {
                console.warn("Muted video play fallback:", playErr);
                video.muted = true;
                await video.play().catch((finalErr) => {
                  console.error("Video play failed completely:", finalErr);
                  rejectClip(
                    new Error(
                      `Incapaz de reproduzir o vídeo para exportação: ${finalErr.message}`,
                    ),
                  );
                });
              });
            } catch (err) {
              rejectClip(err);
            }
          };

          const cleanup = () => {
            try {
              if (bufferSource) {
                try {
                  bufferSource.stop();
                } catch (e) {}
                try {
                  bufferSource.disconnect();
                } catch (e) {}
              }
              if (elementSource) {
                try {
                  elementSource.disconnect();
                } catch (e) {}
              }
              video.remove();
            } catch (e) {
              console.warn("Cleanup warning:", e);
            }
          };

          video.onended = () => {
            isPlaying = false;
            stopDrawing();
            cleanup();
            elapsedDuration += clip.duration;
            resolveClip();
          };

          video.onerror = (e) => {
            isPlaying = false;
            stopDrawing();
            cleanup();
            rejectClip(new Error(`Erro ao reproduzir clipe: ${clip.name}`));
          };
        });
      }

      // 8. Finalize export
      onProgress(1.0);
      recorder.stop();
    } catch (error) {
      try {
        const v = document.querySelector(
          'video[style*="pointer-events: none"]',
        );
        if (v) v.remove();
      } catch (e) {}
      reject(error);
    }
  });
};
