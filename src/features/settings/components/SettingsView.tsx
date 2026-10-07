import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Switch, Tooltip } from "@heroui/react";
import { Layout } from "../../../components/Layout";
import { PWAInstallButton } from "../../../components/PWAInstallButton";
import {
  PLATFORM_FEATURES,
  getFeatureFlagsState,
  saveFeatureFlagsState,
  FeatureFlag,
} from "../../../utils/featureFlags";
import {
  getWorkspaceIconsConfig,
  saveWorkspaceIconsConfig,
  resetWorkspaceIconsConfig,
  WorkspaceIconConfig,
} from "../../../utils/workspaceIcons";
import {
  showToast,
  getToastSoundSetting,
  setToastSoundSetting,
  getToastEnabledSetting,
  setToastEnabledSetting,
} from "../../../utils/toast";
import {
  getAudioDSPPreferences,
  saveAudioDSPPreferences,
  AudioDSPPreferences,
} from "../../../utils/audioSettings";
import {
  getRecordingResolutionSetting,
  setRecordingResolutionSetting,
  getRecordingQualityProfileSetting,
  setRecordingQualityProfileSetting,
  RecordingResolution,
  RecordingQualityProfile,
} from "../../../utils/qualitySettings";
import {
  Settings,
  Sliders,
  RotateCcw,
  ArrowLeft,
  Palette,
  Clapperboard,
  Mic,
  Download,
  LayoutGrid,
  Lock,
  AudioLines,
  Volume2,
  Gauge,
  Video,
  Sparkles,
  Info,
  Bell,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  VolumeX,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cloud,
  RefreshCw,
  Home,
  ChevronRight,
} from "lucide-react";
import { auth, googleSignIn, logout } from "../../../firebase";
import { onAuthStateChanged, User } from "firebase/auth";

