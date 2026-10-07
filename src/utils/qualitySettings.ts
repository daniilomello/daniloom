export type RecordingResolution = "720p" | "1080p" | "4k";
export type RecordingQualityProfile = "otimizado" | "performance" | "qualidade";

export interface QualityDimensions {
  width: number;
  height: number;
}

/**
 * Retorna as dimensões exatas de largura e altura baseadas na resolução e orientação
 */
export function getRecordingDimensions(
  resolution: RecordingResolution,
  format: "landscape" | "portrait",
): QualityDimensions {
  let w = 1920;
  let h = 1080;

  if (resolution === "720p") {
    w = 1280;
    h = 720;
  } else if (resolution === "1080p") {
    w = 1920;
    h = 1080;
  } else if (resolution === "4k") {
    w = 3840;
    h = 2160;
  }

  return format === "portrait"
    ? { width: h, height: w }
    : { width: w, height: h };
}

/**
 * Calcula a taxa de bits (videoBitsPerSecond) dinamicamente baseada na resolução e perfil
 * - otimizado: Equilíbrio perfeito entre alta qualidade e compatibilidade (12Mbps para 1080p, 25Mbps para 4K)
 * - performance: Foco em menor consumo de CPU e tamanhos reduzidos
 * - qualidade: Ultra qualidade sem perdas visíveis para YouTube / Projetos 4K (até 45Mbps)
 */
export function getRecordingBitrate(
  resolution: RecordingResolution,
  profile: RecordingQualityProfile,
): number {
  if (profile === "performance") {
    switch (resolution) {
      case "720p":
        return 2_500_000; // 2.5 Mbps
      case "1080p":
        return 5_000_000; // 5 Mbps
      case "4k":
        return 12_000_000; // 12 Mbps
    }
  }

  if (profile === "qualidade") {
    switch (resolution) {
      case "720p":
        return 8_000_000; // 8 Mbps
      case "1080p":
        return 20_000_000; // 20 Mbps
      case "4k":
        return 45_000_000; // 45 Mbps
    }
  }

  // "otimizado" (padrão equilibrado)
  switch (resolution) {
    case "720p":
      return 5_000_000; // 5 Mbps
    case "1080p":
      return 12_000_000; // 12 Mbps
    case "4k":
      return 25_000_000; // 25 Mbps
  }
}

export function getRecordingResolutionSetting(): RecordingResolution {
  const val = localStorage.getItem("daniloom_recording_resolution");
  if (val === "720p" || val === "1080p" || val === "4k") return val;
  return "1080p";
}

export function setRecordingResolutionSetting(res: RecordingResolution): void {
  localStorage.setItem("daniloom_recording_resolution", res);
  window.dispatchEvent(new Event("daniloom_quality_changed"));
}

export function getRecordingQualityProfileSetting(): RecordingQualityProfile {
  const val = localStorage.getItem("daniloom_recording_quality_profile");
  if (val === "otimizado" || val === "performance" || val === "qualidade")
    return val;
  return "otimizado";
}

export function setRecordingQualityProfileSetting(
  profile: RecordingQualityProfile,
): void {
  localStorage.setItem("daniloom_recording_quality_profile", profile);
  window.dispatchEvent(new Event("daniloom_quality_changed"));
}
