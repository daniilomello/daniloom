import { useState } from "react";
import { Clip } from "../../../types";
import {
  Play,
  Trash2,
  Edit3,
  Check,
  Upload,
  Download,
  Loader2,
  Layers,
  Clock,
  ArrowLeft,
  ArrowRight,
  Youtube,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  Badge,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "../../../components/ui";

interface TimelineProps {
  clips: Clip[];
  selectedClipId: string | null;
  onSelectClip: (clip: Clip | null) => void;
  onRemoveClip: (clipId: string) => void;
  onReorderClips: (startIndex: number, endIndex: number) => void;
  onRenameClip: (clipId: string, newName: string) => void;
  onImportClip: (clip: Clip) => void;
  onClearClips?: () => void;
  onDownloadClip: (clip: Clip) => void;
  onMergeAndDownload: () => void;
  onOpenYouTubeUpload?: (clip: Clip) => void;
  onMergeClipsToTimeline?: () => void;
  isExporting?: boolean;
  exportProgress?: number;
  isMergingToTimeline?: boolean;
}

export const Timeline = ({
  clips,
  selectedClipId,
  onSelectClip,
  onRemoveClip,
  onReorderClips,
  onRenameClip,
  onImportClip,
  onClearClips,
  onDownloadClip,
  onMergeAndDownload,
  onOpenYouTubeUpload,
  onMergeClipsToTimeline,
  isExporting = false,
  exportProgress = 0,
  isMergingToTimeline = false,
}: TimelineProps) => {
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [tempName, setTempName] = useState("");

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRename = (clip: Clip, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClipId(clip.id);
    setTempName(clip.name);
  };

  const handleSaveRename = (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tempName.trim()) {
      onRenameClip(clipId, tempName.trim());
    }
    setEditingClipId(null);
  };

  return (
    <div className="ds-glass rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3">
        <h3 className="font-sans font-medium text-fg flex items-center gap-2">
          <span>Clips</span>
          <Badge variant="count">{clips.length}</Badge>
        </h3>
        <div className="flex items-center gap-1">
          <label
            className="flex items-center justify-center p-1.5 hover:bg-hover text-fg-muted hover:text-fg rounded-lg cursor-pointer transition-all relative group"
            title="Importar Vídeo"
          >
            <Upload className="w-3.5 h-3.5" />
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                const video = document.createElement("video");
                video.src = url;
                video.onloadedmetadata = () => {
                  onImportClip({
                    id:
                      "import_" +
                      Date.now() +
                      "_" +
                      Math.floor(Math.random() * 1000),
                    name: file.name.replace(/\.[^/.]+$/, ""),
                    url,
                    blob: file,
                    duration: video.duration || 1,
                    createdAt: new Date(),
                  });
                };
                e.target.value = "";
              }}
            />
          </label>
          <Menu>
            <MenuTrigger asChild>
              <IconButton
                disabled={clips.length === 0 || isExporting}
                title={
                  isExporting
                    ? `${Math.round(exportProgress * 100)}%`
                    : "Exportar"
                }
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
              </IconButton>
            </MenuTrigger>
            <MenuContent align="end" className="w-64">
              <MenuLabel>Baixar um clipe</MenuLabel>
              <MenuSeparator />
              {clips.map((clip, index) => (
                <MenuItem
                  key={clip.id}
                  icon={<Download />}
                  onSelect={() => onDownloadClip(clip)}
                >
                  #{index + 1} {clip.name}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem icon={<Layers />} onSelect={() => onMergeAndDownload()}>
                {clips.length <= 1
                  ? "Baixar clipe único"
                  : "Mesclar e baixar todos"}
              </MenuItem>
            </MenuContent>
          </Menu>
          <IconButton
            title={
              clips.length <= 1
                ? "Adicione pelo menos 2 clipes para mesclar"
                : isMergingToTimeline
                  ? `Mesclando clipes (${Math.round(exportProgress * 100)}%)...`
                  : "Mesclar todos os clipes na timeline"
            }
            disabled={clips.length <= 1 || isExporting || isMergingToTimeline}
            onClick={onMergeClipsToTimeline}
          >
            {isMergingToTimeline ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-fg-muted hover:text-fg" />
            )}
          </IconButton>
          <IconButton
            title="Limpar clipes"
            danger
            disabled={clips.length === 0 && !selectedClipId}
            onClick={onClearClips}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </IconButton>
          {clips.length > 0 && (
            <div
              className="flex items-center gap-1.5 text-xs text-fg-muted font-mono"
              title="Duração Total"
            >
              <Clock className="w-3.5 h-3.5 text-fg-muted" />
              <span>
                {formatDuration(clips.reduce((acc, c) => acc + c.duration, 0))}
              </span>
            </div>
          )}
        </div>
      </div>

      {clips.length === 0 ? (
        <div className="border border-dashed border-line/60 rounded-xl py-12 flex flex-col items-center justify-center text-fg-muted">
          <p className="text-sm">Nenhum clipe gravado ou importado ainda.</p>
          <p className="text-xs text-fg-subtle mt-1.5">
            Inicie a gravação ou clique em <strong>"Importar Vídeo"</strong>{" "}
            para começar.
          </p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          <AnimatePresence initial={false}>
            {clips.map((clip, index) => {
              const isSelected = selectedClipId === clip.id;
              const isEditing = editingClipId === clip.id;

              return (
                <motion.div
                  key={clip.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`flex-none w-56 rounded-xl border p-3 flex flex-col justify-between cursor-pointer transition-all ${
                    isSelected
                      ? "bg-muted/80 border-line-strong/80 shadow-lg shadow-xs"
                      : "bg-app/40 border-line hover:border-line-strong hover:bg-app/60"
                  }`}
                  onClick={() => {
                    if (isSelected) {
                      onSelectClip(null);
                    } else {
                      onSelectClip(clip);
                    }
                  }}
                >
                  {/* Thumbnail / Clip Visual Card */}
                  <div className="relative aspect-video rounded-lg bg-surface flex items-center justify-center border border-line overflow-hidden group">
                    {clip.thumbnailUrl ? (
                      <img
                        src={clip.thumbnailUrl}
                        alt={clip.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    {/* Dark gradient overlay for readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-app/60 via-transparent to-app/25 opacity-100 group-hover:opacity-75 transition-opacity" />

                    <span className="absolute top-2 left-2 bg-app/80 text-fg-secondary text-meta font-mono px-1.5 py-0.5 rounded z-10">
                      #{index + 1}
                    </span>
                    <span className="absolute bottom-2 right-2 bg-app/80 text-fg-muted text-meta font-mono px-1.5 py-0.5 rounded z-10">
                      {formatDuration(clip.duration)}
                    </span>

                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div className="w-9 h-9 rounded-full bg-app/80 group-hover:bg-inverse/95 flex items-center justify-center text-fg border border-zinc-850 group-hover:border-line-strong shadow-md transform group-hover:scale-110 transition-all duration-300">
                        <Play className="w-3.5 h-3.5 fill-current text-fg translate-x-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Title and actions */}
                  <div className="mt-3">
                    {isEditing ? (
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          className="w-full bg-surface text-xs text-fg border border-line-strong px-2 py-1 rounded outline-none focus:border-line-strong"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (tempName.trim())
                                onRenameClip(clip.id, tempName.trim());
                              setEditingClipId(null);
                            }
                          }}
                        />
                        <button
                          onClick={(e) => handleSaveRename(clip.id, e)}
                          className="p-1 bg-muted hover:bg-inverse/30 text-fg-muted rounded transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-medium text-fg-default truncate flex-grow">
                          {clip.name}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={(e) => handleStartRename(clip, e)}
                            className="text-fg-muted hover:text-fg-secondary p-0.5 rounded transition-colors cursor-pointer"
                            title="Renomear"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div
                      className="flex items-center justify-between mt-3 pt-2 border-t border-line/60"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onReorderClips(index, index - 1)}
                          disabled={index === 0}
                          className="text-fg-muted hover:text-fg-secondary hover:bg-muted p-1 rounded disabled:opacity-30 disabled:pointer-events-none transition-all"
                          title="Mover para esquerda"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onReorderClips(index, index + 1)}
                          disabled={index === clips.length - 1}
                          className="text-fg-muted hover:text-fg-secondary hover:bg-muted p-1 rounded disabled:opacity-30 disabled:pointer-events-none transition-all"
                          title="Mover para direita"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {confirmingDeleteId === clip.id ? (
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-meta text-fg-muted font-medium">
                            Excluir?
                          </span>
                          <button
                            onClick={() => {
                              onRemoveClip(clip.id);
                              setConfirmingDeleteId(null);
                            }}
                            className="bg-inverse text-on-inverse text-meta px-2 py-0.5 rounded-md font-semibold hover:bg-inverse transition-colors cursor-pointer"
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setConfirmingDeleteId(null)}
                            className="bg-muted text-fg-secondary text-meta px-1.5 py-0.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {onOpenYouTubeUpload && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenYouTubeUpload(clip);
                              }}
                              className="text-fg-muted hover:text-red-500 hover:bg-muted p-1 rounded transition-all cursor-pointer"
                              title="Upload para o YouTube"
                            >
                              <Youtube className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}
                          {onMergeClipsToTimeline && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMergeClipsToTimeline();
                              }}
                              disabled={clips.length <= 1 || isMergingToTimeline}
                              className="text-fg-muted hover:text-fg hover:bg-muted p-1 rounded disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                              title="Mesclar todos os clipes na timeline"
                            >
                              {isMergingToTimeline ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Layers className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmingDeleteId(clip.id);
                            }}
                            className="text-fg-muted/70 hover:text-fg-muted hover:bg-muted p-1 rounded transition-all cursor-pointer"
                            title="Remover clipe"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
