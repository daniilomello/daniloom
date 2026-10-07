import type { CaptureRegion } from './types';

export function normalizedRegion(start: { x: number; y: number }, end: { x: number; y: number }, width: number, height: number): CaptureRegion | null {
  if (width <= 0 || height <= 0) return null;
  const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
  const x1 = clamp(start.x, width), x2 = clamp(end.x, width);
  const y1 = clamp(start.y, height), y2 = clamp(end.y, height);
  if (x1 === x2 || y1 === y2) return null;
  return { x: Math.min(x1, x2) / width, y: Math.min(y1, y2) / height, width: Math.abs(x2 - x1) / width, height: Math.abs(y2 - y1) / height };
}

export async function cropDesktopStream(source: MediaStream): Promise<MediaStream> {
  const rect = await window.daniloomDesktop?.getCaptureRegion();
  if (!rect) return source;
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.srcObject = source;
  try { await video.play(); } catch (error) { source.getTracks().forEach(track => track.stop()); throw error; }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.floor(video.videoWidth * rect.width / 2) * 2);
  canvas.height = Math.max(2, Math.floor(video.videoHeight * rect.height / 2) * 2);
  const context = canvas.getContext('2d');
  if (!context) { source.getTracks().forEach(track => track.stop()); throw new Error('Não foi possível preparar a captura de área.'); }
  const output = canvas.captureStream(60);
  const track = output.getVideoTracks()[0];
  for (const audio of source.getAudioTracks()) output.addTrack(audio);
  let animation = 0;
  let stopped = false;
  const draw = () => {
    if (stopped) return;
    context.drawImage(video, video.videoWidth * rect.x, video.videoHeight * rect.y, video.videoWidth * rect.width, video.videoHeight * rect.height, 0, 0, canvas.width, canvas.height);
    animation = requestAnimationFrame(draw);
  };
  const nativeStop = track.stop.bind(track);
  const cleanup = () => {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(animation); nativeStop();
    video.pause(); video.srcObject = null;
    source.getTracks().forEach(item => item.stop());
  };
  track.stop = cleanup;
  source.getVideoTracks()[0].addEventListener('ended', () => { cleanup(); track.dispatchEvent(new Event('ended')); }, { once: true });
  draw();
  return output;
}
