import React, { useState } from "react";
import { SubtitleItem } from "../../../types";
import { 
  Palette, 
  AlignLeft, 
  Clock 
} from "lucide-react";
import { Button, Input, Tabs } from "@heroui/react";

interface SubtitlesPanelProps {
  subtitles: SubtitleItem[];
  setSubtitles: React.Dispatch<React.SetStateAction<SubtitleItem[]>>;
  subtitleConfig: {
    fontSizeScale: number;
    position: 'bottom' | 'top' | 'center';
    color: string;
    backgroundColor: string;
  };
  setSubtitleConfig: React.Dispatch<React.SetStateAction<{
    fontSizeScale: number;
    position: 'bottom' | 'top' | 'center';
    color: string;
    backgroundColor: string;
  }>>;
}

export function SubtitlesPanel({
  subtitles,
  setSubtitles,
  subtitleConfig,
  setSubtitleConfig
}: SubtitlesPanelProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'style'>('text');

  if (subtitles.length === 0) return null;

  return (
    <div id="subtitles-panel-container" className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl transition-all duration-300">
      
      {/* Tabs Menu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
          <Button
            variant={activeTab === 'text' ? 'primary' : 'tertiary'}
            size="sm"
            onPress={() => setActiveTab('text')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'text'
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <AlignLeft className="w-4 h-4 text-purple-400" />
            <span>Editor de Legendas</span>
          </Button>
          
          <Button
            variant={activeTab === 'style' ? 'primary' : 'tertiary'}
            size="sm"
            onPress={() => setActiveTab('style')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'style'
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Palette className="w-4 h-4 text-purple-400" />
            <span>Estilizar Legendas</span>
          </Button>
        </div>
      </div>

      <div className="min-h-[220px]">
        
        {/* TAB 2: ORIGINAL INDIVIDUAL SUBTITLE TIMING & LINE EDITOR */}
        {activeTab === 'text' && (
          <div className="space-y-4 animate-fade-in text-left">
            {/* Global Sync Control */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-purple-400 shrink-0" />
                <div className="text-left">
                  <h4 className="text-xs font-semibold text-slate-200">Sincronização Global</h4>
                  <p className="text-[10px] text-slate-500">Atrase ou adiante o tempo de todas as legendas juntas</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => {
                    const newSubs = subtitles.map(sub => {
                      const newStart = Math.max(0, Number((sub.start - 0.5).toFixed(2)));
                      const newEnd = Math.max(newStart + 0.1, Number((sub.end - 0.5).toFixed(2)));
                      return { ...sub, start: newStart, end: newEnd };
                    });
                    setSubtitles(newSubs);
                  }}
                  className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer h-auto min-h-0"
                  aria-label="Atrasar 0.5s"
                >
                  -0.5s
                </Button>
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => {
                    const newSubs = subtitles.map(sub => {
                      const newStart = Math.max(0, Number((sub.start - 0.1).toFixed(2)));
                      const newEnd = Math.max(newStart + 0.1, Number((sub.end - 0.1).toFixed(2)));
                      return { ...sub, start: newStart, end: newEnd };
                    });
                    setSubtitles(newSubs);
                  }}
                  className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer h-auto min-h-0"
                  aria-label="Atrasar 0.1s"
                >
                  -0.1s
                </Button>
                
                <div className="h-4 w-px bg-slate-800 mx-0.5"></div>
                
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => {
                    const newSubs = subtitles.map(sub => {
                      const newStart = Number((sub.start + 0.1).toFixed(2));
                      const newEnd = Number((sub.end + 0.1).toFixed(2));
                      return { ...sub, start: newStart, end: newEnd };
                    });
                    setSubtitles(newSubs);
                  }}
                  className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer h-auto min-h-0"
                  aria-label="Adiantar 0.1s"
                >
                  +0.1s
                </Button>
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => {
                    const newSubs = subtitles.map(sub => {
                      const newStart = Number((sub.start + 0.5).toFixed(2));
                      const newEnd = Number((sub.end + 0.5).toFixed(2));
                      return { ...sub, start: newStart, end: newEnd };
                    });
                    setSubtitles(newSubs);
                  }}
                  className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer h-auto min-h-0"
                  aria-label="Adiantar 0.5s"
                >
                  +0.5s
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {subtitles.map((sub, idx) => (
                <div key={idx} className="flex flex-col gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-[10px]">Início:</span>
                      <button
                        onClick={() => {
                          const newSubs = [...subtitles];
                          newSubs[idx].start = Math.max(0, Number((sub.start - 0.1).toFixed(1)));
                          if (newSubs[idx].start >= newSubs[idx].end) {
                            newSubs[idx].end = Number((newSubs[idx].start + 0.1).toFixed(1));
                          }
                          setSubtitles(newSubs);
                        }}
                        className="w-4.5 h-4.5 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors flex items-center justify-center text-[10px] font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="min-w-[28px] text-center">{sub.start.toFixed(1)}s</span>
                      <button
                        onClick={() => {
                          const newSubs = [...subtitles];
                          newSubs[idx].start = Number((sub.start + 0.1).toFixed(1));
                          if (newSubs[idx].start >= newSubs[idx].end) {
                            newSubs[idx].end = Number((newSubs[idx].start + 0.1).toFixed(1));
                          }
                          setSubtitles(newSubs);
                        }}
                        className="w-4.5 h-4.5 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors flex items-center justify-center text-[10px] font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <div className="h-3 w-px bg-slate-800"></div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-[10px]">Fim:</span>
                      <button
                        onClick={() => {
                          const newSubs = [...subtitles];
                          newSubs[idx].end = Math.max(sub.start + 0.1, Number((sub.end - 0.1).toFixed(1)));
                          setSubtitles(newSubs);
                        }}
                        className="w-4.5 h-4.5 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors flex items-center justify-center text-[10px] font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="min-w-[28px] text-center">{sub.end.toFixed(1)}s</span>
                      <button
                        onClick={() => {
                          const newSubs = [...subtitles];
                          newSubs[idx].end = Number((sub.end + 0.1).toFixed(1));
                          setSubtitles(newSubs);
                        }}
                        className="w-4.5 h-4.5 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors flex items-center justify-center text-[10px] font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  <input
                    type="text"
                    value={sub.text}
                    onChange={(e) => {
                      const newSubs = [...subtitles];
                      newSubs[idx].text = e.target.value;
                      
                      // Also sync words array if it exists
                      if (newSubs[idx].words && newSubs[idx].words!.length > 0) {
                        const wordsRaw = e.target.value.trim().split(/\s+/).filter(w => w.length > 0);
                        const duration = newSubs[idx].end - newSubs[idx].start;
                        const wordDuration = duration / Math.max(1, wordsRaw.length);
                        
                        newSubs[idx].words = wordsRaw.map((word, wIdx) => {
                          const start = Number((newSubs[idx].start + wIdx * wordDuration).toFixed(2));
                          const end = Number((start + wordDuration).toFixed(2));
                          return {
                            id: `word-${idx}-${wIdx}-${word}-${Math.random()}`,
                            text: word,
                            start,
                            end,
                            deleted: false
                          };
                        });
                      }
                      
                      setSubtitles(newSubs);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-200 outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SUBTITLE STYLE PREFERENCES */}
        {activeTab === 'style' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in text-left">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-2 font-medium">Tamanho da Fonte</label>
              <select 
                value={subtitleConfig.fontSizeScale}
                onChange={e => setSubtitleConfig(prev => ({...prev, fontSizeScale: Number(e.target.value)}))}
                className="w-full bg-slate-900 border border-slate-800 px-3 py-2.5 rounded-lg text-sm text-slate-200 outline-none focus:border-purple-500/50 transition-colors cursor-pointer"
              >
                <option value={0.75}>Pequeno</option>
                <option value={1}>Médio</option>
                <option value={1.25}>Grande</option>
                <option value={1.5}>Extra Grande</option>
              </select>
            </div>
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-2 font-medium">Posição na Tela</label>
              <select 
                value={subtitleConfig.position}
                onChange={e => setSubtitleConfig(prev => ({...prev, position: e.target.value as any}))}
                className="w-full bg-slate-900 border border-slate-800 px-3 py-2.5 rounded-lg text-sm text-slate-200 outline-none focus:border-purple-500/50 transition-colors cursor-pointer"
              >
                <option value="top">Topo</option>
                <option value="center">Centro</option>
                <option value="bottom">Base</option>
              </select>
            </div>
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-2 font-medium">Cor do Texto</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="color"
                  value={subtitleConfig.color}
                  onChange={e => setSubtitleConfig(prev => ({...prev, color: e.target.value}))}
                  className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={subtitleConfig.color}
                  onChange={e => setSubtitleConfig(prev => ({...prev, color: e.target.value}))}
                  className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-200 outline-none font-mono"
                />
              </div>
            </div>
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-2 font-medium">Cor de Fundo</label>
              <select 
                value={subtitleConfig.backgroundColor}
                onChange={e => setSubtitleConfig(prev => ({...prev, backgroundColor: e.target.value}))}
                className="w-full bg-slate-900 border border-slate-800 px-3 py-2.5 rounded-lg text-sm text-slate-200 outline-none focus:border-purple-500/50 transition-colors cursor-pointer"
              >
                <option value="rgba(0, 0, 0, 0.75)">Preto Translúcido</option>
                <option value="rgba(0, 0, 0, 1)">Preto Sólido</option>
                <option value="rgba(255, 255, 255, 0.9)">Branco</option>
                <option value="transparent">Sem Fundo</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

