/**
 * Preferences and utilities for studio audio DSP (Digital Signal Processing)
 * Master toggle: Original vs Enhanced (Vocal Optimization)
 */

export interface AudioDSPPreferences {
  enhancedAudio: boolean; // Master studio voice optimization (Original vs Enhanced)
  noiseSuppression: boolean; // Web Audio noise gate & notch filters
  autoGainControl: boolean; // Dynamic compressor for consistent vocal volume
  highPassFilter: boolean; // Low-frequency rumble cut (< 85Hz)
  audioNormalization: boolean; // Export loudness normalization (-14 LUFS)
  autoDucking: boolean; // Attenuate background audio during speech
}

const STORAGE_KEYS = {
  enhancedAudio: "daniloom_audio_enhanced_master",
  noiseSuppression: "daniloom_audio_dsp_noise_suppression",
  autoGainControl: "daniloom_audio_dsp_agc",
  highPassFilter: "daniloom_audio_dsp_highpass",
  audioNormalization: "daniloom_audio_dsp_normalization",
  autoDucking: "daniloom_audio_dsp_autoducking",
};

/**
 * Retrieves current Audio DSP preferences.
 * Enhanced Audio master toggle defaults to true (Enhanced by default).
 */
export function getAudioDSPPreferences(): AudioDSPPreferences {
  const enhancedStored = localStorage.getItem(STORAGE_KEYS.enhancedAudio);
  // Default to enhanced = true if not set
  const enhancedAudio = enhancedStored === "true";

  return {
    enhancedAudio,
    noiseSuppression:
      enhancedAudio ||
      localStorage.getItem(STORAGE_KEYS.noiseSuppression) === "true",
    autoGainControl:
      enhancedAudio ||
      localStorage.getItem(STORAGE_KEYS.autoGainControl) === "true",
    highPassFilter:
      enhancedAudio ||
      localStorage.getItem(STORAGE_KEYS.highPassFilter) === "true",
    audioNormalization: false,
    autoDucking: false,
  };
}

/**
 * Toggles the master Enhanced Audio state (Original vs Enhanced)
 */
export function setEnhancedAudioMode(enabled: boolean): AudioDSPPreferences {
  localStorage.setItem(STORAGE_KEYS.enhancedAudio, String(enabled));
  localStorage.setItem(STORAGE_KEYS.noiseSuppression, String(enabled));
  localStorage.setItem(STORAGE_KEYS.autoGainControl, String(enabled));
  localStorage.setItem(STORAGE_KEYS.highPassFilter, String(enabled));

  window.dispatchEvent(new CustomEvent("daniloom_audio_dsp_changed"));
  return getAudioDSPPreferences();
}

/**
 * Saves Audio DSP preferences to localStorage.
 */
export function saveAudioDSPPreferences(
  prefs: Partial<AudioDSPPreferences>,
): AudioDSPPreferences {
  if (prefs.enhancedAudio !== undefined) {
    setEnhancedAudioMode(prefs.enhancedAudio);
    return getAudioDSPPreferences();
  }
  if (prefs.noiseSuppression !== undefined) {
    localStorage.setItem(
      STORAGE_KEYS.noiseSuppression,
      String(prefs.noiseSuppression),
    );
  }
  if (prefs.autoGainControl !== undefined) {
    localStorage.setItem(
      STORAGE_KEYS.autoGainControl,
      String(prefs.autoGainControl),
    );
  }
  if (prefs.highPassFilter !== undefined) {
    localStorage.setItem(
      STORAGE_KEYS.highPassFilter,
      String(prefs.highPassFilter),
    );
  }
  if (prefs.audioNormalization !== undefined) {
    localStorage.setItem(
      STORAGE_KEYS.audioNormalization,
      String(prefs.audioNormalization),
    );
  }
  if (prefs.autoDucking !== undefined) {
    localStorage.setItem(STORAGE_KEYS.autoDucking, String(prefs.autoDucking));
  }

  // Dispatch custom event to notify components
  window.dispatchEvent(new CustomEvent("daniloom_audio_dsp_changed"));
  return getAudioDSPPreferences();
}

/**
 * Resets all Audio DSP preferences.
 */
export function resetAudioDSPPreferences(): AudioDSPPreferences {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  window.dispatchEvent(new CustomEvent("daniloom_audio_dsp_changed"));
  return getAudioDSPPreferences();
}
