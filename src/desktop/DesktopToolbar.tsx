import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudUpload, ExternalLink, FolderOpen, Loader2, Folder, ShieldCheck, Minimize2 } from 'lucide-react';
import { showToast } from '../utils/toast';
import { syncDesktopClip } from './sync';
import type { Clip } from '../types';

export function DesktopToolbar({ clip, recording }: { clip: Clip | null; recording: boolean }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.clipId === clip?.id) setProgress(detail.percent);
    };
    window.addEventListener('daniloom:sync-progress', update);
    return () => window.removeEventListener('daniloom:sync-progress', update);
  }, [clip?.id]);
  if (!window.daniloomDesktop) return null;
  const send = async () => {
    if (!clip) return;
    setBusy(true); setProgress(0);
    try {
      await syncDesktopClip(clip, localStorage.getItem('daniloom_active_project_id') || '');
      showToast('Gravação disponível no projeto, também no navegador.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Não foi possível enviar a gravação.', 'error');
    } finally { setBusy(false); }
  };
  const actions = [
    { label: 'Modo widget', Icon: Minimize2, click: () => void window.daniloomDesktop?.openWidget() },
    { label: 'Projetos', Icon: Folder, disabled: recording, click: () => navigate('/projects') },
    { label: 'Gravações no Mac', Icon: FolderOpen, click: () => void window.daniloomDesktop?.openRecordings() },
    { label: 'Abrir no navegador', Icon: ExternalLink, click: () => void window.daniloomDesktop?.openBrowser('/media') },
    { label: busy ? `Enviando ${progress}%` : 'Enviar ao projeto', Icon: busy ? Loader2 : CloudUpload, disabled: !clip || recording || busy, click: () => void send(), spin: busy },
    { label: 'Permissões do macOS', Icon: ShieldCheck, disabled: recording, click: () => void window.daniloomDesktop?.requestPermissions() },
  ];
  return <>
    <div role="separator" aria-orientation="vertical" className="h-5 w-px bg-line mx-2" />
    {actions.map(({ label, Icon, disabled, click, spin }) => <button key={label} type="button" disabled={disabled} onClick={click} title={label} aria-label={label} className="p-1.5 rounded-lg transition-all cursor-pointer relative group text-fg-muted hover:text-fg hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed">
      <Icon className={`w-4 h-4 ${spin ? 'animate-spin' : ''}`} />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">{label}</span>
    </button>)}
  </>;
}
