import { useEffect, useRef, useState } from 'react';
import type { CaptureRegion } from './types';
import { normalizedRegion } from './captureRegion';

export function DesktopRegionSelector() {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<CaptureRegion | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const nodes = [document.documentElement, document.body, document.getElementById('root')!];
    const before = nodes.map(node => ({ background: node.style.background, classes: node.className }));
    nodes.forEach(node => { node.style.background = 'transparent'; node.className = ''; });
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') void window.daniloomDesktop?.selectCaptureRegion(null); };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); nodes.forEach((node, index) => { node.style.background = before[index].background; node.className = before[index].classes; }); };
  }, []);
  return <main className="fixed inset-0 cursor-crosshair select-none" style={{ background: rect ? 'transparent' : 'rgba(0,0,0,.35)' }}
    onPointerDown={event => { if (event.button !== 0) return; start.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); setRect(null); }}
    onPointerMove={event => { if (start.current) setRect(normalizedRegion(start.current, { x: event.clientX, y: event.clientY }, innerWidth, innerHeight)); }}
    onPointerCancel={() => { start.current = null; setRect(null); }}
    onPointerUp={async event => {
      if (!start.current) return;
      const selected = normalizedRegion(start.current, { x: event.clientX, y: event.clientY }, innerWidth, innerHeight);
      start.current = null;
      if (!selected || selected.width * innerWidth < 16 || selected.height * innerHeight < 16) { setRect(null); setError('Arraste uma área com pelo menos 16 × 16 pixels.'); return; }
      try { await window.daniloomDesktop?.selectCaptureRegion(selected); } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível selecionar.'); }
    }}>
    <div className="absolute top-7 left-1/2 -translate-x-1/2 rounded-xl bg-[#0c0d0f] text-white px-5 py-3 text-sm shadow-lg pointer-events-none">{error || 'Arraste para selecionar a área · Esc para cancelar'}</div>
    {rect && <div className="absolute border-2 border-[#6670d4] rounded-sm pointer-events-none" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`, boxShadow: '0 0 0 99999px rgba(0,0,0,.4)' }}><span className="absolute top-2 left-2 bg-[#0c0d0f] text-white rounded px-2 py-1 text-xs">{Math.round(rect.width * innerWidth)} × {Math.round(rect.height * innerHeight)}</span></div>}
  </main>;
}