export const SettingsView = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Tab selecionada ("layout" | "projeto" | "audio" | "exportacao" | "workspace" | "notifications" | "admin")
  const [activeTab, setActiveTab] = useState<
    "layout" | "projeto" | "audio" | "exportacao" | "workspace" | "notifications" | "admin"
  >("layout");

  // Feature Flags state
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>(getFeatureFlagsState);

  // Workspace Icons config state
  const [workspaceIcons, setWorkspaceIcons] = useState<WorkspaceIconConfig[]>(getWorkspaceIconsConfig);

  // Local Workspace Preferences
  const [recordingResolution, setRecordingResolution] = useState<RecordingResolution>(
    getRecordingResolutionSetting
  );
  const [recordingQualityProfile, setRecordingQualityProfile] = useState<RecordingQualityProfile>(
    getRecordingQualityProfileSetting
  );
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean>(
    () => localStorage.getItem("daniloom_sound_effects") !== "false"
  );
  const [performanceMode, setPerformanceMode] = useState<boolean>(
    () => localStorage.getItem("daniloom_performance_mode") === "true"
  );

  // Audio DSP Preferences (Disabled by default)
  const [audioDSP, setAudioDSP] = useState<AudioDSPPreferences>(getAudioDSPPreferences);

  const handleAudioDSPToggle = (key: keyof AudioDSPPreferences) => {
    const nextVal = !audioDSP[key];
    const updated = saveAudioDSPPreferences({ [key]: nextVal });
    setAudioDSP(updated);
    showToast(
      nextVal ? "Aprimoramento de áudio ativado." : "Aprimoramento de áudio desativado.",
      nextVal ? "success" : "info"
    );
  };

  // Notification Toast Settings
  const [toastEnabled, setToastEnabled] = useState<boolean>(getToastEnabledSetting);
  const [toastSoundEnabled, setToastSoundEnabled] = useState<boolean>(getToastSoundSetting);

  // Google Drive Auto-Sync State
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(
    () => localStorage.getItem("daniloom_auto_sync_enabled") !== "false"
  );
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(
    () => localStorage.getItem("daniloom_last_auto_sync_time")
  );

  useEffect(() => {
    const handleAutoSyncChange = () => {
      setAutoSyncEnabled(localStorage.getItem("daniloom_auto_sync_enabled") !== "false");
      setLastSyncTime(localStorage.getItem("daniloom_last_auto_sync_time"));
    };
    window.addEventListener("daniloom_auto_sync_changed", handleAutoSyncChange);
    return () => window.removeEventListener("daniloom_auto_sync_changed", handleAutoSyncChange);
  }, []);

  const handleAutoSyncToggle = () => {
    const nextVal = !autoSyncEnabled;
    setAutoSyncEnabled(nextVal);
    localStorage.setItem("daniloom_auto_sync_enabled", String(nextVal));
    window.dispatchEvent(new Event("daniloom_auto_sync_changed"));
    showToast(
      nextVal ? "Sincronização automática ativada (a cada 5 minutos)." : "Sincronização automática desativada.",
      nextVal ? "success" : "info"
    );
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = user?.email === "oi@daniilo.dev";

  // Feature flag handlers
  const handleToggleFeature = (featureId: string) => {
    const updated = {
      ...featureFlags,
      [featureId]: !featureFlags[featureId],
    };
    setFeatureFlags(updated);
    saveFeatureFlagsState(updated);
    showToast("Funcionalidade atualizada com sucesso.", "success");
  };

  const handleResetFlags = () => {
    const initial: Record<string, boolean> = {};
    PLATFORM_FEATURES.forEach((f) => {
      initial[f.id] = f.defaultEnabled;
    });
    setFeatureFlags(initial);
    saveFeatureFlagsState(initial);
    showToast("Funcionalidades restauradas aos padrões.", "info");
  };

  // Workspace Icon handlers
  const handleToggleIconVisibility = (id: string) => {
    const updated = workspaceIcons.map((item) =>
      item.id === id ? { ...item, visible: !item.visible } : item
    );
    setWorkspaceIcons(updated);
    saveWorkspaceIconsConfig(updated);
    showToast("Visibilidade de ícone alterada.", "info");
  };

  const handleMoveIcon = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= workspaceIcons.length) return;

    const newIcons = [...workspaceIcons];
    const temp = newIcons[index];
    newIcons[index] = newIcons[targetIndex];
    newIcons[targetIndex] = temp;

    // Recalcula ordens
    const updated = newIcons.map((item, idx) => ({ ...item, order: idx + 1 }));
    setWorkspaceIcons(updated);
    saveWorkspaceIconsConfig(updated);
    showToast("Ordem de ícones atualizada.", "success");
  };

  const handleResetIcons = () => {
    resetWorkspaceIconsConfig();
    setWorkspaceIcons(getWorkspaceIconsConfig());
    showToast("Ordem padrão de ícones restaurada.", "info");
  };

  // Preferences handlers
  const handleResolutionChange = (res: RecordingResolution) => {
    setRecordingResolution(res);
    setRecordingResolutionSetting(res);
    showToast(`Resolução padrão ajustada para ${res.toUpperCase()}.`, "success");
  };

  const handleQualityProfileChange = (profile: RecordingQualityProfile) => {
    setRecordingQualityProfile(profile);
    setRecordingQualityProfileSetting(profile);
    showToast(`Perfil de qualidade alterado para: ${profile === "otimizado" ? "Otimizado (Padrão)" : profile === "performance" ? "Performance" : "Qualidade Máxima"}`, "success");
  };

  const handleSoundToggle = () => {
    const next = !soundEffectsEnabled;
    setSoundEffectsEnabled(next);
    localStorage.setItem("daniloom_sound_effects", String(next));
    showToast(next ? "Efeitos sonoros ativados." : "Efeitos sonoros desativados.", next ? "success" : "warning");
  };

  const handlePerformanceToggle = () => {
    const next = !performanceMode;
    setPerformanceMode(next);
    localStorage.setItem("daniloom_performance_mode", String(next));
    showToast(next ? "Modo desempenho ativado." : "Modo desempenho desativado.", "info");
  };

  // Toast Notification handlers
  const handleToastEnabledToggle = () => {
    const next = !toastEnabled;
    setToastEnabled(next);
    setToastEnabledSetting(next);
    showToast(next ? "Notificações na tela ativadas." : "Notificações desativadas.", next ? "success" : "warning");
  };

  const handleToastSoundToggle = () => {
    const next = !toastSoundEnabled;
    setToastSoundEnabled(next);
    setToastSoundSetting(next);
    showToast(
      next ? "Alertas sonoros de notificação ativados." : "Alertas sonoros desativados.",
      next ? "success" : "warning"
    );
  };

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      await googleSignIn();
    } catch (err) {
      console.error("Erro no login Google:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      window.location.href = "/";
    } catch (err) {
      console.error("Erro ao sair:", err);
    }
  };

  // Categoria das Feature Flags
  const featureCategories: {
    key: FeatureFlag["category"];
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    isPrivate?: boolean;
  }[] = [
    {
      key: "layout",
      title: "Layout, Filtros e Fundos",
      description: "Controles visuais do palco, cores, fundos e formato da câmera.",
      icon: <Palette className="w-5 h-5" />,
      color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    },
    {
      key: "projeto",
      title: "Projeto e Cenas",
      description: "Linha do tempo, cortes, legendas automáticas e substituição de áudio.",
      icon: <Clapperboard className="w-5 h-5" />,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    },
    {
      key: "audio",
      title: "Áudio e Efeitos",
      description: "Níveis de VU Meter, auto-ducking, pulso na moldura e efeitos sonoros.",
      icon: <Mic className="w-5 h-5" />,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    },
    {
      key: "exportacao",
      title: "Exportação e Marca D'água",
      description: "Exportação rápida, presets de vídeo, logo e tratamento de áudio.",
      icon: <Download className="w-5 h-5" />,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    },
    {
      key: "workspace",
      title: "Workspace e Desempenho",
      description: "Modo desempenho, otimizações e configurações locais.",
      icon: <LayoutGrid className="w-5 h-5" />,
      color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    },
    ...(isAdmin
      ? [
          {
            key: "admin" as const,
            title: "Área do Administrador (Restrito)",
            description: "Gerenciamento global de projetos, estúdio Danscript e prompts de IA.",
            icon: <Lock className="w-5 h-5" />,
            color: "text-rose-500 bg-rose-500/20 border-rose-500/50",
            isPrivate: true,
          },
        ]
      : []),
  ];

  // Helper para renderizar flags de cada categoria
  const renderCategoryFlags = (categoryKey: FeatureFlag["category"]) => {
    const categoryFeatures = PLATFORM_FEATURES.filter(
      (f) => f.category === categoryKey && (!f.isPrivate || isAdmin)
    );

    if (categoryFeatures.length === 0) return null;

    return (
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            Controle de Exibição das Funcionalidades
          </span>
          <Button
            size="sm"
            variant="tertiary"
            onPress={handleResetFlags}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white text-[11px] font-semibold transition-all cursor-pointer h-auto min-h-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restaurar Padrões</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categoryFeatures.map((feature) => {
            const isEnabled = featureFlags[feature.id] !== false;

            return (
              <div
                key={feature.id}
                onClick={() => handleToggleFeature(feature.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  isEnabled
                    ? "bg-slate-950/90 border-slate-800 hover:border-slate-700 shadow-md"
                    : "bg-slate-950/40 border-slate-900 opacity-60 hover:opacity-80"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-semibold ${
                        isEnabled ? "text-slate-200" : "text-slate-500"
                      }`}
                    >
                      {feature.name}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                        feature.isBeta
                          ? isEnabled
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            : "bg-amber-500/5 text-amber-500/60 border border-amber-500/20"
                          : isEnabled
                            ? "bg-slate-800 text-slate-300 border border-slate-700"
                            : "bg-slate-800/80 text-slate-400 border border-slate-700/50"
                      }`}
                    >
                      {feature.isBeta ? "Beta" : "Em desenvolvimento"}
                    </span>
                    {feature.isPrivate && (
                      <span title="Exclusivo Admin">
                        <Lock className="w-3 h-3 text-rose-400" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                <div className="shrink-0 mt-0.5 pointer-events-none">
                  <Switch isSelected={isEnabled} size="sm">
                    <Switch.Control className={isEnabled ? "[--switch-control-bg-checked:var(--color-rose-600)]" : ""}>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Layout
      user={user}
      authChecking={authChecking}
      isLoggingIn={isLoggingIn}
      isUserMenuOpen={isUserMenuOpen}
      onUserMenuToggle={() => setIsUserMenuOpen(!isUserMenuOpen)}
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
      isAdmin={isAdmin}
    >
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-1 hover:text-slate-300 transition-colors cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Início</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
          <span className="text-slate-300 font-semibold">Configurações</span>
        </nav>
        {/* Banner Superior */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 relative z-10">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <Settings className="w-6 h-6" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Configurações da Plataforma
              </h1>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Gerencie o comportamento do workspace, altere a ordem dos ícones, ative/desative
              funcionalidades e configure alertas de notificação.
            </p>
          </div>

          {/* Fundo decorativo */}
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Navegação por TABS (Abas por Categoria) */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl overflow-x-auto scrollbar-none">
          <Button
            size="sm"
            variant={activeTab === "layout" ? "primary" : "tertiary"}
            onPress={() => setActiveTab("layout")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "layout"
                ? "bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Palette className="w-4 h-4 text-rose-400" />
            <span>Layout & Câmera</span>
          </Button>

          <Button
            size="sm"
            variant={activeTab === "projeto" ? "primary" : "tertiary"}
            onPress={() => setActiveTab("projeto")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "projeto"
                ? "bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Clapperboard className="w-4 h-4 text-blue-400" />
            <span>Projeto & Edição</span>
          </Button>

          <Button
            size="sm"
            variant={activeTab === "audio" ? "primary" : "tertiary"}
            onPress={() => setActiveTab("audio")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "audio"
                ? "bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Mic className="w-4 h-4 text-emerald-400" />
            <span>Áudio & Efeitos</span>
          </Button>

          <Button
            size="sm"
            variant={activeTab === "exportacao" ? "primary" : "tertiary"}
            onPress={() => setActiveTab("exportacao")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "exportacao"
                ? "bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Exportação & Marca</span>
          </Button>

          <Button
            size="sm"
            variant={activeTab === "workspace" ? "primary" : "tertiary"}
            onPress={() => setActiveTab("workspace")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "workspace"
                ? "bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <LayoutGrid className="w-4 h-4 text-purple-400" />
            <span>Workspace & Ícones</span>
          </Button>

          <Button
            size="sm"
            variant={activeTab === "notifications" ? "primary" : "tertiary"}
            onPress={() => setActiveTab("notifications")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "notifications"
                ? "bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Bell className="w-4 h-4 text-sky-400" />
            <span>Notificações</span>
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              variant={activeTab === "admin" ? "primary" : "tertiary"}
              onPress={() => setActiveTab("admin")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "admin"
                  ? "bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-md"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Lock className="w-4 h-4 text-rose-500" />
              <span>Admin</span>
            </Button>
          )}
        </div>


        {/* CONTEÚDO DA TAB: LAYOUT & CÂMERA */}
        {activeTab === "layout" && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl animate-fade-in">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-rose-400" />
                  Configurações de Layout, Câmera e Resolução
                </h2>
                <p className="text-xs text-slate-400">
                  Defina padrões visuais para o palco, molduras, fundos e resolução de gravação.
                </p>
              </div>
            </div>

            {/* Resolução Padrão */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-slate-300">
                  <Video className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-semibold">Resolução Padrão de Captura</span>
                </div>
                <p className="text-[10px] text-slate-500">Qualidade inicial aplicada às novas gravações (720p, 1080p, 4K real)</p>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {(["720p", "1080p", "4k"] as const).map((res) => (
                  <Button
                    key={res}
                    size="sm"
                    variant={recordingResolution === res ? "primary" : "tertiary"}
                    onPress={() => handleResolutionChange(res)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer h-auto min-h-0 ${
                      recordingResolution === res
                        ? "bg-rose-500/20 border border-rose-500/40 text-rose-300"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {res.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>

            {/* Perfil de Qualidade de Gravação */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-slate-300">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold">Perfil de Processamento e Taxa de Bits</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Escolha se prefere economia de recursos (Performance), taxa otimizada ou bitrate máximo para YouTube 4K sem perdas (Qualidade)
                </p>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {[
                  { id: "performance", label: "Performance", desc: "Bitrate leve" },
                  { id: "otimizado", label: "Otimizado", desc: "Equilíbrio padrão" },
                  { id: "qualidade", label: "Qualidade", desc: "Bitrate máximo (Até 45Mbps)" },
                ].map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={recordingQualityProfile === p.id ? "primary" : "tertiary"}
                    onPress={() => handleQualityProfileChange(p.id as RecordingQualityProfile)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer h-auto min-h-0 ${
                      recordingQualityProfile === p.id
                        ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Feature Flags de Layout */}
            {renderCategoryFlags("layout")}
          </div>
        )}

        {/* CONTEÚDO DA TAB: PROJETO & EDIÇÃO */}
        {activeTab === "projeto" && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl animate-fade-in">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clapperboard className="w-4 h-4 text-blue-400" />
                Recursos de Edição do Projeto
              </h2>
              <p className="text-xs text-slate-400">
                Controle a disponibilidade das ferramentas de corte, linha do tempo, legendas e sincronização automática com o Google Drive.
              </p>
            </div>

            {/* Card de Sincronização Automática com Google Drive */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-200">
                  <Cloud className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold">Sincronização Automática no Google Drive</span>
                  {autoSyncEnabled && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                      A cada 5 min
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Sincroniza automaticamente o projeto, gravações, clipes e configurações de 5 em 5 minutos após a primeira sincronização no Google Drive.
                </p>
                {lastSyncTime && (
                  <p className="text-[10px] text-slate-500 font-mono">
                    Última sincronização: {lastSyncTime}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 self-end md:self-center">
                <Switch isSelected={autoSyncEnabled} onChange={handleAutoSyncToggle} size="sm">
                  <Switch.Control className={autoSyncEnabled ? "[--switch-control-bg-checked:var(--color-emerald-600)]" : ""}>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            </div>

            {renderCategoryFlags("projeto")}
          </div>
        )}

        {/* CONTEÚDO DA TAB: ÁUDIO & EFEITOS */}
        {activeTab === "audio" && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl animate-fade-in">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  Preferências de Áudio e Efeitos Sonoros
                </h2>
                <p className="text-xs text-slate-400">
                  Ajuste sinais de áudio, medidores e recursos avançados de processamento de voz.
                </p>
              </div>
            </div>

            {/* Som de gravação */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-slate-300">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold">Sinais Sonoros de Início/Fim</span>
                </div>
                <p className="text-[10px] text-slate-500">Toca um sinal sonoro sintetizado ao clicar em Gravar ou Parar</p>
              </div>
              <Switch isSelected={soundEffectsEnabled} onChange={handleSoundToggle} size="sm">
                <Switch.Control className={soundEffectsEnabled ? "[--switch-control-bg-checked:var(--color-emerald-600)]" : ""}>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>


            {/* SEÇÃO DEDICADA DE PROCESSAMENTO E APRIMORAMENTO DE ÁUDIO (DSP) */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AudioLines className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                    Aprimoramento de Voz & Estúdio (On-Device DSP)
                  </span>
                </div>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-semibold">
                  Zero Custo de Servidor • Processamento Local
                </span>
              </div>

              {/* CARD PRINCIPAL HÍBRIDO: TOGGLE ÚNICO ORIGINAL VS ENHANCED */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900/90 to-slate-950 border border-emerald-500/30 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        Otimização de Voz Inteligente (Enhanced Voice)
                      </h3>
                      {audioDSP.enhancedAudio ? (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <AudioLines className="w-3 h-3 text-emerald-400" />
                          Enhanced (Aprimorado)
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                          Original (Sem Filtros)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                      Aplica otimização em segundo plano usando a arquitetura de áudio local: remoção de zumbidos, filtro anti-rumor (&lt;85Hz), equalizador de clareza vocal, de-esser e nivelamento de volume automático.
                    </p>
                  </div>

                  {/* SELETOR PILL SEGMENTADO: ORIGINAL VS ENHANCED */}
                  <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 self-start sm:self-auto gap-1">
                    <Button
                      size="sm"
                      variant={!audioDSP.enhancedAudio ? "primary" : "tertiary"}
                      onPress={() => handleAudioDSPToggle("enhancedAudio")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 h-auto min-h-0 ${
                        !audioDSP.enhancedAudio
                          ? "bg-slate-800 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Original
                    </Button>

                    <Button
                      size="sm"
                      variant={audioDSP.enhancedAudio ? "primary" : "tertiary"}
                      onPress={() => handleAudioDSPToggle("enhancedAudio")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 h-auto min-h-0 ${
                        audioDSP.enhancedAudio
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <AudioLines className="w-3.5 h-3.5" />
                      Enhanced
                    </Button>
                  </div>
                </div>

                {/* DETALHES DAS CONFIGURAÇÕES INTERNAS PRÉ-DEFINIDAS */}
                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-400">
                  <div className="flex items-center gap-1.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800/50">
                    <div className={`w-1.5 h-1.5 rounded-full ${audioDSP.enhancedAudio ? "bg-emerald-400" : "bg-slate-600"}`} />
                    <span>Filtro Anti-Rumor &lt;85Hz</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800/50">
                    <div className={`w-1.5 h-1.5 rounded-full ${audioDSP.enhancedAudio ? "bg-emerald-400" : "bg-slate-600"}`} />
                    <span>Notch 50/60/120Hz</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800/50">
                    <div className={`w-1.5 h-1.5 rounded-full ${audioDSP.enhancedAudio ? "bg-emerald-400" : "bg-slate-600"}`} />
                    <span>EQ Clareza (3.2kHz)</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800/50">
                    <div className={`w-1.5 h-1.5 rounded-full ${audioDSP.enhancedAudio ? "bg-emerald-400" : "bg-slate-600"}`} />
                    <span>Compressor & AGC</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Redução Ativa de Ruído & Noise Gate */}
                <div
                  onClick={() => handleAudioDSPToggle("noiseSuppression")}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    audioDSP.noiseSuppression
                      ? "bg-slate-950/90 border-emerald-500/40 shadow-md shadow-emerald-500/5"
                      : "bg-slate-950/40 border-slate-900 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">
                        Cancelamento de Ruído & Noise Gate
                      </span>
                      {audioDSP.noiseSuppression ? (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Ativo
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase bg-slate-800 text-slate-500">
                          Desativado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Filtra zumbidos elétricos (50/60Hz/120Hz) e atenua ruídos constantes de fundo (ar-condicionado, ventoinhas).
                    </p>
                  </div>
                  <div className="shrink-0 mt-0.5 pointer-events-none">
                    <Switch isSelected={audioDSP.noiseSuppression} size="sm">
                      <Switch.Control className={audioDSP.noiseSuppression ? "[--switch-control-bg-checked:var(--color-emerald-600)]" : ""}>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch>
                  </div>
                </div>

                {/* 2. Compressor & Ganho Automático (AGC) */}
                <div
                  onClick={() => handleAudioDSPToggle("autoGainControl")}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    audioDSP.autoGainControl
                      ? "bg-slate-950/90 border-emerald-500/40 shadow-md shadow-emerald-500/5"
                      : "bg-slate-950/40 border-slate-900 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">
                        Compressor Dinâmico (AGC / Nivelamento)
                      </span>
                      {audioDSP.autoGainControl ? (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Ativo
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase bg-slate-800 text-slate-500">
                          Desativado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Equilibra picos e partes sussurradas da voz para manter o volume vocal constante e legível.
                    </p>
                  </div>
                  <div className="shrink-0 mt-0.5 pointer-events-none">
                    <Switch isSelected={audioDSP.autoGainControl} size="sm">
                      <Switch.Control className={audioDSP.autoGainControl ? "[--switch-control-bg-checked:var(--color-emerald-600)]" : ""}>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch>
                  </div>
                </div>

                {/* 3. Filtro Passa-Alta Anti-Rumor */}
                <div
                  onClick={() => handleAudioDSPToggle("highPassFilter")}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    audioDSP.highPassFilter
                      ? "bg-slate-950/90 border-emerald-500/40 shadow-md shadow-emerald-500/5"
                      : "bg-slate-950/40 border-slate-900 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">
                        Filtro Passa-Alta Anti-Rumor (&lt; 85Hz)
                      </span>
                      {audioDSP.highPassFilter ? (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Ativo
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase bg-slate-800 text-slate-500">
                          Desativado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Corta frequências graves inaudíveis vindas de vibrações na mesa, impactos de digitação e pufes de vento.
                    </p>
                  </div>
                  <div className="shrink-0 mt-0.5 pointer-events-none">
                    <Switch isSelected={audioDSP.highPassFilter} size="sm">
                      <Switch.Control className={audioDSP.highPassFilter ? "[--switch-control-bg-checked:var(--color-emerald-600)]" : ""}>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch>
                  </div>
                </div>

                {/* 4. Normalização de Volume LUFS */}
                <div
                  onClick={() => handleAudioDSPToggle("audioNormalization")}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    audioDSP.audioNormalization
                      ? "bg-slate-950/90 border-emerald-500/40 shadow-md shadow-emerald-500/5"
                      : "bg-slate-950/40 border-slate-900 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">
                        Normalização Padrão de Exportação (-14 LUFS)
                      </span>
                      {audioDSP.audioNormalization ? (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Ativo
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase bg-slate-800 text-slate-500">
                          Desativado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Ajusta automaticamente a sonoridade do vídeo final para o padrão de transmissão de plataformas digitais.
                    </p>
                  </div>
                  <div className="shrink-0 mt-0.5 pointer-events-none">
                    <Switch isSelected={audioDSP.audioNormalization} size="sm">
                      <Switch.Control className={audioDSP.audioNormalization ? "[--switch-control-bg-checked:var(--color-emerald-600)]" : ""}>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch>
                  </div>
                </div>

                {/* 5. Auto-Ducking de Música de Fundo */}
                <div
                  onClick={() => handleAudioDSPToggle("autoDucking")}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    audioDSP.autoDucking
                      ? "bg-slate-950/90 border-emerald-500/40 shadow-md shadow-emerald-500/5"
                      : "bg-slate-950/40 border-slate-900 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">
                        Atenuação Automática de Trilhas (Auto-Ducking)
                      </span>
                      {audioDSP.autoDucking ? (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Ativo
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase bg-slate-800 text-slate-500">
                          Desativado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Abaixa suavemente a música de fundo durante a fala do apresentador e eleva a trilha nas pausas.
                    </p>
                  </div>
                  <div className="shrink-0 mt-0.5 pointer-events-none">
                    <Switch isSelected={audioDSP.autoDucking} size="sm">
                      <Switch.Control className={audioDSP.autoDucking ? "[--switch-control-bg-checked:var(--color-emerald-600)]" : ""}>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch>
                  </div>
                </div>
              </div>

            </div>

            {renderCategoryFlags("audio")}
          </div>
        )}

        {/* CONTEÚDO DA TAB: EXPORTAÇÃO & MARCA */}
        {activeTab === "exportacao" && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl animate-fade-in">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-amber-400" />
                Opções de Exportação e Sobreposições
              </h2>
              <p className="text-xs text-slate-400">
                Gerencie atalhos de renderização, presets e sobreposição de marca d'água.
              </p>
            </div>

            {renderCategoryFlags("exportacao")}
          </div>
        )}

        {/* CONTEÚDO DA TAB: WORKSPACE & ÍCONES */}
        {activeTab === "workspace" && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl animate-fade-in">
            <div className="border-b border-slate-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-purple-400" />
                  Organização dos Ícones no Topo do Workspace
                </h2>
                <p className="text-xs text-slate-400">
                  Escolha quais ícones aparecem e defina a ordem de exibição na barra do gravador.
                </p>
              </div>

              <Button
                size="sm"
                variant="tertiary"
                onPress={handleResetIcons}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-semibold transition-all cursor-pointer self-start md:self-auto h-auto min-h-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Restaurar Ordem Padrão</span>
              </Button>
            </div>

            {/* Aplicativo Instalável (PWA) */}
            <div className="bg-slate-950/80 border border-rose-500/20 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-200">
                  <Sparkles className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-bold">Aplicativo Instalável (PWA)</span>
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
                    Standalone
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Instale o daniloom diretamente no seu computador, celular ou tablet para ter inicialização instantânea, suporte offline e desempenho nativo sem a barra do navegador.
                </p>
              </div>
              <div className="shrink-0 self-start sm:self-center">
                <PWAInstallButton />
              </div>
            </div>

            {/* Modo Desempenho */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-slate-300">
                  <Gauge className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold">Modo Desempenho (Redução de Carga de CPU)</span>
                </div>
                <p className="text-[10px] text-slate-500">Oculta a prévia da câmera durante gravações longas para evitar travamentos</p>
              </div>
              <Switch isSelected={performanceMode} onChange={handlePerformanceToggle} size="sm">
                <Switch.Control className={performanceMode ? "[--switch-control-bg-checked:var(--color-amber-600)]" : ""}>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            {/* Lista de Reordenação e Visibilidade dos Ícones */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Lista de Ícones Interativos da Barra Superior
              </span>

              {workspaceIcons
                .filter((icon) => !icon.isPrivate || isAdmin)
                .map((icon, index) => (
                  <div
                    key={icon.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                      icon.visible
                        ? "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                        : "bg-slate-950/30 border-slate-900/80 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-mono font-bold text-slate-400">
                        {index + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200">{icon.label}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                            {icon.group}
                          </span>
                          {icon.isPrivate && (
                            <span title="Exclusivo Admin">
                              <Lock className="w-3 h-3 text-rose-400" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="tertiary"
                        isIconOnly
                        isDisabled={index === 0}
                        onPress={() => handleMoveIcon(index, "up")}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors h-auto min-h-0 w-auto min-w-0"
                        aria-label="Mover para Cima"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="tertiary"
                        isIconOnly
                        isDisabled={index === workspaceIcons.length - 1}
                        onPress={() => handleMoveIcon(index, "down")}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors h-auto min-h-0 w-auto min-w-0"
                        aria-label="Mover para Baixo"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="tertiary"
                        onPress={() => handleToggleIconVisibility(icon.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer h-auto min-h-0 ${
                          icon.visible
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
                            : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {icon.visible ? (
                          <>
                            <Eye className="w-3.5 h-3.5 text-rose-400" />
                            <span>Exibido</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                            <span>Oculto</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
            </div>

            {renderCategoryFlags("workspace")}
          </div>
        )}

        {/* CONTEÚDO DA TAB: NOTIFICAÇÕES */}
        {activeTab === "notifications" && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl animate-fade-in">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-400" />
                Notificações do Sistema e Alertas Sonoros
              </h2>
              <p className="text-xs text-slate-400">
                Configure os alertas visuais 'toast' e os efeitos sonoros sintetizados para cada ação.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs">
                    {toastEnabled ? (
                      <Bell className="w-4 h-4 text-rose-400" />
                    ) : (
                      <BellOff className="w-4 h-4 text-slate-500" />
                    )}
                    <span>Notificações em Pop-up (Toast)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Exibe avisos visuais no canto inferior da tela ao concluir ações.
                  </p>
                </div>

                <Switch isSelected={toastEnabled} onChange={handleToastEnabledToggle} size="sm">
                  <Switch.Control className={toastEnabled ? "[--switch-control-bg-checked:var(--color-rose-600)]" : ""}>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs">
                    {toastSoundEnabled ? (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-500" />
                    )}
                    <span>Alertas Sonoros das Notificações</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Sinal sonoro sintetizado ao receber avisos de Sucesso, Erro ou Alerta.
                  </p>
                </div>

                <Switch isSelected={toastSoundEnabled} onChange={handleToastSoundToggle} size="sm">
                  <Switch.Control className={toastSoundEnabled ? "[--switch-control-bg-checked:var(--color-emerald-600)]" : ""}>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">
                Testar Níveis de Notificação:
              </span>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => showToast("Operação concluída com sucesso!", "success")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition-all cursor-pointer h-auto min-h-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sucesso</span>
                </Button>

                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => showToast("Atenção: verifique as configurações da câmera.", "warning")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition-all cursor-pointer h-auto min-h-0"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Aviso</span>
                </Button>

                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => showToast("Erro ao processar o vídeo. Tente novamente.", "error")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-all cursor-pointer h-auto min-h-0"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Erro</span>
                </Button>

                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => showToast("Informação do sistema registrada.", "info")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 text-xs font-semibold transition-all cursor-pointer h-auto min-h-0"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Informação</span>
                </Button>
              </div>
            </div>
          </div>
        )}


        {/* CONTEÚDO DA TAB: ADMIN */}
        {activeTab === "admin" && isAdmin && (
          <div className="bg-slate-900/50 border border-rose-500/30 rounded-3xl p-6 space-y-6 shadow-xl animate-fade-in">
            <div className="border-b border-rose-500/30 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-400" />
                Painel Restrito do Administrador
              </h2>
              <p className="text-xs text-slate-400">
                Gerencie permissões privadas, telemetria global e acesso a rotas restritas.
              </p>
            </div>

            {renderCategoryFlags("admin")}
          </div>
        )}

        {/* Informações adicionais de permissão */}
        {!isAdmin && (
          <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/60 text-slate-500 text-xs flex items-center gap-3">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              Funcionalidades privadas e avançadas de gestão de administradores estão ocultas por
              padrão para contas não administradoras.
            </span>
          </div>
        )}
      </div>
    </Layout>
  );
};
