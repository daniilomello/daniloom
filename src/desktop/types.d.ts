export type CaptureMode = 'screen' | 'window' | 'area';
export type DesktopAction = 'toggle' | 'stop' | 'split' | 'restart' | 'cancel' | CaptureMode;
export interface DesktopDevices { camera: boolean; microphone: boolean; selectedCamera: string; selectedMicrophone: string; cameras: { id: string; label: string }[]; microphones: { id: string; label: string }[] }
export interface CaptureRegion { x: number; y: number; width: number; height: number }
export interface DesktopRecordingState {
  recording: boolean;
  paused: boolean;
  duration: number;
  waiting?: boolean;
  devices?: DesktopDevices;
  finalizing?: boolean;
  countdown?: number | null;
}
declare global {
  interface Window {
    daniloomDesktop?: {
      platform: string;
      openWidget: () => Promise<void>;
      openStudio: () => Promise<void>;
      recordingComplete: (continueSession?: boolean) => Promise<void>;
      setCaptureMode: (mode: CaptureMode | 'choose') => Promise<void>;
      getCaptureRegion: () => Promise<CaptureRegion | null>;
      selectCaptureRegion: (region: CaptureRegion | null) => Promise<void>;
      requestPermissions: () => Promise<void>;
      authorize: (scope: 'drive' | 'youtube') => Promise<{ accessToken: string }>;
      openBrowser: (pathname?: string) => Promise<void>;
      openRecordings: () => Promise<string>;
      beginRecording: (mime: string, project?: { id: string; name: string } | null) => Promise<string>;
      appendRecording: (id: string, bytes: ArrayBuffer) => Promise<void>;
      finishRecording: (id: string, discard?: boolean) => Promise<string | null>;
      setRecordingState: (state: DesktopRecordingState) => Promise<void>;
      getRecordingState: () => Promise<DesktopRecordingState>;
      deviceMenu: (kind: 'camera' | 'microphone') => Promise<void>;
      toggleDevice: (kind: 'camera' | 'microphone') => Promise<void>;
      onDevice: (callback: (value: { kind: 'camera' | 'microphone'; id?: string }) => void) => () => void;
      action: (action: DesktopAction) => Promise<void>;
      onAction: (callback: (action: DesktopAction) => void) => () => void;
      onRecordingState: (callback: (state: DesktopRecordingState) => void) => () => void;
    };
  }
}
