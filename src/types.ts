export interface Clip {
  id: string;
  name: string;
  url: string;
  blob: Blob;
  duration: number;
  createdAt: Date;
  googleDriveFileId?: string;
  thumbnailUrl?: string;
  format?: "landscape" | "portrait";
  cuts?: { start: number; end: number }[];
}

export interface WordItem {
  id: string;
  text: string;
  start: number;
  end: number;
  deleted?: boolean;
}

export interface SubtitleItem {
  start: number;
  end: number;
  text: string;
  words?: WordItem[];
  deleted?: boolean;
}

export interface ExportConfig {
  format: "mov" | "mp4" | "webm" | "gif";
  quality: "low" | "medium" | "high" | "very_high" | "ultra_4k";
}

export interface KeyboardShortcut {
  id: string;
  label: string;
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface AIResult {
  transcript: string;
  blogPost: string;
  linkedinPost: string;
}

export interface BackupFile {
  id: string;
  name: string;
  webViewLink: string;
  createdAt: Date;
}

export interface DeviceInfo {
  id: string;
  label: string;
}

export interface SubtitleConfig {
  fontSizeScale?: number;
  color?: string;
  backgroundColor?: string;
  position?: "bottom" | "top" | "center";
}

export interface CropRegion {
  enabled: boolean;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  width: number; // percentage (0-100)
  height: number; // percentage (0-100)
}

export type ThemeMode = "dark" | "light";
export type BackgroundPattern = "dots" | "solid" | "grid" | "radial";
export type PaletteId = "neutral" | "warm" | "olive" | "chalk";

export interface ThemeSettings {
  mode: ThemeMode;
  background: BackgroundPattern;
  palette: PaletteId;
}

export interface Scene {
  id: string;
  name: string;
  recordingMode: "screen" | "camera";
  recordingFormat: "landscape" | "portrait";
  cameraShape:
    "circle" | "rectangle" | "split" | "hidden" | "centralized" | "fullscreen";
  cameraPosition:
    | "bottom-left"
    | "bottom-right"
    | "top-left"
    | "top-right"
    | "bottom-center"
    | "top-center";
  bubbleSize: "sm" | "md" | "lg";
  screenSize: "full" | "medium" | "compact";
  cameraFilter: string;
  cameraBrightness: number;
  cameraContrast: number;
  cameraShadow: number;
  cameraBlackPoint: number;
  cameraFlipH: boolean;
  cameraFlipV: boolean;
  splitInverted: boolean;
  screenBgType: "solid" | "gradient" | "pattern" | "camera";
  screenBgValue: string;
  showSpeakerName: boolean;
  speakerName: string;
  cameraOffsetX?: number;
  cameraOffsetY?: number;
  cameraBgBlur?: boolean;
  cameraBgBlurAmount?: number;
  studioLightEnabled?: boolean;
  studioLightIntensity?: number;
  noiseCancellationEnabled?: boolean;
  cropRegion?: CropRegion;
}

export interface MediaClipItem {
  id: string;
  name: string;
  size?: number | string;
  mimeType?: string;
  modifiedTime?: string;
  createdTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  driveFileId?: string;
  localBlob?: Blob;
  localUrl?: string;
  duration?: number;
  format?: "landscape" | "portrait";
  projectId: string;
  projectName: string;
  projectCategory?: string;
  googleDriveFolderId?: string;
  isLocalOnly?: boolean;
}

export interface ProjectGroup {
  id: string;
  name: string;
  category: string;
  googleDriveFolderId: string;
  createdAt: number;
  clips: MediaClipItem[];
  totalSize: number;
}

export interface DriveTokenStatus {
  hasToken: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  expiresAt: number | null;
  remainingMinutes: number;
}
