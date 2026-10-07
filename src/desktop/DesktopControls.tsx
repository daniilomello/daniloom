import { useEffect, useState } from 'react';
import { GripVertical, Pause, Play, Square, Maximize2, Monitor, Mic, MicOff, Camera, CameraOff, ChevronDown, Scissors, RotateCcw, X, Loader2, AppWindow, Scan } from 'lucide-react';
import { useAppTheme } from '../hooks/useAppTheme';
import type { CaptureMode, DesktopAction, DesktopRecordingState } from './types';

export function DesktopControls() {
  useAppTheme();
  const [mode, setMode] = useState<CaptureMode>('screen');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [state, setState] = useState<DesktopRecordingState>({ recording: false, paused: false, duration: 0 });
  useEffect(() => {
    const desktop = window.daniloomDesktop;
    if (!desktop) return;
    void desktop.getRecordingState().then(setState);
    return desktop.onRecordingState(setState);
  }, []);
  const busy = state.finalizing || state.countdown != null;
  const configuring = !busy && (!state.recording || state.waiting);
  const action = (value: DesktopAction) => void window.daniloomDesktop?.action(value);
  const iconButton = (label: string, Icon: typeof Play, click: () => void, disabled = false, active = false) => (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={click} className={`p-2 rounded-lg hover:bg-hover disabled:opacity-30 disabled:cursor-not-allowed ${active ? 'text-accent' : 'text-fg-muted hover:text-fg'}`}><Icon className="w-4 h-4" /></button>
  );
  const minutes = Math.floor(state.duration / 60).toString().padStart(2, '0');
  const seconds = (state.duration % 60).toString().padStart(2, '0');
  return (
    <main className="h-screen bg-app text-fg flex items-center gap-1 px-2 border border-line rounded-xl" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <GripVertical className="w-4 h-4 shrink-0 text-fg-muted" />
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${state.recording && !state.paused ? 'bg-red-500 animate-pulse' : 'bg-fg-muted'}`} />
      <span className="font-mono text-xs w-12 text-center shrink-0" aria-label={state.finalizing ? 'Salvando clipe' : 'Tempo de gravação'}>{state.finalizing ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : state.countdown != null ? state.countdown : `${minutes}:${seconds}`}</span>
      <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="relative">
          {iconButton('Origem da captura', mode === 'screen' ? Monitor : mode === 'window' ? AppWindow : Scan, () => setSourceOpen(!sourceOpen), !configuring)}
          {sourceOpen && <div className="absolute left-0 top-0 z-50 flex bg-surface border border-line rounded-lg shadow-xl">
            {(['screen', 'window', 'area'] as const).map((value, index) => <span key={value}>{iconButton(['Desktop', 'Janela', 'Selecionar área'][index], [Monitor, AppWindow, Scan][index], () => { setMode(value); setSourceOpen(false); }, false, mode === value)}</span>)}
          </div>}
        </div>
        {(['microphone', 'camera'] as const).map(kind => <div key={kind} className="flex items-center">
          {iconButton(kind === 'camera' ? 'Ativar/desativar câmera' : 'Ativar/desativar microfone', kind === 'camera' ? state.devices?.camera ? Camera : CameraOff : state.devices?.microphone ? Mic : MicOff, () => void window.daniloomDesktop?.toggleDevice(kind), !configuring, state.devices?.[kind])}
          <button type="button" title={kind === 'camera' ? 'Selecionar câmera' : 'Selecionar microfone'} aria-label={kind === 'camera' ? 'Selecionar câmera' : 'Selecionar microfone'} disabled={!configuring} className="py-2 pr-1 text-fg-muted disabled:opacity-30" onClick={() => void window.daniloomDesktop?.deviceMenu(kind)}><ChevronDown className="w-3 h-3" /></button>
        </div>)}
        <div role="separator" className="h-5 w-px bg-line mx-1" />
        {iconButton(!state.recording ? 'Gravar' : state.paused ? 'Continuar' : 'Pausar', !state.recording || state.paused ? Play : Pause, () => action(state.recording ? 'toggle' : mode), !!busy)}
        {iconButton('Encerrar clipe e aguardar o próximo', Scissors, () => action('split'), !!busy || !state.recording || !!state.waiting)}
        {iconButton('Reiniciar clipe atual', RotateCcw, () => action('restart'), !!busy || !state.recording)}
        {iconButton('Cancelar clipe atual', X, () => action('cancel'), !!state.finalizing || (!state.recording && state.countdown == null))}
        {iconButton('Finalizar sessão e abrir clipes', Square, () => action('stop'), !!busy || !state.recording)}
        {iconButton('Abrir Studio', Maximize2, () => void window.daniloomDesktop?.openStudio())}
      </div>
    </main>
  );
}
