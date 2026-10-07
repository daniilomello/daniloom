import { extractAudioFromBlob } from "../../../utils/audioExtractor";
import { Slider } from "../../../components/ui";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Bot, 
  ArrowLeft, 
  Sparkles, 
  Loader2, 
  Type, 
  Languages, 
  CheckCircle, 
  Check, 
  Copy, 
  FileText, 
  RotateCcw, 
  Play, 
  Pause, 
  Gauge, 
  BookOpen, 
  Pencil,
  AlertTriangle,
  FolderOpen,
  X,
  ExternalLink,
  Download,
  Home,
  ChevronRight,
  AudioLines
} from "lucide-react";
import { initAuth, googleSignIn, logout } from "../../../firebase";
import { getClipsFromDB, saveClipToDB } from "../../../utils/projectDB";
import { Clip, SubtitleItem } from "../../../types";
import { Layout } from "../../../components/Layout";
import { CustomPlayer } from "../../../components/CustomPlayer";
import { SubtitlesPanel } from "./SubtitlesPanel";
import { getAudioDSPPreferences, setEnhancedAudioMode } from "../../../utils/audioSettings";

export function DanscriptView() {
  const navigate = useNavigate();

  // Auth & Session States
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const isAdmin = () => user?.email === 'oi@daniilo.dev';

  // Target Clip State
  const [clip, setClip] = useState<Clip | null>(null);
  const [loadingClip, setLoadingClip] = useState(true);

  // Danscript Audio Enhancement State (overrides default setting)
  const [danscriptEnhanceAudio, setDanscriptEnhanceAudio] = useState<boolean>(() => {
    const stored = localStorage.getItem("danscript_override_enhance_audio");
    if (stored !== null) return stored === "true";
    return getAudioDSPPreferences().enhancedAudio;
  });

  const handleToggleDanscriptAudioEnhancement = () => {
    const next = !danscriptEnhanceAudio;
    setDanscriptEnhanceAudio(next);
    localStorage.setItem("danscript_override_enhance_audio", String(next));
    setEnhancedAudioMode(next);
    showToast(
      next
        ? "Melhoria de áudio Danscript ativada!"
        : "Áudio original mantido no Danscript.",
      "info"
    );
  };

  // Subtitles States
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [subtitleConfig, setSubtitleConfig] = useState({
    fontSizeScale: 1,
    position: 'bottom' as 'bottom' | 'top' | 'center',
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  });

  // AI Assistant Action States
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [isTranslatingSubtitles, setIsTranslatingSubtitles] = useState(false);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<string>("");
  const [showArticleModal, setShowArticleModal] = useState<boolean>(false);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  // YouTube Upload State (Admin only)
  const [isYouTubeUploading, setIsYouTubeUploading] = useState(false);
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState<string | null>(null);
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeDescription, setYoutubeDescription] = useState("");
  const [youtubePrivacy, setYoutubePrivacy] = useState<"unlisted" | "private" | "public">("unlisted");
  const [youtubeVideoBlob, setYoutubeVideoBlob] = useState<Blob | null>(null);

  // Teleprompter States
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [teleprompterEditing, setTeleprompterEditing] = useState(false);
  const [teleprompterText, setTeleprompterText] = useState<string>(() => {
    return localStorage.getItem("daniloom_teleprompter_text") || 
      "Escreva ou cole seu roteiro de gravação aqui.\n\nRegule a velocidade do texto usando o slider.\nAjuste o tamanho da fonte para uma leitura confortável.\nAtive a rolagem automática usando o botão Play.\n\nO teleprompter ajuda você a falar com confiança, mantendo os olhos alinhados à câmera para criar uma conexão natural com quem assiste!";
  });
  const [isTeleprompterPlaying, setIsTeleprompterPlaying] = useState(false);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(4);
  const [teleprompterFontSize, setTeleprompterFontSize] = useState(20);
  const [activeTeleprompterTab, setActiveTeleprompterTab] = useState<"speed" | "fontSize" | "none">("none");
  const teleprompterRef = useRef<HTMLDivElement | null>(null);
  const teleprompterScrollAccumulatorRef = useRef<number>(0);

  // Dialog & Notification States
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'error' | 'success' | 'info' } | null>(null);
  const [alertPromise, setAlertPromise] = useState<{ message: string, resolve: () => void } | null>(null);

  // Player Playback Tracking
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);

  // Player video element reference
  const playerRef = useRef<HTMLVideoElement>(null);

  // Transcript-Based Editing state
  const [cuts, setCuts] = useState<{ start: number; end: number; label?: string }[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Auto-save subtitles whenever they change
  useEffect(() => {
    if (clip && subtitles.length > 0) {
      localStorage.setItem(`subtitles_${clip.id}`, JSON.stringify(subtitles));
    }
  }, [subtitles, clip]);

  // Auto-save cuts whenever they change
  useEffect(() => {
    if (clip) {
      localStorage.setItem(`cuts_${clip.id}`, JSON.stringify(cuts));
    }
  }, [cuts, clip]);

  const handleSeek = (time: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime = time;
    }
  };

  const getMergedCutsForPlayer = () => {
    const rawCuts: { start: number; end: number }[] = [...cuts];
    
    subtitles.forEach(sub => {
      if (sub.deleted) {
        rawCuts.push({ start: sub.start, end: sub.end });
      } else if (sub.words && sub.words.length > 0) {
        sub.words.forEach(word => {
          if (word.deleted) {
            rawCuts.push({ start: word.start, end: word.end });
          }
        });
      }
    });

    if (rawCuts.length === 0) return [];

    // Sort by start time
    rawCuts.sort((a, b) => a.start - b.start);

    const merged: { start: number; end: number }[] = [rawCuts[0]];
    for (let i = 1; i < rawCuts.length; i++) {
      const last = merged[merged.length - 1];
      const curr = rawCuts[i];
      
      if (curr.start <= last.end + 0.05) {
        last.end = Math.max(last.end, curr.end);
      } else {
        merged.push(curr);
      }
    }

    return merged;
  };

  const handleExportWithCuts = async () => {
    if (!clip) return;
    
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      const uniqueMergedCuts = getMergedCutsForPlayer();

      const { mergeVideoClips } = await import("../../../utils/videoMerger");
      
      const exportedBlob = await mergeVideoClips(
        [clip],
        {
          format: "mp4",
          quality: "medium",
          aspectRatio: clip.format || "landscape",
          subtitles: subtitles.filter(s => !s.deleted),
          subtitleConfig,
          cuts: uniqueMergedCuts,
          enhanceAudio: danscriptEnhanceAudio
        },
        (progress) => {
          setExportProgress(progress);
        }
      );

      // Save to YouTube blob and trigger direct download
      setYoutubeVideoBlob(exportedBlob);
      
      const url = URL.createObjectURL(exportedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `editado_${clip.name.endsWith(".mp4") || clip.name.endsWith(".webm") ? clip.name.substring(0, clip.name.lastIndexOf('.')) : clip.name}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast("Vídeo exportado e baixado com sucesso!", "success");
    } catch (err: any) {
      console.error("Export error:", err);
      await askAlert("Erro ao exportar vídeo: " + err.message);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // 1. Check Authentication on Load
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, idToken) => {
        setUser(currentUser);
        setToken(idToken);
        setAuthChecking(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setAuthChecking(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Load the target clip to edit from IndexedDB
  useEffect(() => {
    async function loadClip() {
      try {
        const dbClips = await getClipsFromDB();
        // Look for the special active danscript clip
        let target = dbClips.find(c => c.id === "danscript_active_clip");
        
        // Fallback: if not found, just use the first clip in database or merged video if available
        if (!target && dbClips.length > 0) {
          const merged = dbClips.find(c => c.id === "merged");
          target = merged || dbClips[0];
          // Save it under danscript_active_clip for subsequent loads
          if (target) {
            await saveClipToDB({ ...target, id: "danscript_active_clip" });
          }
        }
        
        if (target) {
          setClip(target);
          // Try to recover subtitles from localStorage cache
          const cachedSubs = localStorage.getItem(`subtitles_${target.id}`);
          if (cachedSubs) {
            try {
              setSubtitles(JSON.parse(cachedSubs));
            } catch (e) {}
          }
          // Try to recover cuts from localStorage cache
          const cachedCuts = localStorage.getItem(`cuts_${target.id}`);
          if (cachedCuts) {
            try {
              setCuts(JSON.parse(cachedCuts));
            } catch (e) {}
          }
        }
      } catch (err) {
        console.error("Error loading clip for danscript:", err);
      } finally {
        setLoadingClip(false);
      }
    }
    loadClip();
  }, []);

  // Teleprompter scroll syncing
  useEffect(() => {
    if (showTeleprompter && !teleprompterEditing) {
      const timer = setTimeout(() => {
        if (teleprompterRef.current) {
          teleprompterRef.current.scrollTop = 0;
          teleprompterScrollAccumulatorRef.current = 0;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showTeleprompter, teleprompterEditing, teleprompterText]);

  // Teleprompter scrolling loop
  useEffect(() => {
    if (!isTeleprompterPlaying) return;

    if (teleprompterRef.current) {
      let active = true;
      const scrollStep = () => {
        if (!active || !teleprompterRef.current) return;
        
        // Speed scaling
        const speedMultiplier = teleprompterSpeed * 0.15;
        teleprompterScrollAccumulatorRef.current += speedMultiplier;
        
        if (teleprompterScrollAccumulatorRef.current >= 1) {
          const pixelsToScroll = Math.floor(teleprompterScrollAccumulatorRef.current);
          teleprompterRef.current.scrollTop += pixelsToScroll;
          teleprompterScrollAccumulatorRef.current -= pixelsToScroll;
        }
        
        // Reset if reached bottom
        const isAtBottom = teleprompterRef.current.scrollHeight - teleprompterRef.current.scrollTop <= teleprompterRef.current.clientHeight + 5;
        if (isAtBottom) {
          setIsTeleprompterPlaying(false);
        } else {
          requestAnimationFrame(scrollStep);
        }
      };
      
      requestAnimationFrame(scrollStep);
      return () => {
        active = false;
      };
    }
  }, [isTeleprompterPlaying, teleprompterSpeed]);

  // Notification Helpers
  const showToast = (text: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const askAlert = (message: string): Promise<void> => {
    return new Promise((resolve) => {
      setAlertPromise({
        message,
        resolve: () => {
          setAlertPromise(null);
          resolve();
        }
      });
    });
  };

  // Auth handlers
  const handleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      await googleSignIn();
      showToast("Conectado com sucesso!", "success");
    } catch (err: any) {
      console.error(err);
      await askAlert("Falha ao fazer login: " + err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      window.location.href = "/";
    } catch (err: any) {
      console.error(err);
      await askAlert("Falha ao desconectar: " + err.message);
    }
  };

  // Safe clipboard copying helper
  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn("Clipboard API write failed, trying fallback:", err);
      }
    }
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.opacity = "0";
      textArea.style.pointerEvents = "none";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return !!successful;
    } catch (err) {
      console.error("Fallback copy failed:", err);
      return false;
    }
  };

  const handleCopyToClipboard = async (text: string, key: string) => {
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedStates((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [key]: false }));
      }, 2000);
      showToast("Texto copiado para a área de transferência!", "success");
    } else {
      showToast("Não foi possível copiar automaticamente.", "error");
    }
  };

  // Teleprompter text saver
  const handleTeleprompterTextChange = (text: string) => {
    setTeleprompterText(text);
    localStorage.setItem("daniloom_teleprompter_text", text);
  };

  // AI Generation Functions
  const handleGenerateSubtitles = async (translate = false) => {
    if (!clip) {
      await askAlert("Nenhum vídeo disponível para transcrever.");
      return;
    }

    const cacheKey = translate 
      ? `subtitles_translated_${clip.id}` 
      : `subtitles_${clip.id}`;
      
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setSubtitles(parsed);
        showToast(translate ? "Transcrição traduzida recuperada do cache!" : "Transcrição recuperada do cache!", "success");
        return;
      } catch (e) {}
    }

    if (translate) {
      setIsTranslatingSubtitles(true);
    } else {
      setIsGeneratingSubtitles(true);
    }

    try {
      const audioBlob = await extractAudioFromBlob(clip.blob);
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.wav");
      if (translate) {
        formData.append("translate", "true");
      }
      
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      });
      
      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error(`Servidor retornou resposta inválida (${res.status}): ${rawText.replace(/<[^>]*>?/gm, '').trim().slice(0, 150)}`);
      }

      if (!res.ok) {
         throw new Error(data?.error || "Falha ao gerar transcrição");
      }
      
      const parsedSubs = (data.subtitles || []).map((s: any) => ({
         start: s.start,
         end: s.end,
         text: s.text
      }));
      
      setSubtitles(parsedSubs);
      setCuts([]);
      localStorage.setItem(cacheKey, JSON.stringify(parsedSubs));
      showToast(translate ? "Legendas traduzidas geradas com sucesso!" : "Legendas geradas com sucesso!", "success");
    } catch (err: any) {
      console.error(err);
      askAlert("Erro ao gerar transcrição: " + err.message);
    } finally {
      if (translate) {
        setIsTranslatingSubtitles(false);
      } else {
        setIsGeneratingSubtitles(false);
      }
    }
  };

  const handleGenerateArticle = async () => {
    if (subtitles.length === 0) {
      showToast("Gere a transcrição do vídeo primeiro para criar o artigo.", "info");
      return;
    }

    setIsGeneratingArticle(true);
    try {
      const res = await fetch("/api/generate-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subtitles }),
      });

      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error(`Servidor retornou resposta inválida (${res.status}): ${rawText.replace(/<[^>]*>?/gm, '').trim().slice(0, 150)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao gerar artigo");
      }

      setGeneratedArticle(data.article);
      setShowArticleModal(true);
      
      const copied = await copyTextToClipboard(data.article);
      if (copied) {
        showToast("Artigo gerado e copiado para a área de transferência!", "success");
      } else {
        showToast("Artigo gerado! Use o botão para visualizar/copiar.", "success");
      }
    } catch (err: any) {
      console.error(err);
      askAlert("Erro ao gerar artigo: " + err.message);
    } finally {
      setIsGeneratingArticle(false);
    }
  };

  const handleGenerateChecklist = async () => {
    if (subtitles.length === 0) {
      showToast("Gere a transcrição do vídeo primeiro para criar o checklist.", "info");
      return;
    }

    setIsGeneratingChecklist(true);
    try {
      const res = await fetch("/api/generate-checklist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subtitles }),
      });

      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error(`Servidor retornou resposta inválida (${res.status}): ${rawText.replace(/<[^>]*>?/gm, '').trim().slice(0, 150)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao gerar checklist");
      }

      const copied = await copyTextToClipboard(data.checklist);
      if (copied) {
        showToast("Checklist copiado para a área de transferência!", "success");
      } else {
        showToast("Checklist gerado! Por favor, use o botão para copiar.", "success");
      }
    } catch (err: any) {
      console.error(err);
      askAlert("Erro ao gerar checklist: " + err.message);
    } finally {
      setIsGeneratingChecklist(false);
    }
  };

  // Helper: Create multipart/related request body with raw binary data
  const createMultipartBody = (metadata: any, fileBlob: Blob, boundary: string): Blob => {
    const delimiter = `--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const isVideo = metadata.mimeType && metadata.mimeType.startsWith("video/");
    const blobType = isVideo ? "video/webm" : (fileBlob.type || 'application/octet-stream');

    const headerPart = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      '\r\n' +
      delimiter +
      `Content-Type: ${blobType}\r\n\r\n`;

    return new Blob([headerPart, fileBlob, closeDelimiter], {
      type: `multipart/related; boundary=${boundary}`
    });
  };

  // Helper: Ensure we have an active authorization token (or prompt for one silently)
  const ensureToken = async (): Promise<string | null> => {
    if (token) return token;
    try {
      setIsLoggingIn(true);
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        return result.accessToken;
      }
    } catch (err: any) {
      console.error(err);
      await askAlert("Para usar o YouTube, é necessário autorizar a sua conta: " + err.message);
    } finally {
      setIsLoggingIn(false);
    }
    return null;
  };

  // Action: Open YouTube upload modal with prefilled details (Admin only)
  const triggerYouTubeUpload = async () => {
    if (!isAdmin()) {
      await askAlert("Apenas usuários administradores podem fazer upload no YouTube.");
      return;
    }

    if (!clip) {
      await askAlert("Nenhum clipe disponível para fazer upload no YouTube.");
      return;
    }

    setYoutubeVideoBlob(clip.blob);
    setYoutubeTitle(clip.name || "vídeo");
    setYoutubeDescription("Vídeo produzido e enviado através do daniloom - Gravador de tela e webcam inteligente.");
    setYoutubePrivacy("unlisted");
    setYoutubeVideoUrl(null);
    setShowYouTubeModal(true);
  };

  // Action: Execute client-side YouTube Data API v3 Upload
  const handleUploadToYouTube = async () => {
    if (!youtubeVideoBlob) return;

    const activeToken = await ensureToken();
    if (!activeToken) {
      return;
    }

    setIsYouTubeUploading(true);
    try {
      const metadata = {
        snippet: {
          title: youtubeTitle.trim() || "Vídeo daniloom",
          description: youtubeDescription.trim(),
          categoryId: "22", // People & Blogs
        },
        status: {
          privacyStatus: youtubePrivacy,
        },
      };

      const boundary = "314159265358979323846";
      const multipartBody = createMultipartBody({ ...metadata, mimeType: "video/webm" }, youtubeVideoBlob, boundary);

      const uploadRes = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error("Erro da API do YouTube (certifique-se de que a YouTube Data API v3 está ativada no seu console Google Cloud): " + errText);
      }

      const uploadData = await uploadRes.json();
      const videoId = uploadData.id;
      const videoLink = `https://youtu.be/${videoId}`;
      setYoutubeVideoUrl(videoLink);
      
      showToast("Vídeo enviado com sucesso para o YouTube!", "success");
    } catch (err: any) {
      console.error(err);
      await askAlert("Falha ao enviar vídeo para o YouTube: " + err.message);
    } finally {
      setIsYouTubeUploading(false);
    }
  };

  // Rendering loading state during authorization check
  if (authChecking || (user && loadingClip)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-100">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
        <span className="text-sm text-slate-400 font-medium">Validando credenciais do workspace...</span>
      </div>
    );
  }

  // Enforce Admin Mode: "Ela deve manter as regras de usuário apenas para administrador."
  if (!user || !isAdmin()) {
    return (
      <Layout
        user={user}
        authChecking={authChecking}
        isLoggingIn={isLoggingIn}
        isUserMenuOpen={isUserMenuOpen}
        onUserMenuToggle={() => setIsUserMenuOpen(!isUserMenuOpen)}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isAdmin={false}
        containerClassName="max-w-md mx-auto px-6 py-20"
      >
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col items-center text-center gap-6 shadow-2xl animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-display font-semibold text-slate-100">Acesso Restrito</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-xs">
              A página do **danscript** está disponível exclusivamente para administradores. Conecte com o e-mail de administrador para continuar.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full pt-2">
            {!user ? (
              <button
                onClick={handleSignIn}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold flex items-center justify-center gap-2.5 cursor-pointer shadow-md transition-all"
              >
                <span>Fazer Login como Administrador</span>
              </button>
            ) : (
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all border border-slate-700"
              >
                <span>Desconectar Conta Atual</span>
              </button>
            )}
            <Link 
              to="/" 
              className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-slate-400 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer border border-slate-900 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para Página Inicial</span>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // If user is Admin but no clip is selected or found
  if (!clip) {
    return (
      <Layout
        user={user}
        authChecking={authChecking}
        isLoggingIn={isLoggingIn}
        isUserMenuOpen={isUserMenuOpen}
        onUserMenuToggle={() => setIsUserMenuOpen(!isUserMenuOpen)}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isAdmin={isAdmin()}
        containerClassName="max-w-md mx-auto px-6 py-20"
      >
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col items-center text-center gap-6 shadow-2xl animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
            <FolderOpen className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-display font-semibold text-slate-100">Nenhum Clipe Encontrado</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-xs">
              Grave ou envie um clipe na página inicial antes de acessar o assistente de inteligência artificial danscript.
            </p>
          </div>

          <Link 
            to="/" 
            className="w-full mt-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-purple-600/10"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Gravação</span>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      user={user}
      authChecking={authChecking}
      isLoggingIn={isLoggingIn}
      isUserMenuOpen={isUserMenuOpen}
      onUserMenuToggle={() => setIsUserMenuOpen(!isUserMenuOpen)}
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
      isAdmin={isAdmin()}
      containerClassName="max-w-7xl mx-auto px-6 py-8"
    >
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6 font-medium">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-1 hover:text-slate-300 transition-colors cursor-pointer"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Início</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
        <span className="text-slate-300 font-semibold">Danscript</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT SIDE: Custom Player & Subtitles Editor */}
        <section className="lg:col-span-8 flex flex-col gap-6 transition-all duration-300">
          
          {/* Workspace Toolbar - Filtered down exactly per user requirements:
              "Ao estiver na rota de danscript, as opções de áudio, screenshot, transcrição, geração de link, focar em gravação e mostrar clipes não devem existir no menu do workspace."
              So we only show: Voltar button, Teleprompter toggle.
          */}
          <div className="flex items-center justify-between bg-slate-900/40 border border-slate-800/60 px-4 py-2.5 rounded-2xl gap-3 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="py-1.5 px-3 rounded-xl bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-100 transition-all text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar ao Gravador</span>
              </Link>
              <div className="w-px h-4 bg-slate-800"></div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">danscript workspace</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Audio Enhancement Quick Toggle (Danscript purple theme) */}
              <button
                onClick={handleToggleDanscriptAudioEnhancement}
                className={`p-2 rounded-xl transition-all cursor-pointer border relative group ${
                  danscriptEnhanceAudio 
                    ? "bg-purple-500/15 border-purple-500/40 text-purple-300" 
                    : "bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
                title="Aprimoramento de Áudio Danscript (AudioLines)"
              >
                <AudioLines className={`w-4 h-4 ${danscriptEnhanceAudio ? "text-purple-400" : "text-slate-400"}`} />
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-slate-800 text-slate-200 text-[10px] py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium font-sans">
                  Melhoria de Áudio Danscript
                </span>
              </button>

              {/* Export Video Button */}
              {subtitles.length > 0 && (
                <button
                  onClick={handleExportWithCuts}
                  disabled={isExporting}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/15 border border-purple-500/20"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Exportando: {Math.round(exportProgress * 100)}%</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Exportar Vídeo</span>
                    </>
                  )}
                </button>
              )}

              {/* Teleprompter Toggle */}
              <button
                onClick={() => setShowTeleprompter(!showTeleprompter)}
                className={`p-2 rounded-xl transition-all cursor-pointer border relative group ${
                  showTeleprompter 
                    ? "bg-rose-500/10 border-rose-500/40 text-rose-400" 
                    : "bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
                title="Roteiro e Notas (Teleprompter)"
              >
                <FileText className="w-4 h-4" />
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-slate-800 text-slate-200 text-[10px] py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium font-sans">
                  Teleprompter & Notes
                </span>
              </button>
            </div>
          </div>

          {/* Custom Player with playback and speed controls */}
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-slate-900 shadow-2xl">
            <CustomPlayer
              ref={playerRef}
              src={clip.url}
              downloadName={`danscript_${clip.name}`}
              onTimeUpdateCallback={(currentTime) => {
                setCurrentPlaybackTime(currentTime);
              }}
              cuts={getMergedCutsForPlayer()}
              isDanscript={true}
              theme="purple"
            />
          </div>

          {/* Subtitles Editing Panel */}
          <SubtitlesPanel 
            subtitles={subtitles} 
            setSubtitles={setSubtitles} 
            subtitleConfig={subtitleConfig} 
            setSubtitleConfig={setSubtitleConfig}
          />
        </section>

        {/* RIGHT SIDE: Teleprompter OR danscript AI Assistant Panel */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          {showTeleprompter ? (
            /* Teleprompter Panel */
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col min-h-[480px] lg:h-[calc(100vh-220px)] lg:max-h-[680px] justify-between shadow-2xl transition-all duration-300 relative overflow-hidden text-left">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                    <FileText className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-display font-semibold text-xs text-slate-100">Teleprompter</h4>
                    <p className="text-[9px] text-slate-500">Mantenha contato visual e organize roteiros</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setTeleprompterEditing(false); setIsTeleprompterPlaying(false); }}
                    className={`p-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                      !teleprompterEditing ? "text-rose-500 font-semibold scale-110" : "text-slate-500 hover:text-slate-300"
                    }`}
                    title="Modo Leitura"
                  >
                    <BookOpen className="w-4.5 h-4.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setTeleprompterEditing(true); setIsTeleprompterPlaying(false); }}
                    className={`p-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                      teleprompterEditing ? "text-rose-500 font-semibold scale-110" : "text-slate-500 hover:text-slate-300"
                    }`}
                    title="Editar Roteiro"
                  >
                    <Pencil className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              <div className="relative flex-grow flex flex-col min-h-[220px]">
                {teleprompterEditing ? (
                  <textarea
                    value={teleprompterText}
                    onChange={(e) => handleTeleprompterTextChange(e.target.value)}
                    className="w-full h-full flex-grow min-h-[220px] bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 focus:border-rose-500 outline-none resize-none font-sans leading-relaxed shadow-inner animate-fade-in"
                    placeholder="Escreva ou cole seu roteiro aqui..."
                  />
                ) : (
                  <div className="relative w-full h-full flex-grow min-h-[220px] bg-slate-950 rounded-2xl border border-slate-950/40 overflow-hidden flex flex-col animate-fade-in">
                    <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-slate-950 to-transparent pointer-events-none z-10" />
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none z-10" />
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-12 border-y border-rose-500/10 bg-rose-500/[0.015] pointer-events-none z-10" />

                    <div
                      ref={teleprompterRef}
                      className="w-full h-full min-h-[220px] overflow-y-auto px-4 scrollbar-none text-center select-none z-0 relative scroll-smooth"
                      style={{ scrollbarWidth: "none" }}
                    >
                      <div className="h-[96px] lg:h-[180px] flex-shrink-0" />
                      <div 
                        className="text-slate-200 font-medium whitespace-pre-wrap leading-relaxed tracking-wide transition-all duration-150"
                        style={{ fontSize: `${teleprompterFontSize}px` }}
                      >
                        {teleprompterText || "Nenhum texto inserido. Clique em 'Editar' para adicionar o roteiro!"}
                      </div>
                      <div className="h-[200px] lg:h-[350px] flex-shrink-0" />
                    </div>
                  </div>
                )}
              </div>

              {!teleprompterEditing && (
                <div className="mt-3 pt-2.5 border-t border-slate-850/60 space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (teleprompterRef.current) {
                          teleprompterRef.current.scrollTop = 0;
                        }
                        teleprompterScrollAccumulatorRef.current = 0;
                        setIsTeleprompterPlaying(false);
                      }}
                      className="w-11 h-11 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-md flex items-center justify-center"
                      title="Reiniciar Rolagem"
                    >
                      <RotateCcw className="w-4.5 h-4.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsTeleprompterPlaying(!isTeleprompterPlaying)}
                      className="w-11 h-11 rounded-full bg-rose-600 hover:bg-rose-500 border border-rose-500 text-white transition-all cursor-pointer shadow-md flex items-center justify-center"
                      title={isTeleprompterPlaying ? "Pausar" : "Iniciar"}
                    >
                      {isTeleprompterPlaying ? <Pause className="w-4.5 h-4.5 fill-current" /> : <Play className="w-4.5 h-4.5 fill-current" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTeleprompterTab(activeTeleprompterTab === "fontSize" ? "none" : "fontSize")}
                      className={`w-11 h-11 rounded-full border transition-all cursor-pointer shadow-md flex items-center justify-center ${
                        activeTeleprompterTab === "fontSize" ? "bg-rose-600 border-rose-500 text-white" : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white"
                      }`}
                      title="Tamanho da Fonte"
                    >
                      <Type className="w-4.5 h-4.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTeleprompterTab(activeTeleprompterTab === "speed" ? "none" : "speed")}
                      className={`w-11 h-11 rounded-full border transition-all cursor-pointer shadow-md flex items-center justify-center ${
                        activeTeleprompterTab === "speed" ? "bg-rose-600 border-rose-500 text-white" : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white"
                      }`}
                      title="Velocidade"
                    >
                      <Gauge className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  {activeTeleprompterTab === "speed" && (
                    <div className="pt-2.5 px-1 animate-fade-in space-y-1.5 text-left border-t border-slate-850/40">
                      <div className="flex justify-between text-[9px] font-mono text-slate-400">
                        <span>Velocidade</span>
                        <span className="text-rose-400 font-semibold">{teleprompterSpeed}x</span>
                      </div>
                      <Slider
                        min={1}
                        max={10}
                        step={0.5}
                        value={teleprompterSpeed}
                        onChange={setTeleprompterSpeed}
                        fillClassName="bg-rose-500/50"
                        thumbClassName="bg-rose-500 group-focus-within:ring-rose-500"
                        aria-label="Velocidade do teleprompter"
                      />
                    </div>
                  )}

                  {activeTeleprompterTab === "fontSize" && (
                    <div className="pt-2.5 px-1 animate-fade-in space-y-1.5 text-left border-t border-slate-850/40">
                      <div className="flex justify-between text-[9px] font-mono text-slate-400">
                        <span>Fonte</span>
                        <span className="text-rose-400 font-semibold">{teleprompterFontSize}px</span>
                      </div>
                      <Slider
                        min={14}
                        max={32}
                        step={1}
                        value={teleprompterFontSize}
                        onChange={setTeleprompterFontSize}
                        fillClassName="bg-rose-500/50"
                        thumbClassName="bg-rose-500 group-focus-within:ring-rose-500"
                        aria-label="Tamanho da fonte do teleprompter"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* AI Assistant Panel (Primary right sidebar on /danscript route) */
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col min-h-[480px] lg:h-[calc(100vh-220px)] lg:max-h-[680px] shadow-2xl transition-all duration-300 relative overflow-hidden text-left">
              {/* AI Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <Bot className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-display font-semibold text-xs text-slate-100 flex items-center gap-1.5">
                      danscript
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Gemini 3.5</span>
                    </h4>
                    <p className="text-[9px] text-slate-500">Transcrição com Gemini 3.5 Transcribe</p>
                  </div>
                </div>
              </div>

              {/* AI Content Actions */}
              <div className="flex flex-col gap-3 flex-grow overflow-y-auto custom-scrollbar pr-1">
                {/* Danscript Audio Enhancement Override Option */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-purple-500/30 hover:border-purple-500/60 transition-all flex flex-col gap-2.5 bg-purple-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AudioLines className="w-4 h-4 text-purple-400" />
                      <span className="font-semibold text-xs text-slate-100 font-sans">
                        Aprimoramento de Áudio Danscript
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleDanscriptAudioEnhancement}
                      className={`h-7 px-2.5 rounded-lg border text-[11px] font-mono tracking-tight transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                        danscriptEnhanceAudio
                          ? "bg-purple-500/20 border-purple-500/50 text-purple-300 font-bold"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <AudioLines className={`w-3.5 h-3.5 ${danscriptEnhanceAudio ? "text-purple-400" : "text-slate-400"}`} />
                      <span>{danscriptEnhanceAudio ? "Enhanced" : "Original"}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                    Filtro anti-rumor (&lt;85Hz), equalizador de voz e compressor DSP ativados especificamente para o Danscript.
                  </p>
                </div>

                <button
                  className="w-full py-3 px-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-left flex flex-col group cursor-pointer disabled:opacity-50"
                  onClick={() => handleGenerateSubtitles(false)}
                  disabled={isGeneratingSubtitles || isTranslatingSubtitles || isGeneratingArticle}
                >
                  <div className="flex items-center gap-2 text-purple-400 group-hover:text-purple-300">
                    {isGeneratingSubtitles ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Type className="w-5 h-5" />
                    )}
                    <span className="font-semibold text-sm font-sans">
                      {isGeneratingSubtitles ? "Gerando..." : subtitles.length > 0 ? "Regerar Transcrição" : "Gerar Transcrição"}
                    </span>
                  </div>
                </button>

                <button
                  className="w-full py-3 px-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-left flex flex-col group cursor-pointer disabled:opacity-50"
                  onClick={() => handleGenerateSubtitles(true)}
                  disabled={isGeneratingSubtitles || isTranslatingSubtitles || isGeneratingArticle}
                >
                  <div className="flex items-center gap-2 text-purple-400 group-hover:text-purple-300">
                    {isTranslatingSubtitles ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Languages className="w-5 h-5" />
                    )}
                    <span className="font-semibold text-sm font-sans">
                      {isTranslatingSubtitles ? "Traduzindo..." : "Gerar Transcrição Traduzida"}
                    </span>
                  </div>
                </button>

                {subtitles.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-3 animate-fade-in">
                    <button
                      className="w-full py-3 px-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left flex flex-col group cursor-pointer disabled:opacity-50"
                      onClick={handleGenerateArticle}
                      disabled={isGeneratingArticle || isGeneratingChecklist || isGeneratingSubtitles || isTranslatingSubtitles}
                    >
                      <div className="flex items-center gap-2 text-emerald-400 group-hover:text-emerald-300">
                        {isGeneratingArticle ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Sparkles className="w-5 h-5" />
                        )}
                        <span className="font-semibold text-sm font-sans">
                          {isGeneratingArticle ? "Gerando Artigo..." : generatedArticle ? "Regerar Artigo de Blog" : "Gerar Artigo de Blog"}
                        </span>
                      </div>
                    </button>

                    <button
                      className="w-full py-3 px-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left flex flex-col group cursor-pointer disabled:opacity-50"
                      onClick={handleGenerateChecklist}
                      disabled={isGeneratingChecklist || isGeneratingArticle || isGeneratingSubtitles || isTranslatingSubtitles}
                    >
                      <div className="flex items-center gap-2 text-blue-400 group-hover:text-blue-300">
                        {isGeneratingChecklist ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-5 h-5" />
                        )}
                        <span className="font-semibold text-sm font-sans">
                          {isGeneratingChecklist ? "Gerando Checklist..." : "Gerar Checklist"}
                        </span>
                      </div>
                    </button>

                    {generatedArticle && (
                      <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-3 flex flex-col gap-2.5 text-left animate-fade-in bg-emerald-500/5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold font-sans">✓ Artigo Gerado</span>
                            <span className="text-xs text-slate-300 font-sans">Pronto no modelo de blog</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setShowArticleModal(true)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1 cursor-pointer text-xs font-medium font-sans shadow-sm"
                              title="Visualizar Artigo Completo"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Ver</span>
                            </button>
                            <button
                              onClick={() => handleCopyToClipboard(generatedArticle, "articleCopied")}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:text-white hover:bg-slate-850 transition-all flex items-center gap-1 cursor-pointer text-xs shrink-0 font-sans"
                              title="Copiar Artigo"
                            >
                              {copiedStates["articleCopied"] ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {subtitles.length === 0 && (
                  <div className="mt-4 p-5 rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 text-center flex flex-col items-center justify-center gap-2 animate-fade-in">
                    <Sparkles className="w-5 h-5 text-slate-600 animate-pulse-slow" />
                    <p className="text-[11px] text-slate-500 max-w-[200px] leading-relaxed font-sans">
                      Gere a transcrição do vídeo primeiro para poder habilitar a criação de artigos de blog com IA.
                    </p>
                  </div>
                )}

                {/* YouTube Upload Section (Admin only) */}
                {isAdmin() && (
                  <div className="pt-2.5 border-t border-slate-800/80 flex flex-col gap-3">
                    <button
                      className="w-full py-3 px-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-red-500/50 hover:bg-red-500/5 transition-all text-left flex flex-col group cursor-pointer disabled:opacity-50"
                      onClick={triggerYouTubeUpload}
                      disabled={isYouTubeUploading}
                    >
                      <div className="flex items-center gap-2 text-red-500 group-hover:text-red-400">
                        {isYouTubeUploading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-red-500">
                            <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.516 0-9.387.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.387.508 9.387.508s7.517 0 9.388-.508a3.002 3.002 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                          </svg>
                        )}
                        <span className="font-semibold text-sm font-sans">
                          {isYouTubeUploading ? "Enviando..." : "Enviar Clipe ao YouTube"}
                        </span>
                      </div>
                    </button>

                    {youtubeVideoUrl && (
                      <div className="bg-slate-950 border border-red-500/20 rounded-2xl p-4 space-y-2 mt-2">
                        <span className="text-[10px] font-mono uppercase tracking-wide text-red-400 font-bold block">✓ Upload Concluído</span>
                        <p className="text-xs text-slate-300">Seu vídeo já está disponível no YouTube.</p>
                        
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleCopyToClipboard(youtubeVideoUrl, "youtubeShare")}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            {copiedStates["youtubeShare"] ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-red-400" />
                                <span className="text-red-400">Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copiar Link</span>
                              </>
                            )}
                          </button>
                          <a
                            href={youtubeVideoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                            title="Abrir no YouTube"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-col items-center justify-center gap-2 opacity-30 py-4">
                  <Sparkles className="w-5 h-5 text-slate-600" />
                  <span className="text-[10px] text-slate-600 font-medium font-sans">Inteligência Artificial Ativa</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Toast Notification HUD */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-[9999] p-4 rounded-2xl shadow-2xl border bg-slate-900/95 border-slate-800 text-slate-100 flex items-center gap-3 animate-slide-in backdrop-blur-md max-w-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium font-sans leading-relaxed">{toastMessage.text}</span>
        </div>
      )}

      {/* Custom Notification Dialog */}
      {/* YouTube Upload Modal (Admin only) */}
      {showYouTubeModal && isAdmin() && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-950/80">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-fade-in text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 font-display flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-red-500 text-red-500">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.516 0-9.387.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.387.508 9.387.508s7.517 0 9.388-.508a3.002 3.002 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <span>Enviar para o YouTube</span>
              </h3>
              <button
                onClick={() => setShowYouTubeModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 py-1 text-left">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Título do Vídeo</label>
                <input
                  type="text"
                  value={youtubeTitle}
                  onChange={(e) => setYoutubeTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 outline-none px-3 py-2 rounded-xl text-xs text-slate-200 font-sans"
                  placeholder="Digite o título do vídeo"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Descrição</label>
                <textarea
                  value={youtubeDescription}
                  onChange={(e) => setYoutubeDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 outline-none px-3 py-2 rounded-xl text-xs text-slate-200 font-sans resize-none"
                  placeholder="Digite a descrição do vídeo"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Privacidade</label>
                <select
                  value={youtubePrivacy}
                  onChange={(e) => setYoutubePrivacy(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 outline-none px-3 py-2 rounded-xl text-xs text-slate-200 font-sans cursor-pointer"
                >
                  <option value="unlisted">Não Listado (Apenas com link)</option>
                  <option value="private">Privado (Apenas você)</option>
                  <option value="public">Público (Todos podem ver)</option>
                </select>
              </div>

              {youtubeVideoUrl && (
                <div className="bg-red-950/10 border border-red-500/20 rounded-xl p-3 text-xs text-slate-300 flex flex-col gap-2">
                  <span className="font-semibold text-red-400">✓ Upload concluído com sucesso:</span>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      readOnly
                      value={youtubeVideoUrl}
                      className="flex-1 bg-slate-950 border border-slate-800 px-2 py-1.5 rounded-lg text-slate-400 select-all font-mono text-[10px]"
                    />
                    <a
                      href={youtubeVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                      title="Abrir no YouTube"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 shrink-0">
              <button
                onClick={() => setShowYouTubeModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold cursor-pointer transition-all border border-slate-750"
              >
                Fechar
              </button>
              <button
                onClick={handleUploadToYouTube}
                disabled={isYouTubeUploading || !youtubeVideoBlob}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                {isYouTubeUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <span>Iniciar Upload</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showArticleModal && generatedArticle && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-950/80">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] shadow-2xl flex flex-col gap-4 animate-fade-in text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-100 font-display">Artigo Gerado (Modelo de Blog)</h3>
              </div>
              <button
                onClick={() => setShowArticleModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 border border-slate-850 rounded-2xl p-4 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap select-all">
              {generatedArticle}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">Modelo em Português com Frontmatter (🇧🇷)</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowArticleModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-all border border-slate-700"
                >
                  Fechar
                </button>
                <button
                  onClick={() => handleCopyToClipboard(generatedArticle, "modalArticleCopied")}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-600/15"
                >
                  {copiedStates["modalArticleCopied"] ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Markdown</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {alertPromise && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-950/80 text-center">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 text-left">
            <h3 className="text-sm font-semibold text-slate-100 font-display">Notificação</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">{alertPromise.message}</p>
            <button
              onClick={alertPromise.resolve}
              className="mt-2 w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
