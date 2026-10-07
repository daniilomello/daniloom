import { getSupportedMimeType } from "./videoMerger";

export const replaceVideoAudio = (
  videoUrl: string,
  audioUrl: string,
  duration: number,
  onProgress: (progress: number) => void,
): Promise<Blob> => {
  return new Promise(async (resolve, reject) => {
    let video: HTMLVideoElement | null = null;
    let audio: HTMLAudioElement | null = null;
    let audioCtx: AudioContext | null = null;
    let drawWorker: Worker | null = null;
    let progressInterval: any = null;
    let recorder: MediaRecorder | null = null;
    let combinedStream: MediaStream | null = null;
    let isFinished = false;

    const cleanup = () => {
      isFinished = true;
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      if (drawWorker) {
        try {
          drawWorker.postMessage("stop");
          drawWorker.terminate();
        } catch (e) {}
      }
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch (e) {}
      }
      if (video) {
        try {
          video.pause();
          video.remove();
        } catch (e) {}
      }
      if (audio) {
        try {
          audio.pause();
          audio.remove();
        } catch (e) {}
      }
      if (combinedStream) {
        try {
          combinedStream.getTracks().forEach((track) => track.stop());
        } catch (e) {}
      }
    };

    try {
      // 1. Create elements
      video = document.createElement("video");
      video.src = videoUrl;
      video.muted = true; // We don't want the original video audio
      video.playsInline = true;
      video.crossOrigin = "anonymous";

      audio = document.createElement("audio");
      audio.src = audioUrl;
      audio.crossOrigin = "anonymous";

      // Position offscreen
      video.style.position = "fixed";
      video.style.width = "10px";
      video.style.height = "10px";
      video.style.top = "0px";
      video.style.left = "0px";
      video.style.opacity = "0";
      video.style.pointerEvents = "none";
      document.body.appendChild(video);

      audio.style.position = "fixed";
      audio.style.width = "10px";
      audio.style.height = "10px";
      audio.style.opacity = "0";
      audio.style.pointerEvents = "none";
      document.body.appendChild(audio);

      // Wait for both to load metadata and be ready
      await Promise.all([
        new Promise((r) => {
          if (video!.readyState >= 2) r(null);
          else video!.onloadedmetadata = r;
        }),
        new Promise((r) => {
          if (audio!.readyState >= 2) r(null);
          else audio!.onloadedmetadata = r;
        }),
      ]);

      // 2. Setup Web Audio API
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioContextClass();
      const dest = audioCtx.createMediaStreamDestination();
      const source = audioCtx.createMediaElementSource(audio);
      source.connect(dest);

      // Determine video capture capabilities
      const mimeType = getSupportedMimeType("mp4");
      const highQualityBitrate = 16000000; // Ultra high quality 16 Mbps to prevent video compression artifacts

      let videoStream: MediaStream | null = null;
      if ((video as any).captureStream) {
        videoStream = (video as any).captureStream();
      } else if ((video as any).mozCaptureStream) {
        videoStream = (video as any).mozCaptureStream();
      }

      if (videoStream && videoStream.getVideoTracks().length > 0) {
        console.log(
          "Using direct hardware-decoded Video Stream capture - lossless layout quality",
        );
        const videoTrack = videoStream.getVideoTracks()[0];

        combinedStream = new MediaStream([
          videoTrack,
          ...dest.stream.getAudioTracks(),
        ]);

        recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: highQualityBitrate,
        });

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const finalBlob = new Blob(chunks, {
            type: chunks[0]?.type || mimeType,
          });
          cleanup();
          resolve(finalBlob);
        };

        let lastProgressTime = 0;
        progressInterval = setInterval(() => {
          if (isFinished || !video) return;
          const currentVideoTime = video.currentTime || 0;
          const currentTotalProgress = currentVideoTime / duration;
          const now = Date.now();
          if (now - lastProgressTime > 150) {
            onProgress(Math.min(currentTotalProgress, 0.99));
            lastProgressTime = now;
          }

          if (video.ended || currentVideoTime >= duration) {
            clearInterval(progressInterval);
            if (recorder && recorder.state !== "inactive") {
              recorder.stop();
            }
          }
        }, 100);

        // Start recording
        recorder.start();
        video.currentTime = 0;
        audio.currentTime = 0;

        video
          .play()
          .catch((e) =>
            console.warn("Video playback error during replacement:", e),
          );
        audio
          .play()
          .catch((e) =>
            console.warn("Audio playback error during replacement:", e),
          );
      } else {
        // Fallback to Canvas capture stream (high bitrate 16 Mbps)
        console.log(
          "Direct Video capture not supported - falling back to high bitrate canvas rendering",
        );
        const vw = video.videoWidth || 1280;
        const vh = video.videoHeight || 720;

        const canvas = document.createElement("canvas");
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create 2D canvas context.");

        ctx.fillStyle = "#0c0d0f";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const canvasStream = (canvas as any).captureStream
          ? (canvas as any).captureStream(30)
          : null;
        if (!canvasStream)
          throw new Error(
            "Canvas captureStream is not supported in this browser.",
          );

        const tracks = [
          ...canvasStream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ];
        combinedStream = new MediaStream(tracks);

        recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: highQualityBitrate,
        });

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const finalBlob = new Blob(chunks, {
            type: chunks[0]?.type || mimeType,
          });
          cleanup();
          resolve(finalBlob);
        };

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
        drawWorker = new Worker(URL.createObjectURL(workerBlob));

        let isPlaying = false;
        let lastProgressTime = 0;

        drawWorker.onmessage = () => {
          if (isFinished || !isPlaying || !video) {
            if (drawWorker) drawWorker.postMessage("next");
            return;
          }

          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const currentVideoTime = video.currentTime || 0;
            const currentTotalProgress = currentVideoTime / duration;
            const now = Date.now();
            if (now - lastProgressTime > 150) {
              onProgress(Math.min(currentTotalProgress, 0.99));
              lastProgressTime = now;
            }

            if (video.ended || currentVideoTime >= duration) {
              isPlaying = false;
              if (drawWorker) drawWorker.postMessage("stop");
              if (recorder && recorder.state !== "inactive") {
                recorder.stop();
              }
              return;
            }
          } catch (err) {
            console.warn("AudioReplacer draw frame error:", err);
          }

          if (drawWorker) drawWorker.postMessage("next");
        };

        recorder.start();
        isPlaying = true;
        video.currentTime = 0;
        audio.currentTime = 0;

        video
          .play()
          .catch((e) =>
            console.warn("Video playback error during replacement:", e),
          );
        audio
          .play()
          .catch((e) =>
            console.warn("Audio playback error during replacement:", e),
          );

        drawWorker.postMessage("start");
      }
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
};

export function bufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = Raw uncompressed PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const l = buffer.length;
  const bufferLength = l * blockAlign + 44;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(view, 0, "RIFF");
  /* file length */
  view.setUint32(4, 36 + l * blockAlign, true);
  /* RIFF type */
  writeString(view, 8, "WAVE");
  /* format chunk identifier */
  writeString(view, 12, "fmt ");
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, "data");
  /* data chunk length */
  view.setUint32(40, l * blockAlign, true);

  // Write the actual PCM audio samples
  let offset = 44;
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  for (let i = 0; i < l; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      // Clamp sample to [-1.0, 1.0]
      if (sample > 1) sample = 1;
      else if (sample < -1) sample = -1;

      // Scale to 16-bit integer
      const sample16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}
