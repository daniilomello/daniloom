import { useEffect, useRef, useState, useCallback } from "react";

export interface BluetoothShutterOptions {
  enabled?: boolean;
  isRecording: boolean;
  onTrigger: () => void;
  onFeedback?: (message: string) => void;
}

// 0.5s of silent WAV audio base64 (valid PCM WAV header + silence)
const SILENT_AUDIO_BASE64 =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

/**
 * Hook to capture Bluetooth selfie stick buttons, iOS volume keys, and Bluetooth HID / Media triggers.
 * Includes iOS Safari silent audio loop to unlock MediaSession hardware events, and extensive HID keyboard mapping.
 */
export const useBluetoothShutter = ({
  enabled = true,
  isRecording,
  onTrigger,
  onFeedback,
}: BluetoothShutterOptions) => {
  const lastTriggerTimeRef = useRef<number>(0);
  const onTriggerRef = useRef(onTrigger);
  const onFeedbackRef = useRef(onFeedback);
  const isRecordingRef = useRef(isRecording);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioSessionActive, setIsAudioSessionActive] =
    useState<boolean>(false);

  // Keep references fresh
  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  useEffect(() => {
    onFeedbackRef.current = onFeedback;
  }, [onFeedback]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const fireTrigger = useCallback((source: string) => {
    const now = Date.now();
    // Debounce to prevent rapid double-firing from keydown + keyup or mediaSession double pulses
    if (now - lastTriggerTimeRef.current < 600) {
      return;
    }
    lastTriggerTimeRef.current = now;

    const actionText = isRecordingRef.current
      ? "Finalizando gravação..."
      : "Iniciando gravação...";
    onFeedbackRef.current?.(`Gatilho Bluetooth (${source}): ${actionText}`);
    onTriggerRef.current?.();
  }, []);

  /**
   * Activates the iOS Safari background silent audio session to enable hardware MediaSession listening
   */
  const activateAudioSession = useCallback(() => {
    try {
      if (!audioElementRef.current) {
        const audio = new Audio(SILENT_AUDIO_BASE64);
        audio.loop = true;
        audio.volume = 0.01;
        audio.preload = "auto";
        audioElementRef.current = audio;
      }

      const audio = audioElementRef.current;
      if (audio.paused) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsAudioSessionActive(true);
            })
            .catch(() => {
              // User gesture might still be required
            });
        }
      } else {
        setIsAudioSessionActive(true);
      }
    } catch (e) {
      console.warn("Audio session activation error:", e);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Helper to ignore typing inside inputs
    const isInputElement = (el: EventTarget | null): boolean => {
      if (!el || !(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el.isContentEditable ||
        el.getAttribute("role") === "textbox"
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputElement(e.target)) {
        return;
      }

      const key = e.key;
      const code = e.code;
      const keyCode = e.keyCode || e.which;

      // 1. Hardware Volume buttons (Android / iOS keyboard remotes sending volume codes)
      const isVolumeKey =
        key === "AudioVolumeUp" ||
        key === "AudioVolumeDown" ||
        key === "VolumeUp" ||
        key === "VolumeDown" ||
        code === "AudioVolumeUp" ||
        code === "AudioVolumeDown" ||
        keyCode === 175 || // VK_VOLUME_UP
        keyCode === 174; // VK_VOLUME_DOWN

      // 2. Media Play / Pause keys
      const isMediaKey =
        key === "MediaPlayPause" ||
        key === "MediaPlay" ||
        key === "MediaPause" ||
        key === "MediaTrackNext" ||
        key === "MediaTrackPrevious" ||
        key === "MediaSelect" ||
        key === "MediaStop" ||
        code === "MediaPlayPause" ||
        code === "MediaTrackNext" ||
        code === "MediaTrackPrevious" ||
        keyCode === 179 || // VK_MEDIA_PLAY_PAUSE
        keyCode === 176 || // VK_MEDIA_NEXT_TRACK
        keyCode === 177 || // VK_MEDIA_PREV_TRACK
        keyCode === 178; // VK_MEDIA_STOP

      // 3. Bluetooth Selfie Sticks for iOS sending Return / Space / Arrows / Page buttons
      // (Common standard for AB Shutter 3, Bluetooth Gamepads & iOS Camera remotes)
      const isShutterKey =
        key === "Enter" ||
        key === " " ||
        key === "Spacebar" ||
        code === "Enter" ||
        code === "NumpadEnter" ||
        code === "Space" ||
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        code === "ArrowUp" ||
        code === "ArrowDown" ||
        key === "PageUp" ||
        key === "PageDown" ||
        code === "PageUp" ||
        code === "PageDown" ||
        key === "+" ||
        key === "=" ||
        keyCode === 13 || // Enter
        keyCode === 32 || // Space
        keyCode === 38 || // ArrowUp
        keyCode === 40 || // ArrowDown
        keyCode === 33 || // PageUp
        keyCode === 34; // PageDown

      if (isVolumeKey || isMediaKey || isShutterKey) {
        // Prevent default browser scrolling when space/arrow/enter is used as a shutter
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (err) {}

        let sourceLabel = "Controle Bluetooth / Shutter";
        if (isVolumeKey) sourceLabel = "Botão de Volume";
        else if (isMediaKey) sourceLabel = "Botão de Mídia";
        else if (key === "Enter") sourceLabel = "Botão Shutter (Enter)";
        else if (key === " " || code === "Space")
          sourceLabel = "Botão Shutter (Espaço)";

        fireTrigger(sourceLabel);
      }
    };

    // Auto-unlock audio session on first user tap/touch anywhere
    const handleFirstTouch = () => {
      activateAudioSession();
    };

    window.addEventListener("keydown", handleKeyDown, {
      capture: true,
      passive: false,
    });
    window.addEventListener("touchstart", handleFirstTouch, {
      once: true,
      passive: true,
    });
    window.addEventListener("click", handleFirstTouch, {
      once: true,
      passive: true,
    });

    // Web MediaSession integration for iOS Safari and Bluetooth Remotes
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Daniloom - Gravação de Vídeo",
          artist: "Controle Remoto Bluetooth Ativo",
          album: "Daniloom Studio",
        });

        const handleMediaAction = (details?: MediaSessionActionDetails) => {
          const action = details?.action || "play/pause";
          fireTrigger(`MediaSession ${action}`);
        };

        navigator.mediaSession.setActionHandler("play", handleMediaAction);
        navigator.mediaSession.setActionHandler("pause", handleMediaAction);
        navigator.mediaSession.setActionHandler("stop", handleMediaAction);
        navigator.mediaSession.setActionHandler(
          "previoustrack",
          handleMediaAction,
        );
        navigator.mediaSession.setActionHandler("nexttrack", handleMediaAction);
        navigator.mediaSession.setActionHandler(
          "seekforward",
          handleMediaAction,
        );
        navigator.mediaSession.setActionHandler(
          "seekbackward",
          handleMediaAction,
        );
      } catch (err) {
        console.warn("MediaSession handlers could not be initialized:", err);
      }
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("touchstart", handleFirstTouch);
      window.removeEventListener("click", handleFirstTouch);

      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        try {
          navigator.mediaSession.setActionHandler("play", null);
          navigator.mediaSession.setActionHandler("pause", null);
          navigator.mediaSession.setActionHandler("stop", null);
          navigator.mediaSession.setActionHandler("previoustrack", null);
          navigator.mediaSession.setActionHandler("nexttrack", null);
          navigator.mediaSession.setActionHandler("seekforward", null);
          navigator.mediaSession.setActionHandler("seekbackward", null);
        } catch (err) {}
      }
    };
  }, [enabled, fireTrigger, activateAudioSession]);

  return {
    isAudioSessionActive,
    activateAudioSession,
  };
};
