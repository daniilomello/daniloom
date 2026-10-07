import { useState, useEffect, useRef } from "react";
import { Clip } from "../../../types";
import {
  uploadVideoToYouTube,
  uploadThumbnailToYouTube,
} from "../../../utils/youtube";
import { googleSignInForYouTube, getYouTubeAccessToken, auth } from "../../../firebase";
import { showToast } from "../../../utils/toast";
import { playActionCompleteSound } from "../../../utils/soundEffects";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Label,
  Badge,
} from "../../../components/ui";
import {
  Youtube,
  CheckCircle,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Film,
  Lock,
  Globe,
  EyeOff,
  RotateCcw,
  Sparkles,
  Calendar,
  Image as ImageIcon,
  Upload,
  X,
  Clock,
} from "lucide-react";

interface YouTubeUploadModalProps {
  open: boolean;
  onClose: () => void;
  clip: Clip | null;
}

const getDefaultScheduleDateTime = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

const getMinDateTime = () => {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

export const YouTubeUploadModal = ({
  open,
  onClose,
  clip,
}: YouTubeUploadModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacyStatus, setPrivacyStatus] = useState<
    "unlisted" | "public" | "private"
  >("unlisted");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState(
    getDefaultScheduleDateTime
  );
  const [uploadedScheduledDate, setUploadedScheduledDate] = useState<
    string | null
  >(null);

  // Custom thumbnail state
  const [customThumbnailFile, setCustomThumbnailFile] = useState<File | null>(
    null
  );
  const [customThumbnailPreviewUrl, setCustomThumbnailPreviewUrl] = useState<
    string | null
  >(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const [uploadStage, setUploadStage] = useState<"video" | "thumbnail" | null>(
    null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedVideo, setUploadedVideo] = useState<{
    id: string;
    url: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Gemini state (Exclusivo para oi@daniilo.dev)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(
    auth.currentUser?.email || null
  );
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUserEmail(user?.email || null);
    });
    return () => unsubscribe();
  }, []);

  const isGeminiAuthorized =
    currentUserEmail?.trim().toLowerCase() === "oi@daniilo.dev";

  // Pre-fill form when clip changes or modal opens
  useEffect(() => {
    if (open && clip) {
      setTitle(clip.name || "Vídeo");
      setDescription(
        "Vídeo produzido e compartilhado através do DaniLoom.",
      );
      setPrivacyStatus("unlisted");
      setIsScheduled(false);
      setScheduledDateTime(getDefaultScheduleDateTime());
      setUploadedScheduledDate(null);
      setUploadedVideo(null);
      setError(null);
      setUploadProgress(0);
      setUploadStage(null);
      setIsUploading(false);
      setCopied(false);

      // Reset custom thumbnail
      setCustomThumbnailFile(null);
      if (customThumbnailPreviewUrl) {
        URL.revokeObjectURL(customThumbnailPreviewUrl);
        setCustomThumbnailPreviewUrl(null);
      }
      if (thumbnailInputRef.current) {
        thumbnailInputRef.current.value = "";
      }

      // Check current token
      getYouTubeAccessToken().then((token) => {
        setHasToken(!!token);
      });
    }
  }, [open, clip]);

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Por favor, selecione um arquivo de imagem válido (PNG, JPG ou WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("A imagem de capa deve ter no máximo 2MB (limite da API do YouTube).");
      return;
    }
    setError(null);
    setCustomThumbnailFile(file);
    if (customThumbnailPreviewUrl) {
      URL.revokeObjectURL(customThumbnailPreviewUrl);
    }
    setCustomThumbnailPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveCustomThumbnail = () => {
    setCustomThumbnailFile(null);
    if (customThumbnailPreviewUrl) {
      URL.revokeObjectURL(customThumbnailPreviewUrl);
      setCustomThumbnailPreviewUrl(null);
    }
    if (thumbnailInputRef.current) {
      thumbnailInputRef.current.value = "";
    }
  };

  const handleGenerateWithGemini = async () => {
    if (!clip || !isGeminiAuthorized) return;
    setIsGeneratingAI(true);
    setError(null);
    try {
      const res = await fetch("/api/gemini/generate-youtube-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: currentUserEmail,
          clipName: clip.name,
          duration: clip.duration,
          format: clip.format,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || "Falha ao gerar título e descrição com o Gemini."
        );
      }

      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      showToast("Título e descrição gerados com sucesso via Gemini!", "success");
      playActionCompleteSound();
    } catch (err: any) {
      console.error("Gemini YouTube generator error:", err);
      setError(err.message || "Erro ao conectar com a IA do Gemini.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleConnectYouTube = async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const res = await googleSignInForYouTube();
      if (res?.accessToken) {
        setHasToken(true);
        showToast("Conta do YouTube conectada com sucesso!", "success");
      }
    } catch (err: any) {
      console.error("YouTube auth error:", err);
      setError("Erro ao autorizar YouTube: " + (err.message || "Tente novamente"));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleUpload = async () => {
    if (!clip) return;
    if (!title.trim()) {
      setError("Por favor, digite um título para o vídeo.");
      return;
    }

    if (isScheduled) {
      const scheduleTime = new Date(scheduledDateTime).getTime();
      if (isNaN(scheduleTime) || scheduleTime <= Date.now()) {
        setError("Por favor, selecione uma data e horário futuro para agendar o vídeo.");
        return;
      }
    }

    setError(null);
    setIsUploading(true);
    setUploadStage("video");
    setUploadProgress(0);

    try {
      // 1. Get YouTube token or request authorization
      let token = await getYouTubeAccessToken();
      if (!token) {
        setIsAuthenticating(true);
        const res = await googleSignInForYouTube();
        setIsAuthenticating(false);
        if (!res?.accessToken) {
          throw new Error("Autorização com o YouTube não foi concluída.");
        }
        token = res.accessToken;
        setHasToken(true);
      }

      // 2. Prepare blob
      let blob = clip.blob;
      if (!blob && clip.url) {
        const response = await fetch(clip.url);
        blob = await response.blob();
      }
      if (!blob) {
        throw new Error("Arquivo de vídeo não encontrado para upload.");
      }

      const publishAtISO = isScheduled
        ? new Date(scheduledDateTime).toISOString()
        : undefined;

      // 3. Upload to YouTube API
      const result = await uploadVideoToYouTube({
        title: title.trim(),
        description: description.trim(),
        privacyStatus,
        publishAt: publishAtISO,
        blob,
        accessToken: token,
        onProgress: (progress) => {
          setUploadProgress(Math.round(progress * 100));
        },
      });

      // 4. Se houver capa personalizada selecionada, envia via API do YouTube
      if (customThumbnailFile) {
        setUploadStage("thumbnail");
        try {
          await uploadThumbnailToYouTube({
            videoId: result.id,
            thumbnailBlob: customThumbnailFile,
            accessToken: token,
          });
          showToast("Capa do vídeo enviada com sucesso!", "success");
        } catch (thumbErr: any) {
          console.warn("Aviso ao definir capa do vídeo:", thumbErr);
          showToast(
            "Vídeo enviado! Observação: Miniaturas personalizadas requerem verificação de telefone no YouTube Studio.",
            "warning",
          );
        }
      }

      setUploadedVideo(result);
      if (isScheduled) {
        setUploadedScheduledDate(scheduledDateTime);
      }
      showToast(
        isScheduled
          ? "Vídeo enviado e agendado com sucesso no YouTube!"
          : "Vídeo enviado com sucesso para o YouTube!",
        "success"
      );
      playActionCompleteSound();
    } catch (err: any) {
      console.error("Upload error:", err);
      let msg = err.message || "Falha ao enviar vídeo para o YouTube.";
      if (msg.includes("401") || msg.includes("UNAUTHENTICATED")) {
        msg = "Token expirado. Por favor, conecte sua conta Google/YouTube novamente.";
        setHasToken(false);
        localStorage.removeItem("youtube_access_token");
      }
      setError(msg);
    } finally {
      setIsUploading(false);
      setUploadStage(null);
    }
  };

  const handleCopyLink = async () => {
    if (!uploadedVideo) return;
    try {
      await navigator.clipboard.writeText(uploadedVideo.url);
      setCopied(true);
      showToast("Link do YouTube copiado para a área de transferência!", "success");
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      showToast("Não foi possível copiar o link automaticamente.", "error");
    }
  };

  const resetUpload = () => {
    setUploadedVideo(null);
    setError(null);
    setUploadProgress(0);
  };

  if (!clip) return null;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isUploading) onClose();
      }}
      size="editor"
    >
      <ModalHeader
        title="Upload para o YouTube"
        icon={<Youtube className="w-5 h-5 text-red-500 fill-current" />}
      />

      <ModalBody className="p-5 space-y-4">
        {/* Clip Summary Preview Card */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-line">
          <div className="relative w-20 aspect-video rounded-lg bg-surface flex items-center justify-center border border-line overflow-hidden shrink-0">
            {clip.thumbnailUrl ? (
              <img
                src={clip.thumbnailUrl}
                alt={clip.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Film className="w-5 h-5 text-fg-muted" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-fg truncate">
              {clip.name}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-meta text-fg-muted">
              <span>{formatDuration(clip.duration)}</span>
              {clip.blob?.size ? (
                <>
                  <span>•</span>
                  <span>{(clip.blob.size / (1024 * 1024)).toFixed(1)} MB</span>
                </>
              ) : null}
              {clip.format ? (
                <>
                  <span>•</span>
                  <Badge variant="label" className="capitalize">
                    {clip.format === "portrait" ? "Vertical (9:16)" : "Paisagem (16:9)"}
                  </Badge>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* SUCCESS VIEW: Link generated and ready */}
        {uploadedVideo ? (
          <div className="py-4 space-y-4 animate-fade-in">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-fg">
                Upload concluído com sucesso!
              </h3>
              <p className="text-xs text-fg-muted max-w-sm mx-auto">
                Seu vídeo foi enviado aos servidores do YouTube e já possui um link direto de acesso.
              </p>
            </div>

            {/* Generated Link Display */}
            <div className="space-y-1.5">
              <Label>Link do Vídeo no YouTube</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={uploadedVideo.url}
                  className="font-mono text-xs select-all bg-surface"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </Button>
                <a
                  href={uploadedVideo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                  title="Abrir no YouTube"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface/50 border border-line text-meta text-fg-muted space-y-1">
              <p>
                <strong>Nota do YouTube:</strong> Pode levar alguns instantes para o YouTube processar todas as resoluções de alta definição (HD/4K).
              </p>
              {uploadedScheduledDate ? (
                <p>
                  Status da publicação:{" "}
                  <span className="font-semibold text-fg">
                    Agendado para {new Date(uploadedScheduledDate).toLocaleString("pt-BR")}
                  </span>
                </p>
              ) : (
                <p>
                  Status de visibilidade selecionado:{" "}
                  <span className="font-semibold text-fg capitalize">
                    {privacyStatus === "unlisted"
                      ? "Não listado"
                      : privacyStatus === "public"
                        ? "Público"
                        : "Privado"}
                  </span>
                </p>
              )}
              {customThumbnailFile && (
                <p className="text-emerald-400 font-medium">
                  ✓ Capa personalizada enviada para o YouTube.
                </p>
              )}
            </div>
          </div>
        ) : (
          /* FORM VIEW */
          <div className="space-y-3.5">
            {/* Title field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="yt-title" className="mb-0">
                  Título do Vídeo <span className="text-red-400">*</span>
                </Label>
                {isGeminiAuthorized && (
                  <div className="relative group flex items-center">
                    <button
                      type="button"
                      onClick={handleGenerateWithGemini}
                      disabled={isUploading || isGeneratingAI}
                      title="Auto Preencher"
                      aria-label="Auto Preencher"
                      className="h-7 w-7 rounded-lg inline-flex items-center justify-center text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 cursor-pointer transition-colors disabled:opacity-40"
                    >
                      {isGeneratingAI ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </button>
                    <span className="pointer-events-none absolute -top-8 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/95 border border-line text-fg text-[11px] font-medium py-1 px-2 rounded-md shadow-lg whitespace-nowrap z-50">
                      Auto Preencher
                    </span>
                  </div>
                )}
              </div>
              <Input
                id="yt-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Minha Apresentação ou Gravação"
                disabled={isUploading}
                maxLength={100}
              />
            </div>

            {/* Description field */}
            <div>
              <Label htmlFor="yt-desc">Descrição</Label>
              <Textarea
                id="yt-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Adicione detalhes ou notas sobre este vídeo..."
                rows={3}
                disabled={isUploading}
                className="resize-none"
              />
            </div>

            {/* Capa do Vídeo (Thumbnail) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="mb-0">Capa do Vídeo (Thumbnail)</Label>
                {customThumbnailFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCustomThumbnail();
                    }}
                    disabled={isUploading}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Restaurar padrão</span>
                  </button>
                )}
              </div>

              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleThumbnailSelect}
                disabled={isUploading}
                className="hidden"
              />

              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!isUploading) thumbnailInputRef.current?.click();
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isUploading) {
                    e.preventDefault();
                    thumbnailInputRef.current?.click();
                  }
                }}
                className="group flex items-center gap-3 p-3 rounded-xl bg-surface/50 hover:bg-surface border border-line hover:border-red-500/40 transition-all cursor-pointer"
                title="Clique para escolher uma imagem de capa"
              >
                <div className="relative w-24 aspect-video rounded-lg bg-surface border border-line overflow-hidden shrink-0 flex items-center justify-center">
                  {customThumbnailPreviewUrl ? (
                    <img
                      src={customThumbnailPreviewUrl}
                      alt="Capa personalizada"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : clip.thumbnailUrl ? (
                    <img
                      src={clip.thumbnailUrl}
                      alt="Capa padrão do clipe"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-fg-muted" />
                  )}

                  {/* Hover icon overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Upload className="w-4 h-4 text-red-400" />
                  </div>

                  {customThumbnailFile && (
                    <div className="absolute top-1 right-1 bg-red-600/90 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded shadow">
                      Nova
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-fg group-hover:text-red-400 transition-colors truncate">
                      {customThumbnailFile
                        ? customThumbnailFile.name
                        : "Miniatura padrão do vídeo"}
                    </p>
                    <Upload className="w-3 h-3 text-fg-muted group-hover:text-red-400 transition-colors shrink-0" />
                  </div>
                  <p className="text-[11px] text-fg-muted">
                    PNG, JPG ou WebP (máx. 2MB). Recomendado: 1280×720 (16:9).
                  </p>
                </div>
              </div>
            </div>

            {/* Modo de Publicação e Visibilidade */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="mb-0">Modo de Publicação</Label>
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface border border-line text-xs">
                  <button
                    type="button"
                    onClick={() => setIsScheduled(false)}
                    disabled={isUploading}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs ${
                      !isScheduled
                        ? "bg-red-500/20 text-red-400 font-medium"
                        : "text-fg-muted hover:text-fg"
                    }`}
                  >
                    Publicar Agora
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsScheduled(true)}
                    disabled={isUploading}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs ${
                      isScheduled
                        ? "bg-red-500/20 text-red-400 font-medium"
                        : "text-fg-muted hover:text-fg"
                    }`}
                  >
                    Agendar
                  </button>
                </div>
              </div>

              {!isScheduled ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrivacyStatus("unlisted")}
                    disabled={isUploading}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      privacyStatus === "unlisted"
                        ? "border-red-500/80 bg-red-500/10 text-fg"
                        : "border-line bg-surface/40 hover:bg-surface text-fg-muted"
                    }`}
                  >
                    <EyeOff className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Não listado</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrivacyStatus("public")}
                    disabled={isUploading}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      privacyStatus === "public"
                        ? "border-red-500/80 bg-red-500/10 text-fg"
                        : "border-line bg-surface/40 hover:bg-surface text-fg-muted"
                    }`}
                  >
                    <Globe className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Público</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrivacyStatus("private")}
                    disabled={isUploading}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      privacyStatus === "private"
                        ? "border-red-500/80 bg-red-500/10 text-fg"
                        : "border-line bg-surface/40 hover:bg-surface text-fg-muted"
                    }`}
                  >
                    <Lock className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Privado</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-surface/60 border border-line space-y-2 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs font-medium text-fg">
                    <Clock className="w-3.5 h-3.5 text-red-400" />
                    <span>Data e Horário de Publicação (Estreia)</span>
                  </div>
                  <Input
                    type="datetime-local"
                    value={scheduledDateTime}
                    min={getMinDateTime()}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    disabled={isUploading}
                    className="bg-surface border-line text-xs"
                  />
                  <p className="text-[11px] text-fg-muted leading-relaxed">
                    O YouTube manterá este vídeo como <strong>privado</strong> até a data e horário definidos, quando será publicado automaticamente como <strong>público</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Account & Auth Status Info */}
            <div className="p-3 rounded-lg bg-surface/60 border border-line flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    hasToken ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
                <span className="text-fg-secondary">
                  {hasToken
                    ? "Canal do YouTube pronto para envio"
                    : "Autorização com Google / YouTube necessária"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleConnectYouTube}
                disabled={isUploading || isAuthenticating}
                className="text-xs h-7 text-red-400 hover:text-red-300"
              >
                {isAuthenticating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                )}
                {hasToken ? "Trocar conta" : "Conectar agora"}
              </Button>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="p-3.5 rounded-xl bg-surface border border-line space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-fg font-medium flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                    {uploadStage === "thumbnail"
                      ? "Enviando capa do vídeo..."
                      : "Enviando vídeo para o YouTube..."}
                  </span>
                  <span className="font-mono text-fg-muted font-semibold">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-red-600 transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-meta text-fg-subtle text-center">
                  Por favor, mantenha esta janela aberta até o término do envio.
                </p>
              </div>
            )}

            {/* Error Message Alert */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-400 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-300">Erro no Upload</p>
                  <p className="mt-0.5 text-meta text-red-300/80 leading-relaxed">
                    {error}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line">
        {uploadedVideo ? (
          <>
            <Button variant="ghost" size="sm" onClick={resetUpload}>
              Enviar Outro
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onClose}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Concluir
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpload}
              disabled={isUploading || !title.trim()}
              className="bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  <span>
                    {uploadStage === "thumbnail"
                      ? "Enviando Capa..."
                      : `Enviando (${uploadProgress}%)`}
                  </span>
                </>
              ) : (
                <span>{isScheduled ? "Agendar no YouTube" : "Fazer Upload"}</span>
              )}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
};
