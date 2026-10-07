/**
 * Recording Engine Module
 * Encapsulates MediaRecorder configuration, MIME fallback logic, audio mixing,
 * and recorder lifecycle management.
 */

export interface RecordingOptions {
  desktopProject?: { id: string; name: string } | null;
  videoTrack: MediaStreamTrack;
  recordingMode: string;
  finalAudioTrack?: MediaStreamTrack | null;
  screenStream?: MediaStream | null;
  micStream?: MediaStream | null;
  videoBitsPerSecond?: number;
  initialMicGain?: number;
  onGainNodeCreated?: (gainNode: GainNode) => void;
}

export interface RecordingResult {
  videoBlob: Blob;
  mimeType: string;
  duration: number;
}

/**
 * Determines the best supported MIME type for MediaRecorder in the current browser.
 */
export function getSupportedMimeType(): string {
  const candidates = [
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4;codecs=h264,aac",
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264,opus",
    "video/webm",
  ];
  if (
    typeof MediaRecorder !== "undefined" &&
    typeof MediaRecorder.isTypeSupported === "function"
  ) {
    for (const mime of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(mime)) {
          return mime;
        }
      } catch (e) {}
    }
  }
  return "";
}

/**
 * Combines system and microphone audio tracks into a single destination MediaStreamTrack if both are present.
 */
export function combineAudioTracks(
  systemAudioTrack: MediaStreamTrack | null | undefined,
  micAudioTrack: MediaStreamTrack | null | undefined,
  initialMicGain: number = 100,
  onGainNodeCreated?: (gainNode: GainNode) => void,
): {
  combinedTrack: MediaStreamTrack | null;
  audioContext: AudioContext | null;
} {
  if (!systemAudioTrack && !micAudioTrack) {
    return { combinedTrack: null, audioContext: null };
  }

  const AudioCtxClass =
    window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) {
    return {
      combinedTrack: micAudioTrack || systemAudioTrack || null,
      audioContext: null,
    };
  }

  try {
    const audioCtx = new AudioCtxClass();
    const dest = audioCtx.createMediaStreamDestination();

    if (systemAudioTrack) {
      const sysSource = audioCtx.createMediaStreamSource(
        new MediaStream([systemAudioTrack]),
      );
      sysSource.connect(dest);
    }

    if (micAudioTrack) {
      const micSource = audioCtx.createMediaStreamSource(
        new MediaStream([micAudioTrack]),
      );
      const micGainNode = audioCtx.createGain();
      micGainNode.gain.value = Math.pow(initialMicGain / 100, 2);
      micSource.connect(micGainNode);
      micGainNode.connect(dest);
      if (onGainNodeCreated) {
        onGainNodeCreated(micGainNode);
      }
    }

    return {
      combinedTrack: dest.stream.getAudioTracks()[0] || null,
      audioContext: audioCtx,
    };
  } catch (err) {
    console.warn(
      "Could not create audio context for combineAudioTracks, falling back to raw audio:",
      err,
    );
    return {
      combinedTrack: micAudioTrack || systemAudioTrack || null,
      audioContext: null,
    };
  }
}

/**
 * Builds a MediaStream containing video and audio tracks for recording.
 */
export function buildRecordingStream(options: RecordingOptions): {
  recordingStream: MediaStream;
  audioContext: AudioContext | null;
} {
  const tracks: MediaStreamTrack[] = [options.videoTrack];
  let audioContext: AudioContext | null = null;

  const systemAudioTrack =
    options.recordingMode === "camera"
      ? null
      : options.screenStream?.getAudioTracks()[0];
  const micAudioTrack =
    options.recordingMode === "camera"
      ? options.finalAudioTrack
      : options.micStream?.getAudioTracks()[0];

  const audioResult = combineAudioTracks(
    systemAudioTrack,
    micAudioTrack,
    options.initialMicGain,
    options.onGainNodeCreated,
  );

  audioContext = audioResult.audioContext;

  if (audioResult.combinedTrack) {
    tracks.push(audioResult.combinedTrack);
  }

  return {
    recordingStream: new MediaStream(tracks),
    audioContext,
  };
}

/**
 * Class-based or functional wrapper around MediaRecorder for imperative operations.
 */
export class RecordingEngine {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType: string = getSupportedMimeType();
  private audioContext: AudioContext | null = null;
  private desktopRecording: Promise<string> | null = null;
  private diskQueue: Promise<void> = Promise.resolve();
  private diskError: unknown = null;

  public initialize(options: RecordingOptions): MediaRecorder {
    const { recordingStream, audioContext } = buildRecordingStream(options);
    this.audioContext = audioContext;
    this.chunks = [];
    this.mimeType = getSupportedMimeType();

    let recorder: MediaRecorder;
    try {
      if (this.mimeType) {
        recorder = new MediaRecorder(recordingStream, {
          mimeType: this.mimeType,
          videoBitsPerSecond: options.videoBitsPerSecond || 8000000,
        });
      } else {
        recorder = new MediaRecorder(recordingStream);
      }
    } catch (err1) {
      try {
        if (this.mimeType) {
          recorder = new MediaRecorder(recordingStream, {
            mimeType: this.mimeType,
          });
        } else {
          recorder = new MediaRecorder(recordingStream);
        }
      } catch (err2) {
        recorder = new MediaRecorder(recordingStream);
      }
    }

    this.mimeType = recorder.mimeType || this.mimeType || "video/webm";

    const desktop = window.daniloomDesktop;
    if (desktop) {
      this.desktopRecording = desktop.beginRecording(this.mimeType, options.desktopProject);
      this.diskQueue = this.desktopRecording.then(() => {}).catch((error) => { this.diskError = error; });
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
        if (desktop && this.desktopRecording) {
          this.diskQueue = this.diskQueue.then(async () => {
            if (this.diskError) return;
            const id = await this.desktopRecording!;
            await desktop.appendRecording(id, await e.data.arrayBuffer());
          }).catch((error) => { this.diskError = error; });
        }
      }
    };

    this.mediaRecorder = recorder;
    return recorder;
  }

  public getRecorder(): MediaRecorder | null {
    return this.mediaRecorder;
  }

  public getMimeType(): string {
    return this.mimeType;
  }

  public getChunks(): Blob[] {
    return this.chunks;
  }

  public buildBlob(): Blob {
    return new Blob(this.chunks, { type: this.mimeType });
  }

  public async finishDesktopRecording(discard = false): Promise<string | null> {
    if (!this.desktopRecording || !window.daniloomDesktop) return null;
    await this.diskQueue;
    let result: string | null = null;
    try {
      result = await window.daniloomDesktop.finishRecording(await this.desktopRecording, discard);
    } finally {
      this.desktopRecording = null;
    }
    if (this.diskError) throw this.diskError;
    return result;
  }

  public cleanupAudioContext(): void {
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        console.warn("Error closing audio context in RecordingEngine:", e);
      }
      this.audioContext = null;
    }
  }
}
