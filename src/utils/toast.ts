// Sistema Global de Notificações Toast com Alertas Sonoros Sintetizados

export type ToastType = "success" | "warning" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

const TOAST_EVENT = "daniloom_toast_event";
const SOUND_SETTINGS_KEY = "daniloom_toast_sounds_enabled";
const TOAST_ENABLED_KEY = "daniloom_toast_enabled";

// Síntese de áudio sintetizada usando Web Audio API para notificações instantâneas
const playNotificationSound = (type: ToastType) => {
  try {
    const isSoundEnabled = localStorage.getItem(SOUND_SETTINGS_KEY) === "true";
    if (!isSoundEnabled) return;

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "success") {
      // Tom ascendente suave de sucesso
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "warning") {
      // Dois toques rápidos
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now); // A4
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === "error") {
      // Tom grave descendente de alerta
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(329.63, now); // E4
      osc.frequency.exponentialRampToValueAtTime(196.0, now + 0.25); // G3
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else {
      // Info: toque sutil C5
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now); // E5
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch (e) {
    // Ignorar falhas de reprodução de áudio se o contexto não foi interagido
  }
};

export const showToast = (
  message: string,
  type: ToastType = "info",
  duration = 3500,
) => {
  const isToastEnabled = localStorage.getItem(TOAST_ENABLED_KEY) !== "false";
  if (!isToastEnabled) return;

  playNotificationSound(type);

  const toastItem: ToastItem = {
    id: Math.random().toString(36).substring(2, 9),
    message,
    type,
    duration,
  };

  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: toastItem }));
};

export const subscribeToToasts = (callback: (toast: ToastItem) => void) => {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ToastItem>;
    if (customEvent.detail) {
      callback(customEvent.detail);
    }
  };

  window.addEventListener(TOAST_EVENT, handler);
  return () => window.removeEventListener(TOAST_EVENT, handler);
};

export const getToastSoundSetting = (): boolean => {
  return localStorage.getItem(SOUND_SETTINGS_KEY) === "true";
};

export const setToastSoundSetting = (enabled: boolean) => {
  localStorage.setItem(SOUND_SETTINGS_KEY, String(enabled));
};

export const getToastEnabledSetting = (): boolean => {
  return localStorage.getItem(TOAST_ENABLED_KEY) !== "false";
};

export const setToastEnabledSetting = (enabled: boolean) => {
  localStorage.setItem(TOAST_ENABLED_KEY, String(enabled));
};
