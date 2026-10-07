import type { CaptureMode, DesktopDevices } from './types';
import { useEffect, useRef } from 'react';

export function useDesktopControls({ recording, paused, duration, countdown, start, pause, resume, stop, startCapture, split, restart, cancel, waiting, devices, device }: {
  recording: boolean; paused: boolean; duration: number; countdown: number | null;
  waiting: boolean; devices: DesktopDevices; device: (value: { kind: 'camera' | 'microphone'; id?: string }) => void;
  split: () => void; restart: () => void; cancel: () => void;
  startCapture: (mode: CaptureMode) => void;
  start: () => void; pause: () => void; resume: () => void; stop: () => void;
}) {
  const actions = useRef({ recording, paused, start, pause, resume, stop, startCapture, split, restart, cancel, device });
  actions.current = { recording, paused, start, pause, resume, stop, startCapture, split, restart, cancel, device };
  useEffect(() => {
    return window.daniloomDesktop?.onAction((action) => {
      const current = actions.current;
      if (['screen', 'window', 'area'].includes(action)) { if (!current.recording) current.startCapture(action as CaptureMode); }
      else if (action === 'split') { if (current.recording) current.split(); }
      else if (action === 'restart') { if (current.recording) current.restart(); }
      else if (action === 'cancel') current.cancel();
      else if (action === 'stop') { if (current.recording) current.stop(); }
      else if (!current.recording) current.start();
      else if (current.paused) current.resume();
      else current.pause();
    });
  }, []);
  useEffect(() => window.daniloomDesktop?.onDevice(value => actions.current.device(value)), []);
  useEffect(() => {
    void window.daniloomDesktop?.setRecordingState({ recording, paused, duration, countdown, waiting, devices }).catch(console.error);
  }, [recording, paused, duration, countdown, waiting, devices]);
  useEffect(() => {
    if (!window.daniloomDesktop || !recording) return;
    const preventReload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventReload);
    return () => window.removeEventListener('beforeunload', preventReload);
  }, [recording]);
}
