import { CropRegionSelector } from "./components/CropRegionSelector";
import { cropDesktopStream } from './desktop/captureRegion';
import type { CaptureMode } from './desktop/types';
import { DesktopToolbar } from "./desktop/DesktopToolbar";
import { useDesktopControls } from "./desktop/useDesktopControls";
import { syncDesktopClip } from "./desktop/sync";
import { CropRegion } from "./types";
import { useVideoManipulation } from "./hooks/useVideoManipulation";
import { Layout } from "./components/Layout";
import { AppearanceSettings } from "./components/AppearanceSettings";
import {
  Button,
  Input,
  Kbd,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  SegmentedControl,
  Slider,
} from "./components/ui";
import { useDialog } from "./context/DialogContext";
import { useAppTheme } from "./hooks/useAppTheme";
import { CustomPlayer } from "./components/CustomPlayer";
import { MicVolumeSlider } from "./components/MicVolumeSlider";
import { WatermarkPanel } from "./components/WatermarkPanel";
import { CameraPreviewMedia } from "./components/CameraPreviewMedia";
import { ScreenPreviewMedia } from "./components/ScreenPreviewMedia";
import { CameraGridOverlay } from "./features/recording/components/CameraGridOverlay";
import { CameraBlurredBackground } from "./features/recording/components/CameraBlurredBackground";
import { processVideoBackgroundBlur } from "./utils/backgroundBlur";
import { useEffect, useRef, useState, CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  initAuth,
  googleSignIn,
  logout,
  renewGoogleDriveToken,
} from "./firebase";
import { Clip, KeyboardShortcut, ExportConfig, Scene } from "./types";
import {
  RecordingEngine,
  buildRecordingStream,
  getSupportedMimeType,
} from "./features/recording/utils/recordingEngine";
import { Timeline } from "./features/editing/components/Timeline";
import { YouTubeUploadModal } from "./features/editing/components/YouTubeUploadModal";
import { TrimSection } from "./components/TrimSection";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useBluetoothShutter } from "./hooks/useBluetoothShutter";
import { isMobileDevice } from "./utils/deviceUtils";
import { mergeVideoClips, WatermarkConfig } from "./utils/videoMerger";
import { replaceVideoAudio, bufferToWav } from "./utils/audioReplacer";
import {
  playRecordStartSound,
  playRecordStopSound,
  playActionCompleteSound,
} from "./utils/soundEffects";
import {
  saveClipToDB,
  getClipsFromDB,
  deleteClipFromDB,
  clearClipsDB,
} from "./utils/projectDB";
import { isFeatureEnabled, getFeatureFlagsState } from "./utils/featureFlags";
import {
  getWorkspaceIconsConfig,
  WorkspaceIconConfig,
} from "./utils/workspaceIcons";
import { showToast } from "./utils/toast";
import {
  getRecordingResolutionSetting,
  getRecordingQualityProfileSetting,
  getRecordingDimensions,
  getRecordingBitrate,
} from "./utils/qualitySettings";
import { setDriveTokenRefreshHandler } from "./utils/drive";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  Sparkles,
  Plus,
  Download,
  Share2,
  Copy,
  Check,
  Settings,
  Flame,
  LogOut,
  Keyboard,
  Cloud,
  CloudUpload,
  Youtube,
  FileVideo,
  Monitor,
  Loader2,
  Eye,
  EyeOff,
  FileText,
  Sliders,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ExternalLink,
  Lock,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  ArrowLeftRight,
  X,
  Clock,
  Ban,
  Snowflake,
  Film,
  ArrowUpDown,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  Circle,
  Columns,
  Minimize2,
  Maximize2,
  Maximize,
  BookOpen,
  Pencil,
  Trash2,
  Crop,
  Sun,
  Focus,
  VolumeX,
  Contrast,
  Moon,
  Type,
  Gauge,
  Smartphone,
  Bot,
  Camera,
  HelpCircle,
  Info,
  Lightbulb,
  CheckCircle,
  Upload,
  Languages,
  ChevronDown,
  Folder,
  Clapperboard,
  Scissors,
  Split,
  Zap,
  ZoomIn,
  ZoomOut,
  Volume2,
  Activity,
  Image as ImageIcon,
  User,
  CircleDashed,
  CircleDot,
  Grid3X3,
  SwitchCamera,
  FlipHorizontal,
  Bluetooth,
  PictureInPicture2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const getCanvasFilterString = (
  filterName: string,
  brightness: number = 100,
  contrast: number = 100,
  shadow: number = 0,
  blackPoint: number = 0,
  studioLightEnabled: boolean = false,
  studioLightIntensity: number = 50,
): string => {
  let baseFilter = "";
  switch (filterName) {
    case "grayscale":
      baseFilter = "grayscale(100%)";
      break;
    case "warm":
      baseFilter = "sepia(30%) saturate(140%) hue-rotate(-10deg)";
      break;
    case "cool":
      baseFilter =
        "saturate(85%) contrast(106%) brightness(103%) hue-rotate(-10deg)";
      break;
    default:
      baseFilter = "";
      break;
  }
  let adjustedContrast = Math.max(
    10,
    contrast + blackPoint * 0.5 - shadow * 0.3,
  );
  let adjustedBrightness = Math.max(
    10,
    brightness - blackPoint * 0.2 + shadow * 0.15,
  );

  if (studioLightEnabled) {
    adjustedBrightness += studioLightIntensity * 0.18;
    adjustedContrast += studioLightIntensity * 0.1;
  }

  return `${baseFilter} brightness(${adjustedBrightness}%) contrast(${adjustedContrast}%)`.trim();
};

const drawSpeakerNameBadge = (
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
) => {
  ctx.save();
  ctx.font = "500 14px Plus Jakarta Sans, sans-serif";
  const textWidth = ctx.measureText(text).width;
  const badgeWidth = textWidth + 24;
  const badgeHeight = 28;
  const rx = centerX - badgeWidth / 2;
  const ry = centerY - badgeHeight / 2;

  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === "function") {
    (ctx as any).roundRect(rx, ry, badgeWidth, badgeHeight, 14);
  } else {
    const r = 14;
    ctx.moveTo(rx + r, ry);
    ctx.lineTo(rx + badgeWidth - r, ry);
    ctx.quadraticCurveTo(rx + badgeWidth, ry, rx + badgeWidth, ry + r);
    ctx.lineTo(rx + badgeWidth, ry + badgeHeight - r);
    ctx.quadraticCurveTo(
      rx + badgeWidth,
      ry + badgeHeight,
      rx + badgeWidth - r,
      ry + badgeHeight,
    );
    ctx.lineTo(rx + r, ry + badgeHeight);
    ctx.quadraticCurveTo(rx, ry + badgeHeight, rx, ry + badgeHeight - r);
    ctx.lineTo(rx, ry + r);
    ctx.quadraticCurveTo(rx, ry, rx + r, ry);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, centerX, centerY);
  ctx.restore();
};

const generateVideoThumbnail = (videoUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;

    // Position completely off-screen
    video.style.position = "fixed";
    video.style.top = "0";
    video.style.left = "0";
    video.style.width = "10px";
    video.style.height = "10px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    document.body.appendChild(video);

    // Seek to 0.5 seconds to get a clear frame
    video.currentTime = 0.5;

    const captureFrame = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrl);
        } else {
          resolve("");
        }
      } catch (err) {
        console.error("Error drawing thumbnail from video", err);
        resolve("");
      } finally {
        try {
          video.remove();
        } catch (e) {}
      }
    };

    video.onseeked = captureFrame;

    video.oncanplay = () => {
      if (video.currentTime !== 0.5) {
        video.currentTime = Math.min(0.5, video.duration || 0);
      }
    };

    video.onerror = () => {
      try {
        video.remove();
      } catch (e) {}
      resolve("");
    };

    // Safety timeout fallback
    setTimeout(() => {
      try {
        video.remove();
      } catch (e) {}
      resolve("");
    }, 3000);
  });
};

export default function App() {
  const { confirm, alert } = useDialog();
  const { theme, updateTheme } = useAppTheme();
  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileDevice());
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const recordingGainNodeRef = useRef<GainNode | null>(null);
  const micGainRef = useRef<number>(100);
  // Auth state
  const [user, setUser] = useState<any>(null);
  const isAdmin = () => user?.email === "oi@daniilo.dev";
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  // Device configuration
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [cameraFacingMode, setCameraFacingMode] = useState<
    "user" | "environment"
  >(() => {
    return (
      (localStorage.getItem("daniloom_camera_facing_mode") as any) || "user"
    );
  });
  const cameraFacingModeRef = useRef<"user" | "environment">(cameraFacingMode);
  useEffect(() => {
    cameraFacingModeRef.current = cameraFacingMode;
    localStorage.setItem("daniloom_camera_facing_mode", cameraFacingMode);
  }, [cameraFacingMode]);

  const [selectedMic, setSelectedMic] = useState<string>(() => {
    return localStorage.getItem("daniloom_selected_mic") || "default";
  });
  const handleMicSelect = (deviceId: string) => {
    setSelectedMic(deviceId);
    localStorage.setItem("daniloom_selected_mic", deviceId);
  };
  const [useCamera, setUseCamera] = useState<boolean>(false);
  const [useMic, setUseMic] = useState<boolean>(true);
  const [micGain, setMicGain] = useState<number>(() => {
    const saved = localStorage.getItem("daniloom_mic_gain");
    return saved !== null ? Number(saved) : 100;
  });

  const handleFlipCamera = async () => {
    // 1. If multiple video input devices are available, cycle to the next device
    if (videoDevices.length > 1) {
      const currentIndex = videoDevices.findIndex(
        (d) => d.deviceId === selectedCamera,
      );
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      const nextDevice = videoDevices[nextIndex];
      setSelectedCamera(nextDevice.deviceId);

      const label = (nextDevice.label || "").toLowerCase();
      const isBack =
        label.includes("back") ||
        label.includes("rear") ||
        label.includes("traseir") ||
        label.includes("environment") ||
        label.includes("trás");
      const isFront =
        label.includes("front") ||
        label.includes("selfie") ||
        label.includes("user") ||
        label.includes("frontal") ||
        label.includes("facetime");

      if (isBack) {
        setCameraFacingMode("environment");
        setCameraFlipH(false);
        showToast("Câmera Traseira ativada (Modo Natural)", "info");
      } else if (isFront) {
        setCameraFacingMode("user");
        setCameraFlipH(true);
        showToast("Câmera Frontal ativada (Modo Espelho)", "info");
      } else {
        const nextFacing = cameraFacingMode === "user" ? "environment" : "user";
        setCameraFacingMode(nextFacing);
        setCameraFlipH(nextFacing === "user");
        showToast(
          nextFacing === "user" ? "Câmera Frontal (Selfie)" : "Câmera Traseira",
          "info",
        );
      }
    } else {
      // Mobile facingMode toggle fallback
      const nextFacing = cameraFacingMode === "user" ? "environment" : "user";
      setCameraFacingMode(nextFacing);
      setCameraFlipH(nextFacing === "user");
      setSelectedCamera(""); // Clear fixed deviceId to allow facingMode constraint to resolve on mobile

      try {
        if (cameraStream) {
          cameraStream.getTracks().forEach((t) => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacing } },
          audio: false,
        });
        setCameraStream(stream);
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings?.();
        if (settings?.deviceId) {
          setSelectedCamera(settings.deviceId);
        }
        showToast(
          nextFacing === "user"
            ? "Câmera Frontal (Selfie)"
            : "Câmera Traseira (Back View)",
          "info",
        );
      } catch (err) {
        console.warn("Could not switch facingMode directly:", err);
        showToast(
          "Alternando para " +
            (nextFacing === "user" ? "Câmera Frontal" : "Câmera Traseira"),
          "info",
        );
      }
    }
  };

  useEffect(() => {
    micGainRef.current = micGain;
    if (recordingGainNodeRef.current) {
      // Use setTargetAtTime for smooth volume transitions to avoid clipping
      // Using an exponential curve (power of 2) for human hearing perception
      const targetGain = Math.pow(micGain / 100, 2);
      try {
        recordingGainNodeRef.current.gain.setTargetAtTime(
          targetGain,
          recordingGainNodeRef.current.context.currentTime,
          0.05,
        );
      } catch (e) {
        recordingGainNodeRef.current.gain.value = targetGain;
      }
    }
  }, [micGain]);
  const handleMicGainChange = (newGain: number) => {
    setMicGain(newGain);
    localStorage.setItem("daniloom_mic_gain", String(newGain));
  };

  // New States
  // "Somente tela" é sempre o modo padrão ao abrir o app
  const [recordingMode, setRecordingMode] = useState<"screen" | "camera">(
    "screen",
  );
  const [recordingFormat, setRecordingFormat] = useState<
    "landscape" | "portrait"
  >(() => {
    return (
      (localStorage.getItem("daniloom_layout_recording_format") as any) ||
      "landscape"
    );
  });
  const handleFormatSelect = (fmt: "landscape" | "portrait") => {
    setRecordingFormat(fmt);
    if (fmt === "portrait") {
      setScreenSize("full");
      setCameraShape("rectangle");
      setBubbleSize("lg");
    }
  };
  const recordingModeRef = useRef<"screen" | "camera">(recordingMode);
  const recordingLayout: "screen" | "overlay" | "camera" =
    recordingMode === "camera" ? "camera" : useCamera ? "overlay" : "screen";
  const handleRecordingLayout = (layout: "screen" | "overlay" | "camera") => {
    if (layout === "camera") {
      setRecordingMode("camera");
      setUseCamera(true);
    } else {
      setRecordingMode("screen");
      setUseCamera(layout === "overlay");
    }
  };
  const recordingFormatRef = useRef<"landscape" | "portrait">("landscape");

  // Export & Progress States
  const [exportProgress, setExportProgress] = useState<number>(0);
  // Feature Flags Sync State
  const [featureFlagsTick, setFeatureFlagsTick] = useState<number>(0);
  const [workspaceIcons, setWorkspaceIcons] = useState<WorkspaceIconConfig[]>(
    getWorkspaceIconsConfig,
  );

  useEffect(() => {
    const handleFlagsChange = () => setFeatureFlagsTick((t) => t + 1);
    const handleIconsChange = () =>
      setWorkspaceIcons(getWorkspaceIconsConfig());

    window.addEventListener(
      "daniloom_feature_flags_changed",
      handleFlagsChange,
    );
    window.addEventListener(
      "daniloom_workspace_icons_changed",
      handleIconsChange,
    );

    return () => {
      window.removeEventListener(
        "daniloom_feature_flags_changed",
        handleFlagsChange,
      );
      window.removeEventListener(
        "daniloom_workspace_icons_changed",
        handleIconsChange,
      );
    };
  }, []);

  // Performance, Resolution, Zoom, Watermark & Sound States
  const [previewZoom, setPreviewZoom] = useState<number>(1.0);
  const [performanceMode, setPerformanceMode] = useState<boolean>(() => {
    return localStorage.getItem("daniloom_performance_mode") === "true";
  });
  const togglePerformanceMode = () => {
    setPerformanceMode((prev) => {
      const next = !prev;
      localStorage.setItem("daniloom_performance_mode", String(next));
      return next;
    });
  };

  const [recordingResolution, setRecordingResolution] = useState<
    "720p" | "1080p" | "4k"
  >(
    () =>
      (localStorage.getItem("daniloom_recording_resolution") as any) || "1080p",
  );
  const handleResolutionSelect = (res: "720p" | "1080p" | "4k") => {
    setRecordingResolution(res);
    localStorage.setItem("daniloom_recording_resolution", res);
  };

  const [cameraBlurEnabled, setCameraBlurEnabled] = useState<boolean>(() => {
    return localStorage.getItem("daniloom_camera_blur") === "true";
  });
  const cameraBlurEnabledRef = useRef<boolean>(cameraBlurEnabled);

  const toggleCameraBlur = () => {
    setCameraBlurEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("daniloom_camera_blur", String(next));
      return next;
    });
  };

  const [cameraBgBlurAmount, setCameraBgBlurAmount] = useState<number>(() => {
    const saved = localStorage.getItem("daniloom_camera_bg_blur_amount");
    return saved !== null ? Number(saved) : 12;
  });
  const cameraBgBlurAmountRef = useRef<number>(cameraBgBlurAmount);

  const [studioLightEnabled, setStudioLightEnabled] = useState<boolean>(() => {
    return localStorage.getItem("daniloom_studio_light") === "true";
  });
  const studioLightEnabledRef = useRef<boolean>(studioLightEnabled);

  const [studioLightIntensity, setStudioLightIntensity] = useState<number>(
    () => {
      const saved = localStorage.getItem("daniloom_studio_light_intensity");
      return saved !== null ? Number(saved) : 50;
    },
  );
  const studioLightIntensityRef = useRef<number>(studioLightIntensity);
  const toggleStudioLight = () => {
    setStudioLightEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("daniloom_studio_light", String(next));
      return next;
    });
  };

  const [noiseCancellationEnabled, setNoiseCancellationEnabled] =
    useState<boolean>(() => {
      return localStorage.getItem("daniloom_noise_cancellation") !== "false";
    });
  const toggleNoiseCancellation = () => {
    setNoiseCancellationEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("daniloom_noise_cancellation", String(next));
      return next;
    });
  };

  const [cropRegion, setCropRegion] = useState<CropRegion>(() => {
    try {
      const saved = localStorage.getItem("daniloom_crop_region");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { enabled: false, x: 0, y: 0, width: 100, height: 100 };
  });
  const [showCropModal, setShowCropModal] = useState<boolean>(false);

  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean>(
    () => {
      return localStorage.getItem("daniloom_sound_effects") !== "false";
    },
  );
  const toggleSoundEffects = () => {
    setSoundEffectsEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("daniloom_sound_effects", String(next));
      return next;
    });
  };

  const [cameraGridEnabled, setCameraGridEnabled] = useState<boolean>(() => {
    return localStorage.getItem("daniloom_camera_grid") !== "false";
  });
  const toggleCameraGrid = () => {
    setCameraGridEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("daniloom_camera_grid", String(next));
      return next;
    });
  };

  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>(
    () => {
      try {
        const saved = localStorage.getItem("daniloom_watermark_config");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      return {
        enabled: false,
        image: "",
        position: "bottom-right",
        opacity: 0.8,
        scale: 0.15,
      };
    },
  );
  const handleWatermarkConfigChange = (cfg: WatermarkConfig) => {
    setWatermarkConfig(cfg);
    localStorage.setItem("daniloom_watermark_config", JSON.stringify(cfg));
  };
  const [showWatermarkModal, setShowWatermarkModal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micStreamForVU, setMicStreamForVU] = useState<MediaStream | null>(
    null,
  );

  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: "mp4",
    quality: "high",
  });
  const enhanceAudio = false;
  const [exportName, setExportName] = useState<string>("video_final");
  const exportWithSubtitles = false;
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState<number>(0);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isWaitingNextClip, setIsWaitingNextClip] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingTimerLimit, setRecordingTimerLimit] = useState<number | null>(
    null,
  );
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [isPipFallbackActive, setIsPipFallbackActive] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [showTrim, setShowTrim] = useState(false);
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [youtubeUploadClip, setYoutubeUploadClip] = useState<Clip | null>(null);
  const [mergedVideo, setMergedVideo] = useState<Blob | null>(null);
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);

  // Camera stream for floating bubble
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [bubbleSize, setBubbleSize] = useState<"sm" | "md" | "lg">(() => {
    return (localStorage.getItem("daniloom_layout_bubble_size") as any) || "md";
  });
  const bubbleSizeRef = useRef<"sm" | "md" | "lg">("md");

  // Custom Webcam and Background States
  const [cameraFilter, setCameraFilter] = useState<string>(() => {
    return localStorage.getItem("daniloom_default_camera_filter") || "none";
  });
  const cameraFilterRef = useRef<string>(cameraFilter);

  const [screenBgType, setScreenBgType] = useState<
    "solid" | "gradient" | "pattern" | "camera"
  >(() => {
    return (
      (localStorage.getItem("daniloom_layout_screen_bg_type") as any) || "solid"
    );
  });
  const screenBgTypeRef = useRef<"solid" | "gradient" | "pattern" | "camera">("solid");

  const [screenBgValue, setScreenBgValue] = useState<string>(() => {
    const saved = localStorage.getItem("daniloom_layout_screen_bg_value");
    if (!saved || saved === "#020617" || saved === "#0f172a") return "#0c0d0f";
    return saved;
  });
  const screenBgValueRef = useRef<string>("#0c0d0f");

  const [cameraPosition, setCameraPosition] = useState<
    | "bottom-left"
    | "bottom-right"
    | "top-left"
    | "top-right"
    | "bottom-center"
    | "top-center"
  >(() => {
    return (
      (localStorage.getItem("daniloom_layout_camera_position") as any) ||
      "bottom-left"
    );
  });
  const cameraPositionRef = useRef<
    | "bottom-left"
    | "bottom-right"
    | "top-left"
    | "top-right"
    | "bottom-center"
    | "top-center"
  >("bottom-left");

  const [cameraShape, setCameraShape] = useState<
    "circle" | "rectangle" | "split" | "hidden" | "centralized" | "fullscreen"
  >(() => {
    const saved = localStorage.getItem("daniloom_layout_camera_shape");
    if (saved) return saved as any;
    return isMobileDevice() ? "fullscreen" : "circle";
  });
  const cameraShapeRef = useRef<
    "circle" | "rectangle" | "split" | "hidden" | "centralized" | "fullscreen"
  >("circle");

  const [screenSize, setScreenSize] = useState<"full" | "medium" | "compact">(
    () => {
      return (
        (localStorage.getItem("daniloom_layout_screen_size") as any) || "full"
      );
    },
  );
  const screenSizeRef = useRef<"full" | "medium" | "compact">("full");

  const [cameraBrightness, setCameraBrightness] = useState<number>(() => {
    const saved = localStorage.getItem("daniloom_default_camera_brightness");
    return saved !== null ? Number(saved) : 100;
  });
  const cameraBrightnessRef = useRef<number>(cameraBrightness);

  const [cameraContrast, setCameraContrast] = useState<number>(() => {
    const saved = localStorage.getItem("daniloom_default_camera_contrast");
    return saved !== null ? Number(saved) : 100;
  });
  const cameraContrastRef = useRef<number>(cameraContrast);

  const [cameraOffsetX, setCameraOffsetX] = useState<number>(() => {
    const saved = localStorage.getItem("daniloom_camera_offset_x");
    return saved !== null ? Number(saved) : 50;
  });
  const cameraOffsetXRef = useRef<number>(cameraOffsetX);

  const [cameraOffsetY, setCameraOffsetY] = useState<number>(() => {
    const saved = localStorage.getItem("daniloom_camera_offset_y");
    return saved !== null ? Number(saved) : 50;
  });
  const cameraOffsetYRef = useRef<number>(cameraOffsetY);

  // Custom screen cropping states
  const [isCustomCropEnabled, setIsCustomCropEnabled] =
    useState<boolean>(false);
  const [cropXPercent, setCropXPercent] = useState<number>(0);
  const [cropYPercent, setCropYPercent] = useState<number>(0);
  const [cropWidthPercent, setCropWidthPercent] = useState<number>(100);
  const [cropHeightPercent, setCropHeightPercent] = useState<number>(100);

  const isCustomCropEnabledRef = useRef<boolean>(isCustomCropEnabled);
  const cropXPercentRef = useRef<number>(cropXPercent);
  const cropYPercentRef = useRef<number>(cropYPercent);
  const cropWidthPercentRef = useRef<number>(cropWidthPercent);
  const cropHeightPercentRef = useRef<number>(cropHeightPercent);

  // Tab visibility state
  const [isDocumentVisible, setIsDocumentVisible] = useState<boolean>(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const cropOverlayRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    action: string;
  } | null>(null);

  const handleCropPointerDown = (e: React.PointerEvent, action: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cropOverlayRef.current) return;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: cropXPercent,
      startY: cropYPercent,
      startW: cropWidthPercent,
      startH: cropHeightPercent,
      action,
    };
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {
      // Fallback
    }
  };

  const handleCropPointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current || !cropOverlayRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = cropOverlayRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dxPercent = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
    const dyPercent =
      ((e.clientY - dragStartRef.current.y) / rect.height) * 100;

    const { startX, startY, startW, startH, action } = dragStartRef.current;

    let newX = startX;
    let newY = startY;
    let newW = startW;
    let newH = startH;

    if (action === "move") {
      newX = Math.max(0, Math.min(100 - startW, startX + dxPercent));
      newY = Math.max(0, Math.min(100 - startH, startY + dyPercent));
    } else {
      // Resize corners
      if (action.includes("n")) {
        const bottom = startY + startH;
        newY = Math.max(0, Math.min(bottom - 10, startY + dyPercent));
        newH = bottom - newY;
      }
      if (action.includes("s")) {
        newH = Math.max(10, Math.min(100 - startY, startH + dyPercent));
      }
      if (action.includes("w")) {
        const right = startX + startW;
        newX = Math.max(0, Math.min(right - 10, startX + dxPercent));
        newW = right - newX;
      }
      if (action.includes("e")) {
        newW = Math.max(10, Math.min(100 - startX, startW + dxPercent));
      }
    }

    setCropXPercent(Math.round(newX));
    setCropYPercent(Math.round(newY));
    setCropWidthPercent(Math.round(newW));
    setCropHeightPercent(Math.round(newH));
  };

  const handleCropPointerUp = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {
      // Fallback
    }
    dragStartRef.current = null;
  };

  const [cameraShadow, setCameraShadow] = useState<number>(() => {
    const saved = localStorage.getItem("daniloom_default_camera_shadow");
    return saved !== null ? Number(saved) : 0;
  });
  const cameraShadowRef = useRef<number>(cameraShadow);

  const [cameraBlackPoint, setCameraBlackPoint] = useState<number>(() => {
    const saved = localStorage.getItem("daniloom_default_camera_black_point");
    return saved !== null ? Number(saved) : 0;
  });
  const cameraBlackPointRef = useRef<number>(cameraBlackPoint);

  const [activeAdjustmentTab, setActiveAdjustmentTab] = useState<
    "brightness" | "contrast" | "shadow" | "blackPoint"
  >("brightness");

  const [cameraFlipH, setCameraFlipH] = useState<boolean>(() => {
    const saved = localStorage.getItem("daniloom_default_camera_flip_h");
    return saved !== null ? saved === "true" : true;
  });
  const cameraFlipHRef = useRef<boolean>(cameraFlipH);

  const [cameraFlipV, setCameraFlipV] = useState<boolean>(() => {
    const saved = localStorage.getItem("daniloom_default_camera_flip_v");
    return saved !== null ? saved === "true" : false;
  });
  const cameraFlipVRef = useRef<boolean>(cameraFlipV);

  // Split Inverted state
  const [splitInverted, setSplitInverted] = useState<boolean>(() => {
    return localStorage.getItem("daniloom_layout_split_inverted") === "true";
  });
  const splitInvertedRef = useRef<boolean>(false);

  // Split Ratio state (0.15 to 0.85, default 0.5 = 50/50)
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    const saved = localStorage.getItem("daniloom_layout_split_ratio");
    return saved !== null ? parseFloat(saved) : 0.5;
  });
  const splitRatioRef = useRef<number>(0.5);

  // Saved Filter Feedback
  const [filterSavedFeedback, setFilterSavedFeedback] =
    useState<boolean>(false);

  // Keep references updated for the 30fps canvas drawing loop
  useEffect(() => {
    bubbleSizeRef.current = bubbleSize;
  }, [bubbleSize]);
  useEffect(() => {
    cameraFilterRef.current = cameraFilter;
  }, [cameraFilter]);
  useEffect(() => {
    screenBgTypeRef.current = screenBgType;
  }, [screenBgType]);
  useEffect(() => {
    screenBgValueRef.current = screenBgValue;
  }, [screenBgValue]);
  useEffect(() => {
    cameraPositionRef.current = cameraPosition;
  }, [cameraPosition]);
  useEffect(() => {
    cameraShapeRef.current = cameraShape;
  }, [cameraShape]);
  useEffect(() => {
    screenSizeRef.current = screenSize;
  }, [screenSize]);
  useEffect(() => {
    cameraBrightnessRef.current = cameraBrightness;
  }, [cameraBrightness]);
  useEffect(() => {
    cameraContrastRef.current = cameraContrast;
  }, [cameraContrast]);
  useEffect(() => {
    cameraShadowRef.current = cameraShadow;
  }, [cameraShadow]);
  useEffect(() => {
    cameraBlackPointRef.current = cameraBlackPoint;
  }, [cameraBlackPoint]);
  useEffect(() => {
    cameraBlurEnabledRef.current = cameraBlurEnabled;
  }, [cameraBlurEnabled]);
  useEffect(() => {
    cameraBgBlurAmountRef.current = cameraBgBlurAmount;
  }, [cameraBgBlurAmount]);
  useEffect(() => {
    studioLightEnabledRef.current = studioLightEnabled;
  }, [studioLightEnabled]);
  useEffect(() => {
    studioLightIntensityRef.current = studioLightIntensity;
  }, [studioLightIntensity]);
  useEffect(() => {
    cameraFlipHRef.current = cameraFlipH;
  }, [cameraFlipH]);
  useEffect(() => {
    cameraFlipVRef.current = cameraFlipV;
  }, [cameraFlipV]);
  useEffect(() => {
    splitInvertedRef.current = splitInverted;
  }, [splitInverted]);
  useEffect(() => {
    splitRatioRef.current = splitRatio;
  }, [splitRatio]);
  useEffect(() => {
    recordingModeRef.current = recordingMode;
  }, [recordingMode]);
  useEffect(() => {
    recordingFormatRef.current = recordingFormat;
  }, [recordingFormat]);
  useEffect(() => {
    isCustomCropEnabledRef.current = isCustomCropEnabled;
  }, [isCustomCropEnabled]);
  useEffect(() => {
    cropXPercentRef.current = cropXPercent;
  }, [cropXPercent]);
  useEffect(() => {
    cropYPercentRef.current = cropYPercent;
  }, [cropYPercent]);
  useEffect(() => {
    cropWidthPercentRef.current = cropWidthPercent;
  }, [cropWidthPercent]);
  useEffect(() => {
    cropHeightPercentRef.current = cropHeightPercent;
  }, [cropHeightPercent]);
  useEffect(() => {
    cameraOffsetXRef.current = cameraOffsetX;
  }, [cameraOffsetX]);
  useEffect(() => {
    cameraOffsetYRef.current = cameraOffsetY;
  }, [cameraOffsetY]);
  // Auto-save layout configurations to localStorage
  useEffect(() => {
    localStorage.setItem("daniloom_layout_camera_shape", cameraShape);
  }, [cameraShape]);

  useEffect(() => {
    localStorage.setItem("daniloom_camera_offset_x", String(cameraOffsetX));
  }, [cameraOffsetX]);

  useEffect(() => {
    localStorage.setItem("daniloom_camera_offset_y", String(cameraOffsetY));
  }, [cameraOffsetY]);

  useEffect(() => {
    localStorage.setItem("daniloom_layout_camera_position", cameraPosition);
  }, [cameraPosition]);

  useEffect(() => {
    localStorage.setItem(
      "daniloom_layout_split_inverted",
      String(splitInverted),
    );
  }, [splitInverted]);

  useEffect(() => {
    localStorage.setItem("daniloom_layout_split_ratio", String(splitRatio));
  }, [splitRatio]);

  useEffect(() => {
    localStorage.setItem("daniloom_layout_bubble_size", bubbleSize);
  }, [bubbleSize]);

  useEffect(() => {
    localStorage.setItem("daniloom_layout_screen_size", screenSize);
  }, [screenSize]);

  useEffect(() => {
    localStorage.setItem("daniloom_layout_screen_bg_type", screenBgType);
  }, [screenBgType]);

  useEffect(() => {
    localStorage.setItem("daniloom_layout_screen_bg_value", screenBgValue);
  }, [screenBgValue]);

  useEffect(() => {
    localStorage.setItem("daniloom_layout_recording_format", recordingFormat);
  }, [recordingFormat]);

  const currentClips = clips.filter(
    (c) => (c.format || "landscape") === recordingFormat,
  );

  const subtitles: any[] = [];
  const subtitleConfig = {
    fontSizeScale: 1,
    color: "#ffffff",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    position: "bottom" as const,
  };

  // Switch selected clip to match the active format when format changes
  useEffect(() => {
    if (
      selectedClip &&
      (selectedClip.format || "landscape") !== recordingFormat &&
      selectedClip.id !== "merged"
    ) {
      const formatClips = clips.filter(
        (c) => (c.format || "landscape") === recordingFormat,
      );
      setSelectedClip(formatClips.length > 0 ? formatClips[0] : null);
    }
  }, [recordingFormat]);

  // Handle timer limit stop
  useEffect(() => {
    if (
      isRecording &&
      !isPaused &&
      recordingTimerLimit !== null &&
      recordingTimerLimit > 0
    ) {
      if (recordingDuration >= recordingTimerLimit) {
        stopRecording();
      }
    }
  }, [recordingDuration, isRecording, isPaused, recordingTimerLimit]);

  // Reset/Clear optimized video when format, quality or audio filters change
  useEffect(() => {
    setMergedVideoUrl(null);
    setMergedVideo(null);
  }, [exportConfig.format, exportConfig.quality, enhanceAudio]);

  // Keyboard Shortcuts Configuration (Standardized and fixed)
  const [shortcuts] = useState<KeyboardShortcut[]>([
    {
      id: "toggleRecord",
      label: "Iniciar / Parar Gravação",
      key: "r",
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
    },
    {
      id: "pauseResume",
      label: "Pausar / Retomar Gravação",
      key: "p",
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
    },
    {
      id: "splitClip",
      label: "Salvar Clipe e Pausar",
      key: "s",
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
    },
    {
      id: "cancelRecord",
      label: "Cancelar Gravação",
      key: "c",
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
    },
    {
      id: "restartRecord",
      label: "Reiniciar Gravação",
      key: "g",
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
    },
    {
      id: "restartProject",
      label: "Reiniciar Projeto (Limpar)",
      key: "l",
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
    },
    {
      id: "deleteProject",
      label: "Excluir Projeto",
      key: "x",
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
    },
    {
      id: "scene1",
      label: "Mudar para Cena 1",
      key: "1",
      ctrlKey: false,
      shiftKey: false,
      altKey: true,
    },
    {
      id: "scene2",
      label: "Mudar para Cena 2",
      key: "2",
      ctrlKey: false,
      shiftKey: false,
      altKey: true,
    },
    {
      id: "scene3",
      label: "Mudar para Cena 3",
      key: "3",
      ctrlKey: false,
      shiftKey: false,
      altKey: true,
    },
    {
      id: "scene4",
      label: "Mudar para Cena 4",
      key: "4",
      ctrlKey: false,
      shiftKey: false,
      altKey: true,
    },
    {
      id: "scene5",
      label: "Mudar para Cena 5",
      key: "5",
      ctrlKey: false,
      shiftKey: false,
      altKey: true,
    },
  ]);

  const dbLoadedRef = useRef(false);

  // UI state
  const [activeTab, setActiveTab] = useState<"record" | "scenes" | "settings">(
    "record",
  );
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpTab, setHelpTab] = useState<"tips" | "shortcuts">("tips");
  const [activeConfigSection, setActiveConfigSection] = useState<
    "devices" | "filters" | "layout" | "background"
  >("devices");

  // Speaker Name & Scenes States
  const [newSceneName, setNewSceneName] = useState("");
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingSceneName, setEditingSceneName] = useState("");
  const [speakerName, setSpeakerName] = useState<string>(() => {
    return localStorage.getItem("daniloom_speaker_name") || "Danilo Mello";
  });
  const [showSpeakerName, setShowSpeakerName] = useState<boolean>(() => {
    return localStorage.getItem("daniloom_show_speaker_name") === "true";
  });
  const speakerNameRef = useRef<string>(speakerName);
  const showSpeakerNameRef = useRef<boolean>(showSpeakerName);

  useEffect(() => {
    speakerNameRef.current = speakerName;
  }, [speakerName]);
  useEffect(() => {
    showSpeakerNameRef.current = showSpeakerName;
  }, [showSpeakerName]);

  useEffect(() => {
    localStorage.setItem("daniloom_speaker_name", speakerName);
  }, [speakerName]);

  useEffect(() => {
    localStorage.setItem("daniloom_show_speaker_name", String(showSpeakerName));
  }, [showSpeakerName]);

  const [scenes, setScenes] = useState<Scene[]>(() => {
    const saved = localStorage.getItem("daniloom_scenes");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn("Could not parse saved scenes", e);
      }
    }
    // Seed default scenes
    return [
      {
        id: "scene-camera-full",
        name: "Apenas Câmera",
        recordingMode: "camera",
        recordingFormat: "landscape",
        cameraShape: "fullscreen",
        cameraPosition: "bottom-center",
        bubbleSize: "lg",
        screenSize: "full",
        cameraFilter: "none",
        cameraBrightness: 100,
        cameraContrast: 100,
        cameraShadow: 0,
        cameraBlackPoint: 0,
        cameraFlipH: true,
        cameraFlipV: false,
        splitInverted: false,
        screenBgType: "solid",
        screenBgValue: "#0c0d0f",
        showSpeakerName: true,
        speakerName: "Danilo Mello",
      },
      {
        id: "scene-presentation",
        name: "Apresentação",
        recordingMode: "screen",
        recordingFormat: "landscape",
        cameraShape: "circle",
        cameraPosition: "bottom-left",
        bubbleSize: "md",
        screenSize: "full",
        cameraFilter: "none",
        cameraBrightness: 100,
        cameraContrast: 100,
        cameraShadow: 0,
        cameraBlackPoint: 0,
        cameraFlipH: true,
        cameraFlipV: false,
        splitInverted: false,
        screenBgType: "gradient",
        screenBgValue: "sunset",
        showSpeakerName: true,
        speakerName: "Danilo Mello",
      },
      {
        id: "scene-split",
        name: "Tela Dividida",
        recordingMode: "screen",
        recordingFormat: "landscape",
        cameraShape: "split",
        cameraPosition: "bottom-right",
        bubbleSize: "md",
        screenSize: "full",
        cameraFilter: "none",
        cameraBrightness: 100,
        cameraContrast: 100,
        cameraShadow: 0,
        cameraBlackPoint: 0,
        cameraFlipH: true,
        cameraFlipV: false,
        splitInverted: false,
        screenBgType: "solid",
        screenBgValue: "#0c0d0f",
        showSpeakerName: true,
        speakerName: "Danilo Mello",
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem("daniloom_scenes", JSON.stringify(scenes));
  }, [scenes]);

  const applyScene = (scene: Scene) => {
    setRecordingMode(scene.recordingMode);
    setUseCamera(
      scene.recordingMode === "camera" || scene.cameraShape !== "hidden",
    );
    setRecordingFormat(scene.recordingFormat);
    setCameraShape(scene.cameraShape);
    setCameraPosition(scene.cameraPosition);
    setBubbleSize(scene.bubbleSize);
    setScreenSize(scene.screenSize);
    setCameraFilter(scene.cameraFilter);
    setCameraBrightness(scene.cameraBrightness);
    setCameraContrast(scene.cameraContrast);
    setCameraShadow(scene.cameraShadow);
    setCameraBlackPoint(scene.cameraBlackPoint);
    setCameraFlipH(scene.cameraFlipH);
    setCameraFlipV(scene.cameraFlipV);
    setSplitInverted(scene.splitInverted);
    setScreenBgType(scene.screenBgType);
    setScreenBgValue(scene.screenBgValue);
    setShowSpeakerName(scene.showSpeakerName);
    if (scene.speakerName) {
      setSpeakerName(scene.speakerName);
    }
    if (scene.cameraOffsetX !== undefined)
      setCameraOffsetX(scene.cameraOffsetX);
    if (scene.cameraOffsetY !== undefined)
      setCameraOffsetY(scene.cameraOffsetY);
    showToast(`Cena "${scene.name}" aplicada com sucesso!`, "success");
  };

  const createScene = (name: string) => {
    if (!name.trim()) return;
    const newScene: Scene = {
      id: Math.random().toString(36).substring(7),
      name: name.trim(),
      recordingMode,
      recordingFormat,
      cameraShape,
      cameraPosition,
      bubbleSize,
      screenSize,
      cameraFilter,
      cameraBrightness,
      cameraContrast,
      cameraShadow,
      cameraBlackPoint,
      cameraFlipH,
      cameraFlipV,
      splitInverted,
      screenBgType,
      screenBgValue,
      showSpeakerName,
      speakerName,
      cameraOffsetX,
      cameraOffsetY,
    };
    setScenes((prev) => [...prev, newScene]);
    showToast(`Cena "${name}" criada com sucesso!`, "success");
  };

  const deleteScene = (id: string) => {
    setScenes((prev) => prev.filter((s) => s.id !== id));
    showToast("Cena excluída com sucesso!", "success");
  };

  const updateSceneName = (id: string, newName: string) => {
    if (!newName.trim()) return;
    setScenes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: newName.trim() } : s)),
    );
    showToast(`Cena renomeada para "${newName.trim()}"!`, "success");
  };

  const [isDownloadingAudio, setIsDownloadingAudio] = useState(false);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "error" | "success" | "info" | "warning";
  } | null>(null);

  const showToast = (
    text: string,
    type: "error" | "success" | "info" | "warning" = "info",
  ) => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Focus & Collapsible Workspace States
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [timelineCollapsed, setTimelineCollapsed] = useState<boolean>(() => {
    return isMobileDevice();
  });

  const isRightSidebarVisible = !sidebarCollapsed;

  const askConfirm = (message: string): Promise<boolean> => {
    if (pipWindow) {
      return Promise.resolve(pipWindow.confirm(message));
    }
    return confirm(message, { title: "Confirmar Ação" });
  };

  const askAlert = (message: string): Promise<void> => {
    return alert(message);
  };

  // Countdown state and ref
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<any>(null);

  // References & Streams
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const updateScreenStream = (stream: MediaStream | null) => {
    screenStreamRef.current = stream;
    setScreenStream(stream);
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          screenStreamRef.current = null;
          setScreenStream(null);
        };
      }
    }
  };

  const requestScreenShare = async (mode?: CaptureMode, update = true): Promise<MediaStream | null> => {
    try {
      await window.daniloomDesktop?.setCaptureMode(mode || 'choose');
      const res = getRecordingResolutionSetting();
      const idealW = res === "4k" ? 3840 : res === "1080p" ? 1920 : 1280;
      const idealH = res === "4k" ? 2160 : res === "1080p" ? 1080 : 720;
      let stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: idealW },
          height: { ideal: idealH },
          frameRate: { ideal: 60, max: 60 },
        },
        audio: true,
      });
      stream = await cropDesktopStream(stream);
      if (update) updateScreenStream(stream);
      return stream;
    } catch (err: any) {
      console.warn("Screen share request failed or cancelled:", err);
      return null;
    }
  };
  const recordingTimerRef = useRef<any>(null);
  const mainVideoPlayerRef = useRef<HTMLVideoElement | null>(null);
  const canvasAnimRef = useRef<number | null>(null);
  const stopCanvasLoopRef = useRef<() => void>(() => {});
  const micStreamRef = useRef<MediaStream | null>(null);
  const discardRecordingRef = useRef<boolean>(false);
  const isResettingRef = useRef<boolean>(false);
  const isSplittingRef = useRef<boolean>(false);
  const isWaitingNextClipRef = useRef<boolean>(false);
  const activeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isStartingRecordingRef = useRef<boolean>(false);
  const desktopFinishingRef = useRef<Promise<unknown> | null>(null);

  // 1. Check Authentication on Load
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        setAuthChecking(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setAuthChecking(false);
      },
    );

    // Fetch media devices and request permissions on startup
    const requestPermissionsAndEnumerate = async () => {
      let hasVideo = false;
      let hasAudio = false;
      try {
        const initialDevices = await navigator.mediaDevices.enumerateDevices();
        hasVideo = initialDevices.some((d) => d.kind === "videoinput");
        hasAudio = initialDevices.some((d) => d.kind === "audioinput");
      } catch (e) {
        hasVideo = true;
        hasAudio = true;
      }

      if (hasVideo || hasAudio) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({
            video: hasVideo,
            audio: hasAudio,
          });
          tempStream.getTracks().forEach((track) => track.stop());
        } catch (err) {
          // Fallbacks for individual devices
          if (hasVideo) {
            try {
              const tempStream = await navigator.mediaDevices.getUserMedia({
                video: true,
              });
              tempStream.getTracks().forEach((track) => track.stop());
            } catch (vErr) {
              console.warn("Camera request failed:", vErr);
            }
          }
          if (hasAudio) {
            try {
              const tempStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
              });
              tempStream.getTracks().forEach((track) => track.stop());
            } catch (aErr) {
              console.warn("Microphone request failed:", aErr);
            }
          }
        }
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const video = devices.filter(
          (d) => d.kind === "videoinput" && d.deviceId !== "",
        );
        const audio = devices.filter(
          (d) => d.kind === "audioinput" && d.deviceId !== "",
        );
        setVideoDevices(video);
        setAudioDevices(audio);
        if (video.length > 0) {
          setSelectedCamera(video[0].deviceId);
        } else {
          setUseCamera(false);
        }
        const savedMic = localStorage.getItem("daniloom_selected_mic");
        if (
          savedMic &&
          (savedMic === "default" || audio.some((d) => d.deviceId === savedMic))
        ) {
          setSelectedMic(savedMic);
        } else {
          setSelectedMic("default");
        }
      } catch (err) {
        console.error("Failed to enumerate devices:", err);
      }
    };
    requestPermissionsAndEnumerate();

    // Load local clips from IndexedDB on startup
    const loadLocalClips = async () => {
      try {
        const dbClips = await getClipsFromDB();
        if (dbClips && dbClips.length > 0) {
          setClips(dbClips);
          const initialClips = dbClips.filter(
            (c) => (c.format || "landscape") === "landscape",
          );
          if (initialClips.length > 0) {
            setSelectedClip(initialClips[0]);
          } else {
            setSelectedClip(null);
          }
        }
      } catch (err) {
        console.error("Error loading clips on startup:", err);
      } finally {
        dbLoadedRef.current = true;
      }
    };
    loadLocalClips();

    return () => {
      unsubscribe();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Auto-save clips to local IndexedDB whenever they change
  useEffect(() => {
    if (!dbLoadedRef.current) return;

    const syncToDB = async () => {
      try {
        await clearClipsDB();
        for (const clip of clips) {
          await saveClipToDB(clip);
        }
      } catch (err) {
        console.error("Error autosaving clips to IndexedDB:", err);
      }
    };
    syncToDB();
  }, [clips]);

  // 2. Handle Webcam activation for floating camera bubble & live preview
  useEffect(() => {
    let isCancelled = false;
    // We want the camera stream active if useCamera is true OR recordingMode is "camera",
    // so we can show a live preview in the stage box and keep it warm for lag-free recording!
    const needsCamera = useCamera || recordingMode === "camera";
    if (!needsCamera) {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
      return;
    }

    const initCamera = async () => {
      try {
        let videoConstraint: any = true;
        if (selectedCamera) {
          videoConstraint = { deviceId: { exact: selectedCamera } };
        } else if (cameraFacingMode) {
          videoConstraint = { facingMode: { ideal: cameraFacingMode } };
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setCameraStream((prev) => {
          if (prev && prev !== stream) {
            prev.getTracks().forEach((track) => track.stop());
          }
          return stream;
        });
      } catch (err) {
        console.warn("Nenhuma câmera encontrada ou permissão negada:", err);
      }
    };

    initCamera();

    return () => {
      isCancelled = true;
    };
  }, [useCamera, selectedCamera, cameraFacingMode, recordingMode]);

  // 2b. Handle Microphone stream activation for real-time VU meter & volume slider
  useEffect(() => {
    if (!useMic) {
      if (micStreamForVU) {
        micStreamForVU.getTracks().forEach((track) => track.stop());
        setMicStreamForVU(null);
      }
      return;
    }

    let isMounted = true;
    let activeStream: MediaStream | null = null;

    const initMicVU = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio:
            selectedMic && selectedMic !== "default"
              ? { deviceId: { exact: selectedMic } }
              : true,
        });
        if (isMounted) {
          setMicStreamForVU((prev) => {
            if (prev) prev.getTracks().forEach((t) => t.stop());
            return stream;
          });
          activeStream = stream;
        } else {
          stream.getTracks().forEach((t) => t.stop());
        }
      } catch (err) {
        console.warn("Nenhum microfone encontrado ou permissão negada:", err);
        if (isMounted) setMicStreamForVU(null);
      }
    };

    initMicVU();

    return () => {
      isMounted = false;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [useMic, selectedMic]);

  // Helper to check if Picture-in-Picture is supported and permitted in the current context (e.g. not blocked by iframe)
  const checkIfPipAllowed = (): boolean => {
    if (!("documentPictureInPicture" in window)) {
      return false;
    }

    const isInIframe = window.self !== window.top;

    try {
      const doc = document as any;
      const policy = doc.permissionsPolicy || doc.featurePolicy;
      if (policy && typeof policy.allowsFeature === "function") {
        if (!policy.allowsFeature("picture-in-picture")) {
          return false;
        }
      } else if (isInIframe) {
        // Safe fallback for standard sandboxed iframes without policy APIs
        return false;
      }
    } catch (e) {
      if (isInIframe) {
        return false;
      }
    }

    return true;
  };

  const captureScreenShare = async () => {
    try {
      if (recordingMode === "screen" && screenStreamRef.current) {
        const video = document.createElement("video");
        video.srcObject = screenStreamRef.current;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = `screenshot_${new Date().getTime()}.png`;
          a.click();
          showToast("Screenshot capturado com sucesso!", "success");
        }
        video.pause();
        video.srcObject = null;
      } else {
        showToast("Nenhuma tela sendo compartilhada no momento.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao capturar screenshot.", "error");
    }
  };

  // Picture-in-Picture (PiP) Presentation Controller
  const openPip = async () => {
    setIsPipFallbackActive(false);

    if (!checkIfPipAllowed()) {
      // If native PiP is not supported or not allowed (e.g. iframe), fall back silently to the inline widget
      setIsPipFallbackActive(true);
      return;
    }

    try {
      if (pipWindow) {
        try {
          pipWindow.close();
        } catch (e) {}
      }

      const pip = await (window as any).documentPictureInPicture.requestWindow({
        width: 420,
        height: 100,
      });

      // Copy stylesheets so styles are applied
      Array.from(document.querySelectorAll("style")).forEach((styleNode) => {
        try {
          pip.document.head.appendChild(styleNode.cloneNode(true));
        } catch (e) {}
      });

      // Add simple custom styling for body
      const style = pip.document.createElement("style");
      style.textContent = `
 body {
 margin: 0;
 padding: 0;
 background-color: #0c0d0f; /* bg-app */
 color: white;
 font-family: ui-sans-serif, system-ui, sans-serif;
 overflow: hidden;
 display: flex;
 align-items: center;
 justify-content: center;
 height: 100vh;
 }
 `;
      pip.document.head.appendChild(style);

      // Listen for PiP window closed by user
      pip.addEventListener("pagehide", () => {
        setPipWindow(null);
      });

      setPipWindow(pip);
      setIsPipFallbackActive(false);
    } catch (err: any) {
      console.warn(
        "Failed to open PiP window natively, falling back to inline widget:",
        err,
      );
      // Since it failed (e.g. iframe permission or window.open block), use the elegant inline floating widget
      setIsPipFallbackActive(true);
      showToast("Controle flutuante interno ativo.", "info");
    }
  };

  const closePip = () => {
    if (pipWindow) {
      try {
        pipWindow.close();
      } catch (e) {}
      setPipWindow(null);
    }
    setIsPipFallbackActive(false);
  };

  useEffect(() => {
    // Automatically close PiP when recording ends, unless resetting or starting, or if feature flag is disabled
    if (!isFeatureEnabled("pip_widget")) {
      if (pipWindow || isPipFallbackActive) {
        closePip();
      }
    } else if (
      !isRecording &&
      countdown === null &&
      !isStartingRecordingRef.current &&
      (pipWindow || isPipFallbackActive) &&
      !isResettingRef.current &&
      !isSplittingRef.current &&
      !isWaitingNextClip
    ) {
      closePip();
    }
  }, [
    isRecording,
    countdown,
    pipWindow,
    isPipFallbackActive,
    featureFlagsTick,
    isWaitingNextClip,
  ]);

  // Countdown Helper functions
  const startRecordingWithCountdown = async () => {
    if (countdown !== null) return; // Already counting down

    isStartingRecordingRef.current = true;

    // 1. If screen mode, obtain screen stream FIRST
    if (recordingMode === "screen") {
      const existingScreenStream = screenStreamRef.current;
      const isScreenActive =
        existingScreenStream &&
        existingScreenStream
          .getVideoTracks()
          .some((track) => track.readyState === "live");

      if (!isScreenActive) {
        const stream = await requestScreenShare();
        if (!stream) {
          showToast("Compartilhamento de tela cancelado ou negado.", "error");
          isStartingRecordingRef.current = false;
          return; // Do not start countdown
        }
      }
    }

    setCountdown(5);

    // Show floating widget if PiP feature is enabled
    if (isFeatureEnabled("pip_widget")) {
      setIsPipFallbackActive(true);
    }

    let currentCountdown = 5;
    countdownIntervalRef.current = setInterval(() => {
      currentCountdown -= 1;
      if (currentCountdown <= 0) {
        clearInterval(countdownIntervalRef.current!);
        countdownIntervalRef.current = null;
        setCountdown(null);
        startRecording();
      } else {
        setCountdown(currentCountdown);
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    isStartingRecordingRef.current = false;

    // Keep active screen share stream available even if countdown is cancelled
  };

  // 3. Setup Keyboard Shortcuts
  useKeyboardShortcuts(shortcuts, {
    toggleRecord: () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecordingWithCountdown();
      }
    },
    pauseResumeRecord: () => {
      if (isRecording) {
        if (isPaused) {
          resumeRecording();
        } else {
          pauseRecording();
        }
      }
    },
    splitClip: () => {
      if (isRecording) {
        splitClipAndRecordNext();
      }
    },
    cancelRecord: () => {
      if (isRecording) {
        cancelRecording();
      }
    },
    restartRecord: () => {
      if (isRecording) {
        resetRecording();
      }
    },
    restartProject: () => {
      clearCurrentProject();
    },
    deleteProject: () => {
      deleteProject();
    },
    switchScene: (index) => {
      setScenes((currentScenes) => {
        const targetScene = currentScenes[index];
        if (targetScene) {
          setTimeout(() => {
            applyScene(targetScene);
          }, 0);
        }
        return currentScenes;
      });
    },
  });

  // Setup Bluetooth Selfie Remote Trigger (Volume / Media Play keys)
  const { isAudioSessionActive, activateAudioSession } = useBluetoothShutter({
    enabled: isFeatureEnabled("bluetooth_shutter"),
    isRecording,
    onTrigger: () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecordingWithCountdown();
      }
    },
    onFeedback: (msg) => {
      showToast(msg, "info");
    },
  });

  // Action: Sign In
  const handleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        showToast("Login realizado com sucesso!", "success");
      }
    } catch (err: any) {
      console.error("Erro ao fazer login:", err);
      if (err?.code === "auth/popup-blocked") {
        await askAlert(
          "A janela de login foi bloqueada pelo navegador. Permita pop-ups para este site e clique em 'Fazer Login' novamente.",
        );
      } else if (err?.code !== "auth/popup-closed-by-user") {
        await askAlert(
          "Falha ao fazer login: " + (err.message || "Erro desconhecido"),
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Action: Sign Out
  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    window.location.href = "/";
  };

  // Record: Start
  const startRecording = async () => {
    isStartingRecordingRef.current = true;
    setToastMessage(null);
    activeCanvasRef.current = null;
    try {
      await desktopFinishingRef.current;
      const drawRoundedRect = (
        c: CanvasRenderingContext2D,
        rx: number,
        ry: number,
        rw: number,
        rh: number,
        rr: number,
      ) => {
        if (typeof (c as any).roundRect === "function") {
          (c as any).roundRect(rx, ry, rw, rh, rr);
        } else {
          c.moveTo(rx + rr, ry);
          c.lineTo(rx + rw - rr, ry);
          c.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rr);
          c.lineTo(rx + rw, ry + rh - rr);
          c.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rr, ry + rh);
          c.lineTo(rx + rr, ry + rh);
          c.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rr);
          c.lineTo(rx, ry + rr);
          c.quadraticCurveTo(rx, ry, rx + rr, ry);
        }
      };

      let screenStream: MediaStream | null = null;
      let micStream: MediaStream | null = null;
      let finalVideoStreamTrack: MediaStreamTrack;
      let finalAudioStreamTrack: MediaStreamTrack | null = null;
      let stopCanvasLoop = () => {};

      // Retrieve or warm up the camera stream if needed
      let activeCameraStream = cameraStream;
      if ((recordingMode === "camera" || useCamera) && !activeCameraStream) {
        try {
          let videoConstraint: any = true;
          if (selectedCamera) {
            videoConstraint = { deviceId: { exact: selectedCamera } };
          } else if (cameraFacingMode) {
            videoConstraint = { facingMode: { ideal: cameraFacingMode } };
          }
          activeCameraStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraint,
            audio: false,
          });
          setCameraStream(activeCameraStream);
        } catch (err) {
          console.error("Could not activate camera stream:", err);
        }
      }

      if (recordingMode === "camera") {
        // Mode 1: Camera Only (using canvas to record mirrored with constant 30fps to guarantee perfect audio/video sync, and exact aspect ratio preservation)
        if (useMic) {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({
              audio:
                selectedMic && selectedMic !== "default"
                  ? { deviceId: { exact: selectedMic } }
                  : true,
            });
          } catch (err) {
            console.warn(
              "Could not get microphone stream for camera-only mode:",
              err,
            );
          }
        }

        // Set up canvas for mirroring webcam stream
        const currentRes = getRecordingResolutionSetting();
        const dims = getRecordingDimensions(
          currentRes,
          recordingFormatRef.current,
        );
        const canvas = document.createElement("canvas");
        activeCanvasRef.current = canvas;
        canvas.width = dims.width;
        canvas.height = dims.height;
        const ctx = canvas.getContext("2d")!;

        const cameraVideo = document.createElement("video");
        cameraVideo.srcObject = activeCameraStream;
        cameraVideo.muted = true;
        cameraVideo.playsInline = true;
        cameraVideo.style.position = "fixed";
        cameraVideo.style.width = `${canvas.width}px`;
        cameraVideo.style.height = `${canvas.height}px`;
        cameraVideo.style.top = "0px";
        cameraVideo.style.left = "0px";
        cameraVideo.style.zIndex = "-9999";
        cameraVideo.style.opacity = "1";
        cameraVideo.style.transform = "scale(0.001)";
        cameraVideo.style.pointerEvents = "none";
        document.body.appendChild(cameraVideo);
        await cameraVideo
          .play()
          .catch((e) => console.warn("cameraVideo play error:", e));

        let isDrawing = true;
        const draw = () => {
          if (!isDrawing) return;

          const shape = cameraShapeRef.current;
          const isCircle = shape === "circle";
          const isRect = shape === "rectangle";

          // 1. Draw customizable background if NOT full-screen
          if (isCircle || isRect) {
            if (screenBgTypeRef.current === "solid") {
              ctx.fillStyle = screenBgValueRef.current;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (screenBgTypeRef.current === "gradient") {
              let grad;
              const val = screenBgValueRef.current;
              if (val === "sunset") {
                grad = ctx.createLinearGradient(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                grad.addColorStop(0, "#f43f5e");
                grad.addColorStop(1, "#8b5cf6");
              } else if (val === "ocean") {
                grad = ctx.createLinearGradient(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                grad.addColorStop(0, "#0ea5e9");
                grad.addColorStop(1, "#10b981");
              } else if (val === "cosmic") {
                grad = ctx.createLinearGradient(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                grad.addColorStop(0, "#6366f1");
                grad.addColorStop(1, "#ec4899");
              } else if (val === "emerald") {
                grad = ctx.createLinearGradient(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                grad.addColorStop(0, "#065f46");
                grad.addColorStop(1, "#022c22");
              } else {
                const parts = val.split(",");
                grad = ctx.createLinearGradient(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                grad.addColorStop(0, parts[0] || "#3b82f6");
                grad.addColorStop(1, parts[1] || "#8b5cf6");
              }
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (screenBgTypeRef.current === "pattern") {
              ctx.fillStyle = "#0c0d0f";
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
              ctx.lineWidth = 1;
              const pVal = screenBgValueRef.current;
              if (pVal === "grid") {
                const gridSize = 40;
                ctx.beginPath();
                for (let x = 0; x < canvas.width; x += gridSize) {
                  ctx.moveTo(x, 0);
                  ctx.lineTo(x, canvas.height);
                }
                for (let y = 0; y < canvas.height; y += gridSize) {
                  ctx.moveTo(0, y);
                  ctx.lineTo(canvas.width, y);
                }
                ctx.stroke();
              } else if (pVal === "dots") {
                ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
                const dotSpacing = 30;
                for (
                  let x = dotSpacing / 2;
                  x < canvas.width;
                  x += dotSpacing
                ) {
                  for (
                    let y = dotSpacing / 2;
                    y < canvas.height;
                    y += dotSpacing
                  ) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                  }
                }
              } else {
                const spacing = 40;
                ctx.beginPath();
                for (let i = -canvas.height; i < canvas.width; i += spacing) {
                  ctx.moveTo(i, 0);
                  ctx.lineTo(i + canvas.height, canvas.height);
                }
                ctx.stroke();
              }
            } else if (screenBgTypeRef.current === "camera") {
              if (cameraVideo && cameraVideo.readyState >= 2) {
                ctx.save();
                const baseBlur = cameraBgBlurAmountRef.current || 24;
                const scaledBlur = Math.round(baseBlur * (canvas.height / 540));
                ctx.filter = `blur(${scaledBlur}px) brightness(0.75)`;
                const scale = 1.15;
                const sw = canvas.width * scale;
                const sh = canvas.height * scale;
                const sx = (canvas.width - sw) / 2;
                const sy = (canvas.height - sh) / 2;
                if (cameraFlipHRef.current) {
                  ctx.translate(canvas.width, 0);
                  ctx.scale(-1, 1);
                }
                ctx.drawImage(cameraVideo, sx, sy, sw, sh);
                ctx.restore();

                ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
              } else {
                ctx.fillStyle = "#0c0d0f";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
              }
            }
          } else {
            ctx.fillStyle = "#0c0d0f";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          if (cameraVideo.readyState >= 2) {
            let cw = canvas.width;
            let ch = canvas.height;
            let cx = canvas.width / 2;
            let cy = canvas.height / 2;
            let radius = 220;

            if (isCircle) {
              const bSize = bubbleSizeRef.current;
              radius = bSize === "sm" ? 300 : bSize === "md" ? 440 : 600;
              cw = radius * 2;
              ch = radius * 2;
            } else if (isRect) {
              const bSize = bubbleSizeRef.current;
              cw = bSize === "sm" ? 800 : bSize === "md" ? 1200 : 1600;
              ch = bSize === "sm" ? 600 : bSize === "md" ? 900 : 1200;
            }

            ctx.save();
            ctx.filter = getCanvasFilterString(
              cameraFilterRef.current,
              cameraBrightnessRef.current,
              cameraContrastRef.current,
              cameraShadowRef.current,
              cameraBlackPointRef.current,
              studioLightEnabledRef.current,
              studioLightIntensityRef.current,
            );
            ctx.beginPath();
            if (isCircle) {
              ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            } else if (isRect) {
              drawRoundedRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 24);
            } else {
              ctx.rect(0, 0, canvas.width, canvas.height);
            }
            ctx.closePath();
            ctx.clip();

            ctx.translate(cx, cy);
            ctx.scale(
              cameraFlipHRef.current ? -1 : 1,
              cameraFlipVRef.current ? -1 : 1,
            );

            const vw = cameraVideo.videoWidth || 1280;
            const vh = cameraVideo.videoHeight || 720;
            const scale = Math.max(cw / vw, ch / vh);
            const w = vw * scale;
            const h = vh * scale;
            const cameraDrawable = cameraBlurEnabledRef.current
              ? processVideoBackgroundBlur(
                  cameraVideo,
                  cameraBgBlurAmountRef.current,
                )
              : cameraVideo;

            const drawX =
              -w / 2 + ((50 - cameraOffsetXRef.current) / 100) * (w - cw);
            const drawY =
              -h / 2 + ((50 - cameraOffsetYRef.current) / 100) * (h - ch);

            ctx.drawImage(cameraDrawable, drawX, drawY, w, h);
            ctx.restore();

            // Draw border matching compact/medium screens if shape is circle or rectangle
            if (isCircle || isRect) {
              ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              if (isCircle) {
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
              } else {
                drawRoundedRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 24);
              }
              ctx.stroke();
            }

            if (showSpeakerNameRef.current && speakerNameRef.current.trim()) {
              let badgeX = cx;
              let badgeY = cy;
              if (isCircle) {
                badgeY = cy + radius + 22;
              } else if (isRect) {
                badgeY = cy + ch / 2 + 22;
              } else {
                badgeX = canvas.width / 2;
                badgeY = canvas.height - 50;
              }
              drawSpeakerNameBadge(ctx, speakerNameRef.current, badgeX, badgeY);
            }
          }
        };

        // Run drawing loop at 30 FPS using Web Worker with RAF fallback
        isDrawing = true;
        let tickerWorker: Worker | null = null;
        let tickerRaf: number | null = null;

        try {
          const workerCode = `
 let timer;
 self.onmessage = function(e) {
 if (e.data === 'start') {
 self.postMessage('tick');
 } else if (e.data === 'next') {
 timer = setTimeout(() => {
 self.postMessage('tick');
 }, 1000 / 30);
 } else if (e.data === 'stop') {
 clearTimeout(timer);
 }
 };
 `;
          const workerBlob = new Blob([workerCode], {
            type: "application/javascript",
          });
          const worker = new Worker(URL.createObjectURL(workerBlob));
          tickerWorker = worker;
          worker.onmessage = () => {
            if (isDrawing) {
              draw();
              worker.postMessage("next");
            }
          };
          worker.postMessage("start");
        } catch (e) {
          const tick = () => {
            if (!isDrawing) return;
            draw();
            tickerRaf = requestAnimationFrame(tick);
          };
          tickerRaf = requestAnimationFrame(tick);
        }

        const canvasStream = canvas.captureStream(30);
        finalVideoStreamTrack = canvasStream.getVideoTracks()[0];

        if (micStream) {
          const audioTracks = micStream.getAudioTracks();
          if (audioTracks.length > 0) {
            finalAudioStreamTrack = audioTracks[0];
          }
        }

        stopCanvasLoop = () => {
          isDrawing = false;
          if (tickerWorker) {
            try {
              tickerWorker.postMessage("stop");
              tickerWorker.terminate();
            } catch (e) {}
          }
          if (tickerRaf !== null) {
            cancelAnimationFrame(tickerRaf);
          }
          cameraVideo.pause();
          cameraVideo.srcObject = null;
          cameraVideo.remove();
          if (micStream) {
            micStream.getTracks().forEach((track) => track.stop());
          }
          // Do not stop the persistent cameraStream so the live preview stays active
        };
      } else {
        // Mode 2: Screen Recording (with optional webcam composite)
        // 1. Get screen capture stream - Reuse if active to avoid asking user again
        const existingScreenStream = screenStreamRef.current;
        const isScreenActive =
          existingScreenStream &&
          existingScreenStream
            .getVideoTracks()
            .some((track) => track.readyState === "live");

        if (isScreenActive) {
          screenStream = existingScreenStream!;
          setScreenStream(existingScreenStream);
        } else {
          const stream = await requestScreenShare();
          if (!stream) {
            showToast("Compartilhamento de tela cancelado ou negado.", "error");
            isStartingRecordingRef.current = false;
            return;
          }
          screenStream = stream;
        }

        // 2. Get microphone audio if enabled
        if (useMic) {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({
              audio:
                selectedMic && selectedMic !== "default"
                  ? { deviceId: { exact: selectedMic } }
                  : true,
            });
          } catch (err) {
            console.warn("Failed to get mic stream:", err);
          }
        }

        // 3. Setup canvas-based webcam + screen composite if camera, custom background, or custom screen layout is enabled
        let activeCameraStream = cameraStream;
        if (useCamera && !activeCameraStream) {
          try {
            let videoConstraint: any = true;
            if (selectedCamera) {
              videoConstraint = { deviceId: { exact: selectedCamera } };
            } else if (cameraFacingMode) {
              videoConstraint = { facingMode: { ideal: cameraFacingMode } };
            }
            activeCameraStream = await navigator.mediaDevices.getUserMedia({
              video: videoConstraint,
              audio: false,
            });
            setCameraStream(activeCameraStream);
          } catch (err) {
            console.warn(
              "Could not activate camera for canvas recording: ",
              err,
            );
          }
        }

        // We use canvas composite if webcam is active, OR screen background is customized, OR screen size is medium/compact, OR custom cropping is enabled
        const needsCanvasComposite =
          useCamera ||
          screenSize !== "full" ||
          screenBgType !== "solid" ||
          screenBgValue !== "#0c0d0f" ||
          isCustomCropEnabledRef.current;

        if (needsCanvasComposite) {
          const currentRes = getRecordingResolutionSetting();
          const dims = getRecordingDimensions(
            currentRes,
            recordingFormatRef.current,
          );
          const canvas = document.createElement("canvas");
          activeCanvasRef.current = canvas;
          canvas.width = dims.width;
          canvas.height = dims.height;
          const ctx = canvas.getContext("2d")!;

          const screenVideo = document.createElement("video");
          screenVideo.srcObject = screenStream;
          screenVideo.muted = true;
          screenVideo.playsInline = true;
          screenVideo.style.position = "fixed";
          screenVideo.style.width = `${dims.width}px`;
          screenVideo.style.height = `${dims.height}px`;
          screenVideo.style.top = "0px";
          screenVideo.style.left = "0px";
          screenVideo.style.zIndex = "-9999";
          screenVideo.style.opacity = "1";
          screenVideo.style.transform = "scale(0.001)";
          screenVideo.style.pointerEvents = "none";
          document.body.appendChild(screenVideo);
          await screenVideo
            .play()
            .catch((e) => console.warn("screenVideo.play error", e));

          let cameraVideo: HTMLVideoElement | null = null;
          if (useCamera && activeCameraStream) {
            cameraVideo = document.createElement("video");
            cameraVideo.srcObject = activeCameraStream;
            cameraVideo.muted = true;
            cameraVideo.playsInline = true;
            cameraVideo.style.position = "fixed";
            cameraVideo.style.width = "1280px";
            cameraVideo.style.height = "720px";
            cameraVideo.style.top = "0px";
            cameraVideo.style.left = "0px";
            cameraVideo.style.zIndex = "-9999";
            cameraVideo.style.opacity = "1";
            cameraVideo.style.transform = "scale(0.001)";
            cameraVideo.style.pointerEvents = "none";
            document.body.appendChild(cameraVideo);
            await cameraVideo
              .play()
              .catch((e) => console.warn("cameraVideo.play error", e));
          }

          let isDrawing = true;

          const draw = () => {
            if (!isDrawing) return;

            // 1. Draw customizable background
            if (screenBgTypeRef.current === "solid") {
              ctx.fillStyle = screenBgValueRef.current;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (screenBgTypeRef.current === "gradient") {
              let grad;
              const val = screenBgValueRef.current;
              if (val === "sunset") {
                grad = ctx.createLinearGradient(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                grad.addColorStop(0, "#f43f5e");
                grad.addColorStop(1, "#8b5cf6");
              } else if (val === "ocean") {
                grad = ctx.createLinearGradient(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                grad.addColorStop(0, "#0ea5e9");
                grad.addColorStop(1, "#10b981");
              } else if (val === "cosmic") {
                grad = ctx.createLinearGradient(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                grad.addColorStop(0, "#6366f1");
                grad.addColorStop(1, "#ec4899");
              } else if (val === "emerald") {
                grad = ctx.createLinearGradient(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                grad.addColorStop(0, "#065f46");
                grad.addColorStop(1, "#022c22");
              } else {
                const parts = val.split(",");
                grad = ctx.createLinearGradient(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                grad.addColorStop(0, parts[0] || "#3b82f6");
                grad.addColorStop(1, parts[1] || "#8b5cf6");
              }
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (screenBgTypeRef.current === "pattern") {
              ctx.fillStyle = "#0c0d0f";
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
              ctx.lineWidth = 1;
              const pVal = screenBgValueRef.current;
              if (pVal === "grid") {
                const gridSize = 40;
                ctx.beginPath();
                for (let x = 0; x < canvas.width; x += gridSize) {
                  ctx.moveTo(x, 0);
                  ctx.lineTo(x, canvas.height);
                }
                for (let y = 0; y < canvas.height; y += gridSize) {
                  ctx.moveTo(0, y);
                  ctx.lineTo(canvas.width, y);
                }
                ctx.stroke();
              } else if (pVal === "dots") {
                ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
                const dotSpacing = 30;
                for (
                  let x = dotSpacing / 2;
                  x < canvas.width;
                  x += dotSpacing
                ) {
                  for (
                    let y = dotSpacing / 2;
                    y < canvas.height;
                    y += dotSpacing
                  ) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                  }
                }
              } else {
                const spacing = 40;
                ctx.beginPath();
                for (let i = -canvas.height; i < canvas.width; i += spacing) {
                  ctx.moveTo(i, 0);
                  ctx.lineTo(i + canvas.height, canvas.height);
                }
                ctx.stroke();
              }
            } else if (screenBgTypeRef.current === "camera") {
              if (cameraVideo && cameraVideo.readyState >= 2) {
                ctx.save();
                const baseBlur = cameraBgBlurAmountRef.current || 24;
                const scaledBlur = Math.round(baseBlur * (canvas.height / 540));
                ctx.filter = `blur(${scaledBlur}px) brightness(0.75)`;
                const scale = 1.15;
                const sw = canvas.width * scale;
                const sh = canvas.height * scale;
                const sx = (canvas.width - sw) / 2;
                const sy = (canvas.height - sh) / 2;
                if (cameraFlipHRef.current) {
                  ctx.translate(canvas.width, 0);
                  ctx.scale(-1, 1);
                }
                ctx.drawImage(cameraVideo, sx, sy, sw, sh);
                ctx.restore();

                ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
              } else {
                ctx.fillStyle = "#0c0d0f";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
              }
            }

            // 2. Draw layers
            let shape = cameraShapeRef.current;
            if (
              recordingFormatRef.current === "portrait" &&
              recordingModeRef.current === "screen" &&
              shape !== "centralized" &&
              shape !== "fullscreen"
            ) {
              shape = "split";
            }
            const hasCam =
              useCamera &&
              cameraVideo &&
              cameraVideo.readyState >= 1 &&
              shape !== "hidden";
            const isPortrait = canvas.height > canvas.width;

            if (hasCam && shape === "split") {
              // Split Screen Layout
              const isInverted = splitInvertedRef.current;
              const ratioRaw = isFeatureEnabled("split_screen_control")
                ? splitRatioRef.current
                : 0.5;
              const leftRatio = Math.max(0.1, Math.min(0.9, ratioRaw));
              const rightRatio = 1 - leftRatio;

              let screenW = 0,
                screenH = 0,
                screenX = 0,
                screenY = 0;
              let camW = 0,
                camH = 0,
                camX = 0,
                camY = 0;

              if (isPortrait) {
                // Top / Bottom
                if (!isInverted) {
                  // Top: Screen, Bottom: Camera
                  screenX = 0;
                  screenY = 0;
                  screenW = canvas.width;
                  screenH = canvas.height * leftRatio;

                  camX = 0;
                  camY = canvas.height * leftRatio;
                  camW = canvas.width;
                  camH = canvas.height * rightRatio;
                } else {
                  // Top: Camera, Bottom: Screen
                  camX = 0;
                  camY = 0;
                  camW = canvas.width;
                  camH = canvas.height * leftRatio;

                  screenX = 0;
                  screenY = canvas.height * leftRatio;
                  screenW = canvas.width;
                  screenH = canvas.height * rightRatio;
                }
              } else {
                // Left / Right
                if (!isInverted) {
                  // Left: Screen, Right: Camera
                  screenX = 0;
                  screenY = 0;
                  screenW = canvas.width * leftRatio;
                  screenH = canvas.height;

                  camX = canvas.width * leftRatio;
                  camY = 0;
                  camW = canvas.width * rightRatio;
                  camH = canvas.height;
                } else {
                  // Left: Camera, Right: Screen
                  camX = 0;
                  camY = 0;
                  camW = canvas.width * leftRatio;
                  camH = canvas.height;

                  screenX = canvas.width * leftRatio;
                  screenY = 0;
                  screenW = canvas.width * rightRatio;
                  screenH = canvas.height;
                }
              }

              if (screenVideo.readyState >= 2) {
                ctx.save();
                ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
                ctx.shadowBlur = 24;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 12;
                ctx.fillStyle = "#000000";
                ctx.beginPath();
                drawRoundedRect(ctx, screenX, screenY, screenW, screenH, 0);
                ctx.fill();
                ctx.restore();

                ctx.save();
                ctx.beginPath();
                drawRoundedRect(ctx, screenX, screenY, screenW, screenH, 0);
                ctx.clip();

                const vw = screenVideo.videoWidth;
                const vh = screenVideo.videoHeight;
                if (vw > 0 && vh > 0) {
                  let sx = 0;
                  let sy = 0;
                  let sw = vw;
                  let sh = vh;
                  if (isCustomCropEnabledRef.current) {
                    sx = (cropXPercentRef.current / 100) * vw;
                    sy = (cropYPercentRef.current / 100) * vh;
                    sw = (cropWidthPercentRef.current / 100) * vw;
                    sh = (cropHeightPercentRef.current / 100) * vh;
                  }
                  const scale = Math.max(screenW / sw, screenH / sh);
                  const w = sw * scale;
                  const h = sh * scale;
                  const dx = screenX + (screenW - w) / 2;
                  const dy = screenY + (screenH - h) / 2;
                  ctx.drawImage(screenVideo, sx, sy, sw, sh, dx, dy, w, h);
                }
                ctx.restore();

                ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                drawRoundedRect(ctx, screenX, screenY, screenW, screenH, 16);
                ctx.stroke();
              }

              if (cameraVideo && cameraVideo.readyState >= 1) {
                // Use the calculated camW, camH, camX, camY from above

                ctx.save();
                ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
                ctx.shadowBlur = 24;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 12;
                ctx.fillStyle = "#000000";
                ctx.beginPath();
                drawRoundedRect(ctx, camX, camY, camW, camH, 0);
                ctx.fill();
                ctx.restore();

                ctx.save();
                ctx.filter = getCanvasFilterString(
                  cameraFilterRef.current,
                  cameraBrightnessRef.current,
                  cameraContrastRef.current,
                  cameraShadowRef.current,
                  cameraBlackPointRef.current,
                  studioLightEnabledRef.current,
                  studioLightIntensityRef.current,
                );
                ctx.beginPath();
                drawRoundedRect(ctx, camX, camY, camW, camH, 0);
                ctx.clip();

                ctx.translate(camX + camW / 2, camY + camH / 2);
                ctx.scale(
                  cameraFlipHRef.current ? -1 : 1,
                  cameraFlipVRef.current ? -1 : 1,
                );

                const vw = (cameraVideo ? cameraVideo.videoWidth : 640) || 640;
                const vh = (cameraVideo ? cameraVideo.videoHeight : 480) || 480;
                const scale = Math.max(camW / vw, camH / vh);
                const w = vw * scale;
                const h = vh * scale;

                const drawX =
                  -w / 2 + ((50 - cameraOffsetXRef.current) / 100) * (w - camW);
                const drawY =
                  -h / 2 + ((50 - cameraOffsetYRef.current) / 100) * (h - camH);

                if (cameraVideo) {
                  const cameraDrawable = cameraBlurEnabledRef.current
                    ? processVideoBackgroundBlur(
                        cameraVideo,
                        cameraBgBlurAmountRef.current,
                      )
                    : cameraVideo;
                  ctx.drawImage(cameraDrawable, drawX, drawY, w, h);
                }
                ctx.restore();

                ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                drawRoundedRect(ctx, camX, camY, camW, camH, 16);
                ctx.stroke();

                if (
                  showSpeakerNameRef.current &&
                  speakerNameRef.current.trim()
                ) {
                  const badgeX = camX + camW / 2;
                  const badgeY = camY + camH - 40;
                  drawSpeakerNameBadge(
                    ctx,
                    speakerNameRef.current,
                    badgeX,
                    badgeY,
                  );
                }
              }
            } else {
              // Standard overlay/picture-in-picture
              if (screenVideo.readyState >= 2) {
                const vw = screenVideo.videoWidth;
                const vh = screenVideo.videoHeight;
                if (vw > 0 && vh > 0) {
                  let sx = 0;
                  let sy = 0;
                  let sw = vw;
                  let sh = vh;
                  if (isCustomCropEnabledRef.current) {
                    sx = (cropXPercentRef.current / 100) * vw;
                    sy = (cropYPercentRef.current / 100) * vh;
                    sw = (cropWidthPercentRef.current / 100) * vw;
                    sh = (cropHeightPercentRef.current / 100) * vh;
                  }
                  const isCentralized =
                    recordingFormatRef.current === "portrait" &&
                    shape === "centralized";
                  const isFullscreen = shape === "fullscreen";
                  const scaleFactor =
                    screenSizeRef.current === "medium"
                      ? 0.9
                      : screenSizeRef.current === "compact"
                        ? 0.8
                        : 1.0;
                  const baseScale = isFullscreen
                    ? Math.max(canvas.width / sw, canvas.height / sh)
                    : isCentralized
                      ? canvas.height / sh
                      : Math.min(canvas.width / sw, canvas.height / sh);
                  const scale =
                    isFullscreen || isCentralized
                      ? baseScale
                      : baseScale * scaleFactor;

                  const w = sw * scale;
                  const h = sh * scale;
                  const dx = (canvas.width - w) / 2;
                  const dy = (canvas.height - h) / 2;

                  if (scaleFactor < 1.0) {
                    ctx.save();
                    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                    ctx.shadowBlur = 30;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 15;
                    ctx.fillStyle = "#000000";
                    ctx.beginPath();
                    drawRoundedRect(ctx, dx, dy, w, h, 12);
                    ctx.fill();
                    ctx.restore();

                    ctx.save();
                    ctx.beginPath();
                    drawRoundedRect(ctx, dx, dy, w, h, 12);
                    ctx.clip();
                    ctx.drawImage(screenVideo, sx, sy, sw, sh, dx, dy, w, h);
                    ctx.restore();

                    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    drawRoundedRect(ctx, dx, dy, w, h, 12);
                    ctx.stroke();
                  } else {
                    ctx.drawImage(screenVideo, sx, sy, sw, sh, dx, dy, w, h);
                  }
                }
              }

              if (hasCam) {
                ctx.save();
                ctx.filter = getCanvasFilterString(
                  cameraFilterRef.current,
                  cameraBrightnessRef.current,
                  cameraContrastRef.current,
                  cameraShadowRef.current,
                  cameraBlackPointRef.current,
                  studioLightEnabledRef.current,
                  studioLightIntensityRef.current,
                );

                let cw = 360;
                let ch = 360;
                let radius = 180;
                const margin = 30;
                let cx = margin + cw / 2;
                let cy = canvas.height - margin - ch / 2;

                const bSize = bubbleSizeRef.current;
                if (shape === "fullscreen") {
                  cw = canvas.width;
                  ch = canvas.height;
                  cx = canvas.width / 2;
                  cy = canvas.height / 2;
                } else if (shape === "circle") {
                  radius = bSize === "sm" ? 120 : bSize === "md" ? 180 : 240;
                  cw = radius * 2;
                  ch = radius * 2;
                } else {
                  cw = bSize === "sm" ? 320 : bSize === "md" ? 480 : 640;
                  ch = bSize === "sm" ? 240 : bSize === "md" ? 360 : 480;
                }

                const pos = cameraPositionRef.current;
                if (recordingFormatRef.current === "portrait") {
                  cx = canvas.width / 2;
                  cy = canvas.height - margin - ch / 2;
                } else if (pos === "bottom-left") {
                  cx = margin + cw / 2;
                  cy = canvas.height - margin - ch / 2;
                } else if (pos === "bottom-right") {
                  cx = canvas.width - margin - cw / 2;
                  cy = canvas.height - margin - ch / 2;
                } else if (pos === "top-left") {
                  cx = margin + cw / 2;
                  cy = margin + ch / 2;
                } else if (pos === "top-right") {
                  cx = canvas.width - margin - cw / 2;
                  cy = margin + ch / 2;
                } else if (pos === "bottom-center") {
                  cx = canvas.width / 2;
                  cy = canvas.height - margin - ch / 2;
                } else if (pos === "top-center") {
                  cx = canvas.width / 2;
                  cy = margin + ch / 2;
                }

                ctx.beginPath();
                if (shape === "circle") {
                  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                } else {
                  drawRoundedRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 16);
                }
                ctx.closePath();
                ctx.clip();

                ctx.translate(cx, cy);
                ctx.scale(
                  cameraFlipHRef.current ? -1 : 1,
                  cameraFlipVRef.current ? -1 : 1,
                );

                const cvw = (cameraVideo ? cameraVideo.videoWidth : 640) || 640;
                const cvh =
                  (cameraVideo ? cameraVideo.videoHeight : 480) || 480;
                const scale = Math.max(cw / cvw, ch / cvh);
                const drawW = cvw * scale;
                const drawH = cvh * scale;

                const drawX =
                  -drawW / 2 +
                  ((50 - cameraOffsetXRef.current) / 100) * (drawW - cw);
                const drawY =
                  -drawH / 2 +
                  ((50 - cameraOffsetYRef.current) / 100) * (drawH - ch);

                if (cameraVideo) {
                  const cameraDrawable = cameraBlurEnabledRef.current
                    ? processVideoBackgroundBlur(
                        cameraVideo,
                        cameraBgBlurAmountRef.current,
                      )
                    : cameraVideo;
                  ctx.drawImage(cameraDrawable, drawX, drawY, drawW, drawH);
                }
                ctx.restore();

                ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                if (shape === "circle") {
                  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                } else {
                  drawRoundedRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 16);
                }
                ctx.stroke();

                if (
                  showSpeakerNameRef.current &&
                  speakerNameRef.current.trim()
                ) {
                  let badgeX = cx;
                  let badgeY = cy;
                  if (shape === "circle") {
                    badgeY = cy + radius + 20;
                  } else {
                    badgeY = cy + ch / 2 + 20;
                  }
                  if (badgeY > canvas.height - 15) {
                    if (shape === "circle") {
                      badgeY = cy - radius - 20;
                    } else {
                      badgeY = cy - ch / 2 - 20;
                    }
                  }
                  drawSpeakerNameBadge(
                    ctx,
                    speakerNameRef.current,
                    badgeX,
                    badgeY,
                  );
                }
              }
            }
          };

          let tickerWorker: Worker | null = null;
          let tickerRaf: number | null = null;

          try {
            const workerCode = `
 let timer;
 self.onmessage = function(e) {
 if (e.data === 'start') {
 self.postMessage('tick');
 } else if (e.data === 'next') {
 timer = setTimeout(() => {
 self.postMessage('tick');
 }, 1000 / 30);
 } else if (e.data === 'stop') {
 clearTimeout(timer);
 }
 };
 `;
            const workerBlob = new Blob([workerCode], {
              type: "application/javascript",
            });
            const worker = new Worker(URL.createObjectURL(workerBlob));
            tickerWorker = worker;
            worker.onmessage = () => {
              if (isDrawing) {
                draw();
                worker.postMessage("next");
              }
            };
            worker.postMessage("start");
          } catch (e) {
            const tick = () => {
              if (!isDrawing) return;
              draw();
              tickerRaf = requestAnimationFrame(tick);
            };
            tickerRaf = requestAnimationFrame(tick);
          }

          const canvasStream = canvas.captureStream(30);
          finalVideoStreamTrack = canvasStream.getVideoTracks()[0];

          stopCanvasLoop = () => {
            isDrawing = false;
            if (tickerWorker) {
              try {
                tickerWorker.postMessage("stop");
                tickerWorker.terminate();
              } catch (e) {}
            }
            if (tickerRaf !== null) {
              cancelAnimationFrame(tickerRaf);
            }
            screenVideo.pause();
            screenVideo.srcObject = null;
            screenVideo.remove();
            if (cameraVideo) {
              cameraVideo.pause();
              cameraVideo.srcObject = null;
              cameraVideo.remove();
            }
          };
        } else {
          finalVideoStreamTrack = screenStream.getVideoTracks()[0];
        }
      }

      stopCanvasLoopRef.current = stopCanvasLoop;

      // 4. Build recording stream & Configure MediaRecorder via RecordingEngine
      const currentRes = getRecordingResolutionSetting();
      const currentProfile = getRecordingQualityProfileSetting();
      const targetBitrate = getRecordingBitrate(currentRes, currentProfile);

      const desktopProjectId = localStorage.getItem('daniloom_active_project_id');
      const desktopProjectName = localStorage.getItem('daniloom_active_project_name') || 'Projeto';
      const engine = new RecordingEngine();
      const recorder = engine.initialize({
        desktopProject: desktopProjectId ? { id: desktopProjectId, name: desktopProjectName } : null,
        videoTrack: finalVideoStreamTrack,
        recordingMode,
        finalAudioTrack: finalAudioStreamTrack,
        screenStream,
        micStream,
        videoBitsPerSecond: targetBitrate,
        initialMicGain: micGainRef.current,
        onGainNodeCreated: (node) => {
          recordingGainNodeRef.current = node;
        },
      });

      mediaRecorderRef.current = recorder;
      const chunks = engine.getChunks();
      const mimeType = engine.getMimeType();

      let durationInSeconds = 0;

      recorder.onstop = async () => {
        const desktopFinish = engine.finishDesktopRecording(discardRecordingRef.current).catch((error) => {
          showToast('Falha na cópia em disco. Exporte o clipe pelo Studio: ' + error.message, 'error');
        });
        desktopFinishingRef.current = desktopFinish;
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          await desktopFinish;

          if (isResettingRef.current) {
            isResettingRef.current = false;
            // Preserve screen stream track to avoid asking user to pick screen again
            if (micStream)
              micStream.getTracks().forEach((track) => track.stop());
          } else {
            // Stop recording microphone, but keep active screen stream for future recordings
            if (micStream)
              micStream.getTracks().forEach((track) => track.stop());
          }

          // Stop the canvas drawing loop and clean up video elements
          stopCanvasLoopRef.current();
          engine.cleanupAudioContext();

          // Reset recording duration
          setRecordingDuration(0);
          return;
        }

        let thumbUrl = "";
        if (activeCanvasRef.current) {
          try {
            thumbUrl = activeCanvasRef.current.toDataURL("image/jpeg", 0.5);
          } catch (e) {
            console.warn("Could not capture thumbnail from active canvas:", e);
          }
        }

        const videoBlob = engine.buildBlob();
        await desktopFinish;
        const videoUrl = URL.createObjectURL(videoBlob);

        if (!thumbUrl) {
          try {
            thumbUrl = await generateVideoThumbnail(videoUrl);
          } catch (e) {
            console.warn("Could not capture video fallback thumbnail:", e);
          }
        }

        const currentFormat = recordingFormatRef.current;
        const newClip: Clip = {
            id: crypto.randomUUID(),
            name: `Clipe ${clips.filter((c) => (c.format || 'landscape') === currentFormat).length + 1}`,
            url: videoUrl,
            blob: videoBlob,
            duration: durationInSeconds || 1,
            createdAt: new Date(),
            thumbnailUrl: thumbUrl || "",
            format: currentFormat,
          };
        setClips((prev) => [...prev, newClip]);
        setSelectedClip(newClip);
        setTimeout(() => { void window.daniloomDesktop?.recordingComplete(isWaitingNextClipRef.current); }, 0);
        setTimelineCollapsed(false);
        if (window.daniloomDesktop && desktopProjectId) {
          void syncDesktopClip(newClip, desktopProjectId).then(() => {
            showToast('Gravação enviada ao projeto. Disponível também no navegador.', 'success');
          }).catch((error) => {
            showToast('Gravação salva no Mac. ' + error.message + ' Use “Enviar ao projeto” para tentar novamente.', 'error');
          });
        }

        // Reset recording duration
        setRecordingDuration(0);

        // Stop recording-specific microphone track, but keep screenStream active
        if (micStream) micStream.getTracks().forEach((track) => track.stop());

        // Stop the canvas drawing loop and clean up video elements
        stopCanvasLoopRef.current();
        engine.cleanupAudioContext();
      };

      // 6. Start Recording
      setIsRecording(true);
      setIsPaused(false);
      setIsWaitingNextClip(false);
      isWaitingNextClipRef.current = false;
      setRecordingDuration(0);

      // Delay the actual recorder start by a few milliseconds so React's heavy
      // UI re-render doesn't block the main thread and freeze the first few frames
      setTimeout(() => {
        if (recorder.state === "inactive") {
          recorder.start(window.daniloomDesktop ? 1000 : undefined);
          if (soundEffectsEnabled) playRecordStartSound();
        }
        isStartingRecordingRef.current = false;
      }, 150);

      // Start timer using local counter to avoid stale closure in recorder.onstop
      recordingTimerRef.current = setInterval(() => {
        durationInSeconds++;
        setRecordingDuration(durationInSeconds);
      }, 1000);

      // Automatically handle stop if display sharing is closed externally
      if (screenStream) {
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        screenVideoTrack.onended = () => {
          stopRecording();
        };
      }
    } catch (err: any) {
      console.error(err);
      isStartingRecordingRef.current = false;
      showToast(
        "Erro ao iniciar gravação: " + (err.message || "Permissão negada."),
        "error",
      );
    }
  };

  // Record: Pause
  const pauseRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  // Record: Resume (or Start Next Clip if paused after saving previous clip)
  const resumeRecording = () => {
    if (
      isWaitingNextClipRef.current ||
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    ) {
      isWaitingNextClipRef.current = false;
      setIsWaitingNextClip(false);
      setIsPaused(false);
      startRecording();
      return;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  // Record: Split & Save Current Clip to timeline, then pause and wait for manual Play to start next clip
  const splitClipAndRecordNext = () => {
    if (isWaitingNextClipRef.current) {
      showToast(
        "O clipe anterior já foi salvo. Clique no Play para iniciar a próxima gravação.",
        "info",
      );
      return;
    }

    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    ) {
      showToast("Nenhuma gravação em andamento para salvar clipe.", "info");
      return;
    }

    if (soundEffectsEnabled) playRecordStopSound();
    isSplittingRef.current = true;
    isWaitingNextClipRef.current = true;
    setIsWaitingNextClip(true);

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    try {
      mediaRecorderRef.current.stop();
    } catch (err) {
      console.error("Error stopping media recorder for clip split:", err);
    }

    setIsRecording(true);
    setIsPaused(true);
    setRecordingDuration(0);
    showToast(
      "Clipe salvo na timeline! Gravação pausada. Clique no Play para gravar o próximo.",
      "success",
    );

    setTimeout(() => {
      isSplittingRef.current = false;
    }, 400);
  };

  // Record: Stop
  const stopRecording = () => {
    if (isWaitingNextClipRef.current) void window.daniloomDesktop?.recordingComplete(false);
    if (soundEffectsEnabled) playRecordStopSound();
    isWaitingNextClipRef.current = false;
    setIsWaitingNextClip(false);
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    }
    // Delay the UI state update to allow the MediaRecorder to flush its final frames
    // smoothly without the main thread being blocked by React rendering.
    setTimeout(() => {
      setIsRecording(false);
      setIsPaused(false);
      setIsWaitingNextClip(false);
      isWaitingNextClipRef.current = false;
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }, 150);
  };

  // Record: Reset/Restart without saving
  const resetRecording = async (skipConfirmation = false) => {
    const confirmReset = skipConfirmation || await askConfirm(
      "Deseja descartar a gravação atual e iniciar uma nova imediatamente?",
    );
    if (!confirmReset) return;

    isWaitingNextClipRef.current = false;
    setIsWaitingNextClip(false);
    discardRecordingRef.current = mediaRecorderRef.current?.state !== "inactive";
    isResettingRef.current = true;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error("Error stopping media recorder during reset:", err);
      }
    }

    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);

    setTimeout(() => {
      startRecording();
    }, 350);
  };

  // Record: Cancel and discard without saving
  const cancelRecording = async (skipConfirmation = false) => {
    const confirmCancel = skipConfirmation || await askConfirm(
      "Deseja cancelar esta gravação e descartar o vídeo atual?",
    );
    if (!confirmCancel) return;

    if (isWaitingNextClipRef.current) {
      discardRecordingRef.current = false;
      isWaitingNextClipRef.current = false;
      setIsWaitingNextClip(false);
      setIsRecording(false);
      setIsPaused(false);
      setRecordingDuration(0);
      return;
    }

    discardRecordingRef.current = true;
    isResettingRef.current = false;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error("Error stopping media recorder during cancel:", err);
      }
    }

    setIsRecording(false);
    setIsPaused(false);
    setIsWaitingNextClip(false);
    isWaitingNextClipRef.current = false;
    setRecordingDuration(0);
  };

  // Helper: Get active video URL for audio operations
  function getCurrentVideoUrl() {
    if (selectedClip?.url) {
      return selectedClip.url;
    }
    if (mergedVideoUrl) {
      return mergedVideoUrl;
    }
    if (currentClips.length > 0) {
      return currentClips[0].url;
    }
    if (clips.length > 0) {
      return clips[0].url;
    }
    return null;
  }

  const {
    isReplacingAudio,
    replaceAudioProgress,
    isMerging,
    mergeProgress,
    isMergingToTimeline,
    mergeTimelineProgress,
    handleAudioUpload,
    handleReorderClips,
    handleRenameClip,
    handleRemoveClip,
    handleClearClips,
    handleMergeClips,
    handleMergeClipsToTimeline,
    takeScreenshot,
    setIsMerging,
    setMergeProgress,
  } = useVideoManipulation({
    clips,
    setClips,
    currentClips,
    selectedClip,
    setSelectedClip,
    getCurrentVideoUrl,
    mergedVideoUrl,
    setMergedVideo,
    setMergedVideoUrl,
    recordingFormat,
    exportConfig,
    enhanceAudio,
    exportWithSubtitles,
    subtitles,
    subtitleConfig,
    mainVideoPlayerRef,
    showToast,
    askAlert,
  });

  const handleDownloadClip = (clip: Clip) => {
    const link = document.createElement("a");
    link.href = clip.url;
    let safeName = (clip.name || "clip").replace(/[^a-zA-Z0-9_\-]/g, "_");
    safeName = safeName.replace(/\.(webm|mp4|mov|mkv)$/i, "");
    link.download = `${safeName}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Clipe "${clip.name}" baixado em MP4.`, "success");
  };

  const handleMergeAndDownload = async () => {
    if (currentClips.length === 0) {
      showToast("Grave pelo menos um clipe para exportar.", "info");
      return;
    }
    if (currentClips.length === 1) {
      handleDownloadClip(currentClips[0]);
      return;
    }
    try {
      if (mainVideoPlayerRef.current) {
        mainVideoPlayerRef.current.pause();
      }
    } catch (e) {}
    setIsMerging(true);
    setMergeProgress(0);
    try {
      const mergedBlob = await mergeVideoClips(
        currentClips,
        {
          format: exportConfig.format,
          quality: exportConfig.quality,
          aspectRatio: recordingFormat,
          enhanceAudio: false,
          subtitles: [],
          subtitleConfig,
        },
        (progress) => setMergeProgress(progress),
      );
      const url = URL.createObjectURL(mergedBlob);
      setMergedVideo(mergedBlob);
      setMergedVideoUrl(url);
      const link = document.createElement("a");
      link.href = url;
      const name =
        exportName.trim().replace(/[^a-zA-Z0-9_\-]/g, "_").replace(/\.(webm|mp4|mov|mkv)$/i, "") || "video_final";
      link.download = `${name}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Clipes mesclados e baixados em MP4.", "success");
    } catch (err: any) {
      console.error(err);
      await askAlert("Erro ao mesclar os clipes: " + err.message);
    } finally {
      setIsMerging(false);
      setMergeProgress(0);
    }
  };

  // Action: Download active video's audio only as .wav
  const downloadVideoAudio = async () => {
    const url = getCurrentVideoUrl();
    if (!url) {
      await askAlert("Nenhum vídeo disponível para extrair áudio.");
      return;
    }

    setIsDownloadingAudio(true);
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();

      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const wavBlob = bufferToWav(audioBuffer);

      const link = document.createElement("a");
      link.href = URL.createObjectURL(wavBlob);
      const name =
        selectedClip?.name ||
        (mergedVideoUrl
          ? "video_mesclado_audio"
          : currentClips[0]?.name || clips[0]?.name || "video_audio");
      link.download = `${name.replace(/\.[^/.]+$/, "")}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await audioCtx.close();
      showToast("Áudio exportado com sucesso!", "success");
    } catch (err: any) {
      console.error("Erro ao baixar áudio:", err);
      await askAlert("Erro ao extrair e baixar o áudio: " + err.message);
    } finally {
      setIsDownloadingAudio(false);
    }
  };

  // Helper to convert Blob to Base64
  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Index = result.indexOf("base64,");
        if (base64Index !== -1) {
          resolve(result.substring(base64Index + 7));
        } else {
          resolve(result.split(",")[1]);
        }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });
  };

  // Register Drive Token Interceptor & refresh handler
  useEffect(() => {
    setDriveTokenRefreshHandler(async () => {
      try {
        const renewed = await renewGoogleDriveToken();
        if (renewed?.token) {
          setToken(renewed.token);
          return renewed.token;
        }
      } catch (err) {
        console.warn(
          "Auto-refresh de token Google Drive via interceptor falhou:",
          err,
        );
      }
      return null;
    });

    const handleRenewed = (e: any) => {
      if (e.detail?.token) {
        setToken(e.detail.token);
      }
    };

    window.addEventListener("daniloom_drive_token_renewed", handleRenewed);
    return () => {
      setDriveTokenRefreshHandler(null);
      window.removeEventListener("daniloom_drive_token_renewed", handleRenewed);
    };
  }, []);

  const clearCurrentProject = async () => {
    const isConfirmed = await askConfirm(
      "Tem certeza que deseja limpar os clipes atuais? Isso apagará todos os clipes locais temporários.",
    );
    if (!isConfirmed) return;

    dbLoadedRef.current = false;
    setClips([]);
    setSelectedClip(null);
    setMergedVideo(null);
    setMergedVideoUrl(null);
    await clearClipsDB();
    dbLoadedRef.current = true;
    await askAlert("Clipes locais removidos.");
  };

  const deleteProject = async () => {
    const isConfirmed = await askConfirm(
      "Tem certeza que deseja excluir todos os clipes temporários?",
    );
    if (!isConfirmed) return;

    dbLoadedRef.current = false;
    setClips([]);
    setSelectedClip(null);
    setMergedVideo(null);
    setMergedVideoUrl(null);
    await clearClipsDB();
    dbLoadedRef.current = true;
    await askAlert("Clipes excluídos.");
  };

  // Helper: Format Time Duration
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // UI rendering of a shortcut sequence
  const renderShortcutKeys = (s: KeyboardShortcut) => {
    const keys = [];
    if (s.ctrlKey) keys.push("Ctrl");
    if (s.shiftKey) keys.push("Shift");
    if (s.altKey) keys.push("Alt");
    keys.push(s.key.toUpperCase());
    return keys.join(" + ");
  };

  const getMockBgStyle = (): CSSProperties => {
    if (screenBgType === "solid") {
      return { backgroundColor: screenBgValue };
    } else if (screenBgType === "gradient") {
      if (screenBgValue === "sunset") {
        return { backgroundImage: "linear-gradient(135deg, #f43f5e, #8b5cf6)" };
      } else if (screenBgValue === "ocean") {
        return { backgroundImage: "linear-gradient(135deg, #0ea5e9, #10b981)" };
      } else if (screenBgValue === "cosmic") {
        return { backgroundImage: "linear-gradient(135deg, #6366f1, #ec4899)" };
      } else if (screenBgValue === "emerald") {
        return { backgroundImage: "linear-gradient(135deg, #065f46, #022c22)" };
      } else {
        const parts = screenBgValue.split(",");
        return {
          backgroundImage: `linear-gradient(135deg, ${parts[0] || "#3b82f6"}, ${parts[1] || "#8b5cf6"})`,
        };
      }
    } else if (screenBgType === "pattern") {
      if (screenBgValue === "grid") {
        return {
          backgroundColor: "#0c0d0f",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        };
      } else if (screenBgValue === "dots") {
        return {
          backgroundColor: "#0c0d0f",
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        };
      } else {
        return {
          backgroundColor: "#0c0d0f",
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.03) 10px, rgba(255,255,255,0.03) 20px)",
        };
      }
    } else {
      return { backgroundColor: "#0c0d0f" };
    }
  };

  const getPreviewBgStyle = (): CSSProperties | undefined => {
    if (screenBgType === "solid" || screenBgType === "camera") return undefined;
    const style = getMockBgStyle();
    // Base escura translúcida para manter o efeito glass do palco no preview
    if (style.backgroundColor === "#0c0d0f") {
      return { ...style, backgroundColor: "rgb(12 13 15 / 0.55)" };
    }
    return style;
  };

  const quickCapturePending = useRef(false);
  useEffect(() => {
    if (quickCapturePending.current && screenStream && recordingMode === 'screen') {
      quickCapturePending.current = false;
      void startRecordingWithCountdown();
    }
  }, [screenStream, recordingMode]);

  useDesktopControls({
    waiting: isWaitingNextClip,
    devices: { camera: useCamera, microphone: useMic, selectedCamera, selectedMicrophone: selectedMic,
      cameras: videoDevices.map((d, i) => ({ id: d.deviceId, label: d.label || `Câmera ${i + 1}` })),
      microphones: audioDevices.map((d, i) => ({ id: d.deviceId, label: d.label || `Microfone ${i + 1}` })) },
    device: ({ kind, id }) => {
      if (isRecording && !isWaitingNextClip) return;
      if (kind === 'camera') { if (id && id !== 'off') setSelectedCamera(id === 'default' ? '' : id); setUseCamera(id ? id !== 'off' : !useCamera); }
      else { if (id && id !== 'off') handleMicSelect(id); setUseMic(id ? id !== 'off' : !useMic); }
    },
    split: splitClipAndRecordNext, restart: () => void resetRecording(true),
    cancel: () => { if (countdown !== null) cancelCountdown(); else void cancelRecording(true); },
    recording: isRecording, paused: isPaused, duration: recordingDuration, countdown,
    start: () => { if (countdown === null && !isStartingRecordingRef.current) startRecordingWithCountdown(); },
    startCapture: async (mode) => {
      if (countdown !== null || isStartingRecordingRef.current) return;
      isStartingRecordingRef.current = true;
      const previous = screenStreamRef.current;
      const stream = await requestScreenShare(mode, false);
      isStartingRecordingRef.current = false;
      if (!stream) return;
      previous?.getTracks().forEach(track => track.stop());
      quickCapturePending.current = true;
      updateScreenStream(stream);
      setRecordingMode('screen');
    },
    pause: pauseRecording, resume: resumeRecording, stop: stopRecording,
  });

  return (
    <>
      <Layout
        user={user}
        authChecking={authChecking}
        isLoggingIn={isLoggingIn}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isAdmin={isAdmin()}
        containerClassName="max-w-7xl mx-auto px-7 pt-4 pb-10"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-6">
          <section
            className={`${isRightSidebarVisible ? "lg:col-span-8" : "lg:col-span-12"} flex flex-col gap-6 transition-all duration-300`}
          >
            {/* Elegant Focus and Teleprompter Workspace Toolbar */}
            <div className="flex items-center justify-between ds-glass px-4 py-2 rounded-2xl gap-3 min-h-[52px]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-inverse animate-pulse" />
                <span className="text-xs font-medium text-fg-secondary">
                  Workspace
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 p-1 rounded-xl flex-wrap">
                  {workspaceIcons
                    .filter(
                      (icon) => icon.visible && (!icon.isPrivate || isAdmin()),
                    )
                    .map((icon) => {
                      if (icon.id === "clips") {
                        return isFeatureEnabled("multi_scene") ? (
                          <button
                            key="clips"
                            onClick={() =>
                              setTimelineCollapsed(!timelineCollapsed)
                            }
                            className={`p-1.5 rounded-lg transition-all cursor-pointer relative group ${
                              !timelineCollapsed
                                ? "ds-active"
                                : "text-fg-muted hover:text-fg hover:bg-hover"
                            }`}
                            title="Linha do Tempo / Clipes"
                          >
                            <Film className="w-4 h-4" />
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                              Linha do Tempo & Clipes
                            </span>
                          </button>
                        ) : null;
                      }

                      if (icon.id === "trim") {
                        return isFeatureEnabled("trim_cut") ? (
                          <button
                            key="trim"
                            onClick={() => setShowTrim(!showTrim)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer relative group ${
                              showTrim
                                ? "ds-active"
                                : "text-fg-muted hover:text-fg hover:bg-hover"
                            }`}
                            title="Trim / Cortar Vídeo"
                          >
                            <Scissors className="w-4 h-4" />
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                              Trim
                            </span>
                          </button>
                        ) : null;
                      }

                      if (icon.id === "screenshot") {
                        return selectedClip ? (
                          <button
                            key="screenshot"
                            onClick={takeScreenshot}
                            className="p-1.5 rounded-lg transition-all cursor-pointer relative group text-fg-muted hover:text-fg hover:bg-hover"
                            title="Capturar Frame (Screenshot)"
                          >
                            <Camera className="w-4 h-4" />
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                              Capturar Frame
                            </span>
                          </button>
                        ) : null;
                      }

                      if (icon.id === "audio_download") {
                        return isFeatureEnabled("audio_replacement") ? (
                          <button
                            key="audio_download"
                            onClick={() => {
                              if (
                                currentClips.length === 0 &&
                                !mergedVideoUrl
                              ) {
                                showToast(
                                  "Grave pelo menos 1 clipe para baixar o áudio.",
                                  "info",
                                );
                                return;
                              }
                              downloadVideoAudio();
                            }}
                            disabled={isDownloadingAudio || isReplacingAudio}
                            className="p-1.5 rounded-lg transition-all cursor-pointer relative group text-fg-muted hover:text-fg hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Baixar Áudio (.wav)"
                          >
                            {isDownloadingAudio ? (
                              <Loader2 className="w-4 h-4 animate-spin text-fg-muted" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                              {isDownloadingAudio
                                ? "Extraindo..."
                                : "Baixar Áudio (.wav)"}
                            </span>
                          </button>
                        ) : null;
                      }

                      if (icon.id === "audio_upload") {
                        return isFeatureEnabled("audio_replacement") ? (
                          <button
                            key="audio_upload"
                            onClick={() => {
                              if (
                                currentClips.length === 0 &&
                                !mergedVideoUrl
                              ) {
                                showToast(
                                  "Grave pelo menos 1 clipe para substituir o áudio.",
                                  "info",
                                );
                                return;
                              }
                              audioInputRef.current?.click();
                            }}
                            disabled={isDownloadingAudio || isReplacingAudio}
                            className="p-1.5 rounded-lg transition-all cursor-pointer relative group text-fg-muted hover:text-fg hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Substituir Áudio (.wav)"
                          >
                            {isReplacingAudio ? (
                              <Loader2 className="w-4 h-4 animate-spin text-fg-muted" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                              {isReplacingAudio
                                ? `Substituindo (${Math.round(replaceAudioProgress * 100)}%)`
                                : "Substituir Áudio (.wav)"}
                            </span>
                          </button>
                        ) : null;
                      }

                      if (icon.id === "sound_effects") {
                        return isFeatureEnabled("sound_effects") ? (
                          <button
                            key="sound_effects"
                            onClick={toggleSoundEffects}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer relative group ${
                              soundEffectsEnabled
                                ? "bg-surface border-line text-fg-muted hover:border-line-strong"
                                : "text-fg-muted"
                            }`}
                            title="Efeitos Sonoros de Interação"
                          >
                            {soundEffectsEnabled ? (
                              <Volume2 className="w-4 h-4" />
                            ) : (
                              <VolumeX className="w-4 h-4" />
                            )}
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                              {soundEffectsEnabled
                                ? "Sons Ativados"
                                : "Sons Mute"}
                            </span>
                          </button>
                        ) : null;
                      }

                      if (icon.id === "watermark") {
                        return isFeatureEnabled("watermark_overlay") ? (
                          <button
                            key="watermark"
                            onClick={() => setShowWatermarkModal(true)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer relative group ${
                              watermarkConfig.enabled
                                ? "ds-active"
                                : "text-fg-muted hover:text-fg hover:bg-hover"
                            }`}
                            title="Marca D'água"
                          >
                            <ImageIcon className="w-4 h-4" />
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                              Marca D'água
                            </span>
                          </button>
                        ) : null;
                      }

                      if (icon.id === "performance_mode") {
                        return isFeatureEnabled("performance_mode") ? (
                          <button
                            key="performance_mode"
                            onClick={togglePerformanceMode}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer relative group ${
                              performanceMode
                                ? "bg-muted border-line text-fg-muted animate-pulse"
                                : "text-fg-muted hover:text-fg hover:bg-hover"
                            }`}
                            title="Modo de Desempenho"
                          >
                            <Gauge className="w-4 h-4" />
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                              {performanceMode
                                ? "Modo Desempenho Ativo"
                                : "Modo Desempenho Off"}
                            </span>
                          </button>
                        ) : null;
                      }

                      if (icon.id === "quick_export") {
                        return (
                          <div
                            key="feature_tools"
                            className="flex items-center gap-1"
                          >
                            {/* Studio Light */}
                            {isFeatureEnabled("studio_light") && (
                              <button
                                onClick={toggleStudioLight}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer relative group ${
                                  studioLightEnabled
                                    ? "ds-active"
                                    : "text-fg-muted hover:text-fg hover:bg-hover"
                                }`}
                                title="Ajuste de Iluminação (Studio Light)"
                              >
                                <Sun className="w-4 h-4" />
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                  {studioLightEnabled
                                    ? "Studio Light (Ativo)"
                                    : "Studio Light (Desativado)"}
                                </span>
                              </button>
                            )}

                            {/* Desfoque de Fundo */}
                            {isFeatureEnabled("camera_blur") && (
                              <button
                                onClick={toggleCameraBlur}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer relative group ${
                                  cameraBlurEnabled
                                    ? "bg-muted border-line text-fg-secondary shadow-md shadow-xs"
                                    : "text-fg-muted hover:text-fg hover:bg-hover"
                                }`}
                                title="Desfoque de Fundo"
                              >
                                <Focus className="w-4 h-4" />
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                  {cameraBlurEnabled
                                    ? "Desfoque de Fundo (Ativo)"
                                    : "Desfoque de Fundo"}
                                </span>
                              </button>
                            )}

                            {/* Cancelamento de Ruído */}
                            {isFeatureEnabled("noise_cancellation") && (
                              <button
                                onClick={toggleNoiseCancellation}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer relative group ${
                                  noiseCancellationEnabled
                                    ? "ds-active"
                                    : "text-fg-muted hover:text-fg hover:bg-hover"
                                }`}
                                title="Cancelamento de Ruído IA"
                              >
                                <VolumeX className="w-4 h-4" />
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                  {noiseCancellationEnabled
                                    ? "Cancelamento de Ruído (Ativo)"
                                    : "Cancelamento de Ruído"}
                                </span>
                              </button>
                            )}

                            {/* Crop Region (Área Específica) */}
                            {isFeatureEnabled("crop_region") && (
                              <button
                                onClick={() => setShowCropModal(true)}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer relative group ${
                                  cropRegion.enabled
                                    ? "ds-active"
                                    : "text-fg-muted hover:text-fg hover:bg-hover"
                                }`}
                                title="Gravar Área Específica (cropTo)"
                              >
                                <Crop className="w-4 h-4" />
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                  {cropRegion.enabled
                                    ? "Área Recortada (Ativa)"
                                    : "Gravar Área Específica"}
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      }

                      return null;
                    })}
                  <DesktopToolbar clip={selectedClip} recording={isRecording} />
                </div>

                {/* Focus Mode Toggle */}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className={`p-2 rounded-xl transition-all cursor-pointer relative group ${
                    sidebarCollapsed
                      ? "ds-active"
                      : "text-fg-muted hover:text-fg hover:bg-hover"
                  }`}
                  title={
                    sidebarCollapsed
                      ? "Mostrar Painel Lateral"
                      : "Focar Gravação"
                  }
                >
                  {sidebarCollapsed ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                    {sidebarCollapsed ? "Mostrar Painel" : "Focar Gravação"}
                  </span>
                </button>
              </div>
            </div>
            {/* Main Stage Container */}
            <div
              className={`w-full flex flex-col items-center justify-center transition-all duration-300 ${sidebarCollapsed ? "max-w-2xl lg:max-w-3xl mx-auto" : ""}`}
            >
              {/* Stage Box */}
              <div
                className={`relative group rounded-3xl bg-app/55 backdrop-blur-xl backdrop-saturate-[1.15] border border-line overflow-hidden flex flex-col items-center justify-center transition-all duration-500 ${
                  recordingFormat === "portrait"
                    ? "aspect-[9/16] h-[65vh] max-h-[800px] w-auto"
                    : "aspect-video w-full"
                }`}
              >
                {/* Floating Zoom Controls Overlay - Only visible on hover */}
                <div className="absolute top-3 left-3 z-40 flex items-center gap-1 bg-app/80 border border-line/80 backdrop-blur-md px-2 py-1 rounded-xl shadow-xl select-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewZoom((z) =>
                        Math.max(0.5, Math.round((z - 0.1) * 10) / 10),
                      )
                    }
                    disabled={previewZoom <= 0.5}
                    className="p-1 text-fg-muted hover:text-fg disabled:opacity-30 cursor-pointer rounded-lg hover:bg-muted transition-all"
                    title="Aproximar (Zoom Out)"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-meta font-mono font-bold text-fg-default min-w-[36px] text-center">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewZoom((z) =>
                        Math.min(2.0, Math.round((z + 0.1) * 10) / 10),
                      )
                    }
                    disabled={previewZoom >= 2.0}
                    className="p-1 text-fg-muted hover:text-fg disabled:opacity-30 cursor-pointer rounded-lg hover:bg-muted transition-all"
                    title="Afastar (Zoom In)"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  {previewZoom !== 1.0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(1.0)}
                      className="p-1 text-fg-muted hover:text-fg-muted cursor-pointer rounded-lg hover:bg-muted transition-all ml-0.5"
                      title="Resetar Zoom (100%)"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                  {recordingMode === "camera" && (
                    <>
                      <div className="w-[1px] h-3 bg-muted mx-0.5" />
                      <button
                        type="button"
                        onClick={toggleCameraGrid}
                        className={`p-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                          cameraGridEnabled
                            ? "bg-muted text-fg-muted font-bold"
                            : "text-fg-muted hover:text-fg hover:bg-muted"
                        }`}
                        title={
                          cameraGridEnabled
                            ? "Ocultar Grade de Enquadramento"
                            : "Exibir Grade de Enquadramento (Estilo Celular)"
                        }
                      >
                        <Grid3X3 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Watermark Overlay Preview */}
                {watermarkConfig.enabled && watermarkConfig.image && (
                  <div
                    className={`absolute z-30 pointer-events-none p-4 ${
                      watermarkConfig.position === "top-left"
                        ? "top-0 left-0"
                        : watermarkConfig.position === "top-right"
                          ? "top-0 right-0"
                          : watermarkConfig.position === "bottom-left"
                            ? "bottom-0 left-0"
                            : "bottom-0 right-0"
                    }`}
                    style={{ opacity: watermarkConfig.opacity }}
                  >
                    <img
                      src={watermarkConfig.image}
                      alt="Watermark"
                      className="object-contain max-h-12 max-w-[120px] rounded drop-shadow-md"
                    />
                  </div>
                )}

                {/* Scalable Inner Stage Content */}
                <div
                  className="w-full h-full flex items-center justify-center transition-transform duration-200 origin-center"
                  style={{ transform: `scale(${previewZoom})` }}
                >
                  {countdown !== null ? (
                    // 5-Second Countdown Overlay with Cancel Action
                    <div className="absolute inset-0 bg-app/95 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-fade-in">
                      <div className="relative flex items-center justify-center">
                        {/* Ring animation */}
                        <div className="absolute w-36 h-36 rounded-full border-4 border-line animate-ping" />
                        <div className="absolute w-32 h-32 rounded-full border-4 border-line-strong animate-pulse-slow" />
                        <div className="w-24 h-24 rounded-full bg-surface border-2 border-line-strong flex items-center justify-center shadow-2xl shadow-xs">
                          <span className="font-sans text-5xl font-black text-fg-muted animate-scale-up">
                            {countdown}
                          </span>
                        </div>
                      </div>
                      <h3 className="font-sans font-semibold text-sm text-fg mt-6 tracking-tight">
                        Preparando Câmera e Áudio...
                      </h3>
                      <p className="text-fg-muted text-xs mt-1 max-w-xs text-center">
                        A gravação começará em instantes sem travamentos ou
                        delay.
                      </p>
                      <button
                        onClick={cancelCountdown}
                        className="mt-6 px-4 py-1.5 rounded-xl bg-muted hover:bg-muted text-fg-secondary hover:text-fg text-xs font-semibold cursor-pointer border border-line-strong/50 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : null}

                  {isRecording ? (
                    recordingMode === "camera" ? (
                      // Camera Live Recording Preview
                      (() => {
                        const isCircle = cameraShape === "circle";
                        const isRect = cameraShape === "rectangle";
                        const showBackground = isCircle || isRect;

                        let sizeClasses = "";
                        if (isCircle) {
                          if (bubbleSize === "sm")
                            sizeClasses =
                              "h-[28%] aspect-square rounded-full";
                          else if (bubbleSize === "md")
                            sizeClasses =
                              "h-[40%] aspect-square rounded-full";
                          else
                            sizeClasses =
                              "h-[55%] aspect-square rounded-full";
                        } else if (isRect) {
                          if (bubbleSize === "sm")
                            sizeClasses =
                              "h-[28%] aspect-[4/3] rounded-2xl";
                          else if (bubbleSize === "md")
                            sizeClasses =
                              "h-[40%] aspect-[4/3] rounded-2xl";
                          else
                            sizeClasses =
                              "h-[55%] aspect-[4/3] rounded-2xl";
                        } else {
                          sizeClasses = "w-full h-full";
                        }

                        return (
                          <div
                            className="absolute inset-0 flex items-center justify-center overflow-hidden transition-all duration-300 rounded-2xl"
                            style={
                              showBackground
                                ? getPreviewBgStyle()
                                : undefined
                            }
                          >
                            {showBackground && screenBgType === "camera" && (
                              <CameraBlurredBackground
                                stream={cameraStream}
                                blurAmount={cameraBgBlurAmount || 24}
                              />
                            )}
                            {cameraStream ? (
                              <div
                                className={`relative z-10 ${showBackground ? `${sizeClasses} border-2 border-white/20 shadow-2xl overflow-hidden` : "w-full h-full"}`}
                              >
                                <video
                                  ref={(el) => {
                                    if (el && cameraStream) {
                                      if (el.srcObject !== cameraStream) {
                                        el.srcObject = cameraStream;
                                        el.play().catch((e) =>
                                          console.warn(
                                            "Live preview play error:",
                                            e,
                                          ),
                                        );
                                      }
                                    }
                                  }}
                                  autoPlay
                                  playsInline
                                  muted
                                  style={{
                                    filter: getCanvasFilterString(
                                      cameraFilter,
                                      cameraBrightness,
                                      cameraContrast,
                                      cameraShadow,
                                      cameraBlackPoint,
                                      studioLightEnabled,
                                      studioLightIntensity,
                                    ),
                                    transform: `scale(${cameraFlipH ? -1 : 1}, ${cameraFlipV ? -1 : 1})`,
                                    objectPosition: `${cameraOffsetX}% ${cameraOffsetY}%`,
                                  }}
                                  className="w-full h-full object-cover bg-app"
                                />
                                {recordingMode === "camera" && (
                                  <CameraGridOverlay
                                    enabled={cameraGridEnabled}
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-app">
                                <Loader2 className="w-8 h-8 text-fg-muted animate-spin" />
                                <span className="text-xs text-fg-muted">
                                  Iniciando feed da câmera...
                                </span>
                              </div>
                            )}

                            {/* Camera Enquadramento / Position Overlay Sliders */}
                            {cameraShape !== "hidden" && (
                              <div className="absolute top-4 right-4 bg-app/85 border border-line/80 p-2 rounded-2xl shadow-2xl backdrop-blur flex flex-col gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                                <div className="flex items-center gap-2">
                                  <ArrowUp className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                                  <Slider
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={cameraOffsetY}
                                    onChange={setCameraOffsetY}
                                    className="w-20 sm:w-28"
                                    aria-label="Posição vertical da câmera"
                                  />
                                  <ArrowDown className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                                </div>
                                <div className="flex items-center gap-2">
                                  <ArrowLeft className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                                  <Slider
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={cameraOffsetX}
                                    onChange={setCameraOffsetX}
                                    className="w-20 sm:w-28"
                                    aria-label="Posição horizontal da câmera"
                                  />
                                  <ArrowRight className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                                </div>
                              </div>
                            )}

                            {/* Live indicator overlay */}
                            <div className="absolute top-4 left-4 bg-app/80 border border-line px-3 py-1.5 rounded-xl shadow backdrop-blur flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                              <span className="w-2 h-2 rounded-full bg-inverse animate-pulse" />
                              <span className="font-mono text-meta font-bold text-fg uppercase tracking-wider">
                                {isPaused ? "Câmera Pausada" : "Câmera ao Vivo"}
                              </span>
                            </div>
                            {/* Subtle Timer overlay in Corner - less prominent */}
                            <div className="absolute bottom-3 right-3 bg-app/60 border border-line/40 px-2.5 py-1 rounded-lg backdrop-blur flex items-center gap-1.5 z-10 select-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                              <span className="w-1.5 h-1.5 rounded-full bg-inverse animate-pulse" />
                              <span className="font-mono text-meta font-bold text-fg-secondary leading-none">
                                {formatTimer(recordingDuration)}
                                {recordingTimerLimit !== null &&
                                  recordingTimerLimit > 0 &&
                                  ` / ${formatTimer(recordingTimerLimit)}`}
                              </span>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      // Live Screen + Camera Recording Preview (REAL TIME PREVIEW)
                      (() => {
                        const hasCam =
                          useCamera && cameraStream && cameraShape !== "hidden";
                        const isPortrait = recordingFormat === "portrait";
                        const isSplit =
                          cameraShape === "split" ||
                          (isPortrait &&
                            cameraShape !== "centralized" &&
                            cameraShape !== "fullscreen");

                        const renderCropOverlay = () => {
                          if (isRecording || !isCustomCropEnabled) return null;
                          return (
                            <div
                              ref={cropOverlayRef}
                              className="absolute inset-0 z-30 select-none pointer-events-auto overflow-hidden"
                              onPointerMove={handleCropPointerMove}
                            >
                              {/* Backdrop pieces */}
                              <div
                                className="absolute bg-app/60 backdrop-blur-[1px]"
                                style={{
                                  left: 0,
                                  top: 0,
                                  right: 0,
                                  height: `${cropYPercent}%`,
                                }}
                              />
                              <div
                                className="absolute bg-app/60 backdrop-blur-[1px]"
                                style={{
                                  left: 0,
                                  top: `${cropYPercent + cropHeightPercent}%`,
                                  right: 0,
                                  bottom: 0,
                                }}
                              />
                              <div
                                className="absolute bg-app/60 backdrop-blur-[1px]"
                                style={{
                                  left: 0,
                                  top: `${cropYPercent}%`,
                                  width: `${cropXPercent}%`,
                                  height: `${cropHeightPercent}%`,
                                }}
                              />
                              <div
                                className="absolute bg-app/60 backdrop-blur-[1px]"
                                style={{
                                  left: `${cropXPercent + cropWidthPercent}%`,
                                  top: `${cropYPercent}%`,
                                  right: 0,
                                  height: `${cropHeightPercent}%`,
                                }}
                              />

                              {/* Clear Crop Area Box with outline and handles */}
                              <div
                                className="absolute border-2 border-dashed border-line-strong shadow-2xl flex items-center justify-center cursor-move"
                                style={{
                                  left: `${cropXPercent}%`,
                                  top: `${cropYPercent}%`,
                                  width: `${cropWidthPercent}%`,
                                  height: `${cropHeightPercent}%`,
                                }}
                                onPointerDown={(e) =>
                                  handleCropPointerDown(e, "move")
                                }
                                onPointerUp={handleCropPointerUp}
                              >
                                <div className="absolute top-2 left-2 bg-inverse text-fg text-meta font-bold px-2 py-0.5 rounded shadow flex items-center gap-1">
                                  <Crop className="w-3 h-3" />
                                  <span>
                                    Área de Recorte ({cropWidthPercent}%x
                                    {cropHeightPercent}%)
                                  </span>
                                </div>

                                {/* Resize Handles */}
                                <div
                                  className="absolute w-4 h-4 bg-white border-2 border-line-strong rounded-full cursor-nwse-resize -top-2 -left-2 shadow z-40"
                                  onPointerDown={(e) =>
                                    handleCropPointerDown(e, "nw")
                                  }
                                  onPointerUp={handleCropPointerUp}
                                />
                                <div
                                  className="absolute w-4 h-4 bg-white border-2 border-line-strong rounded-full cursor-nesw-resize -top-2 -right-2 shadow z-40"
                                  onPointerDown={(e) =>
                                    handleCropPointerDown(e, "ne")
                                  }
                                  onPointerUp={handleCropPointerUp}
                                />
                                <div
                                  className="absolute w-4 h-4 bg-white border-2 border-line-strong rounded-full cursor-nesw-resize -bottom-2 -left-2 shadow z-40"
                                  onPointerDown={(e) =>
                                    handleCropPointerDown(e, "sw")
                                  }
                                  onPointerUp={handleCropPointerUp}
                                />
                                <div
                                  className="absolute w-4 h-4 bg-white border-2 border-line-strong rounded-full cursor-nwse-resize -bottom-2 -right-2 shadow z-40"
                                  onPointerDown={(e) =>
                                    handleCropPointerDown(e, "se")
                                  }
                                  onPointerUp={handleCropPointerUp}
                                />
                              </div>
                            </div>
                          );
                        };

                        if (isSplit) {
                          const isInverted = splitInverted;
                          const ratioRaw = isFeatureEnabled(
                            "split_screen_control",
                          )
                            ? splitRatio
                            : 0.5;
                          const leftPct = `${Math.max(10, Math.min(90, ratioRaw * 100))}%`;
                          const rightPct = `${100 - Math.max(10, Math.min(90, ratioRaw * 100))}%`;

                          const screenViewEl = (
                            <div
                              className="bg-app/90 flex items-center justify-center relative overflow-hidden transition-all duration-75"
                              style={{
                                width: isPortrait
                                  ? "100%"
                                  : isInverted
                                    ? rightPct
                                    : leftPct,
                                height: isPortrait
                                  ? isInverted
                                    ? rightPct
                                    : leftPct
                                  : "100%",
                                ...(isCustomCropEnabled && isRecording
                                  ? {
                                      aspectRatio: `${cropWidthPercent} / ${cropHeightPercent}`,
                                    }
                                  : {}),
                              }}
                            >
                              {screenStream ? (
                                <>
                                  <ScreenPreviewMedia
                                    stream={screenStream}
                                    className="w-full h-full object-contain bg-app"
                                    style={
                                      isCustomCropEnabled && isRecording
                                        ? {
                                            width: `${(100 / cropWidthPercent) * 100}%`,
                                            height: `${(100 / cropHeightPercent) * 100}%`,
                                            left: `-${(cropXPercent / cropWidthPercent) * 100}%`,
                                            top: `-${(cropYPercent / cropHeightPercent) * 100}%`,
                                            position: "absolute" as const,
                                          }
                                        : {}
                                    }
                                  />
                                  {renderCropOverlay()}
                                </>
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-app">
                                  <Loader2 className="w-6 h-6 text-fg-muted animate-spin" />
                                  <span className="text-xs text-fg-muted">
                                    Compartilhando tela...
                                  </span>
                                </div>
                              )}
                            </div>
                          );

                          const cameraViewEl = hasCam ? (
                            <div
                              className="bg-app flex items-center justify-center relative overflow-hidden transition-all duration-75"
                              style={{
                                width: isPortrait
                                  ? "100%"
                                  : isInverted
                                    ? leftPct
                                    : rightPct,
                                height: isPortrait
                                  ? isInverted
                                    ? leftPct
                                    : rightPct
                                  : "100%",
                              }}
                            >
                              <CameraPreviewMedia
                                stream={cameraStream}
                                cameraBlurEnabled={cameraBlurEnabled}
                                cameraBgBlurAmount={cameraBgBlurAmount}
                                filterStyle={getCanvasFilterString(
                                  cameraFilter,
                                  cameraBrightness,
                                  cameraContrast,
                                  cameraShadow,
                                  cameraBlackPoint,
                                  studioLightEnabled,
                                  studioLightIntensity,
                                )}
                                flipH={cameraFlipH}
                                flipV={cameraFlipV}
                                objectPosition={`${cameraOffsetX}% ${cameraOffsetY}%`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : null;

                          return (
                            <div
                              className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-2xl animate-fade-in"
                              style={getPreviewBgStyle()}
                            >
                              {screenBgType === "camera" && (
                                <CameraBlurredBackground
                                  stream={cameraStream}
                                  blurAmount={cameraBgBlurAmount || 24}
                                />
                              )}
                              <div
                                className={`w-full h-full flex items-center justify-center relative z-10 ${isPortrait ? "flex-col" : "flex-row"}`}
                              >
                                {isInverted ? cameraViewEl : screenViewEl}
                                {isInverted ? screenViewEl : cameraViewEl}
                              </div>

                              {/* Quick Split Controls Overlay on Stage */}
                              {isFeatureEnabled("split_screen_control") && (
                                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-app/85 border border-line/80 px-3 py-1.5 rounded-2xl backdrop-blur shadow-2xl flex items-center gap-3 z-30 opacity-90 hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSplitInverted(!splitInverted)
                                    }
                                    title="Inverter Posição da Tela e Câmera"
                                    className="p-1 rounded-lg bg-surface hover:bg-muted text-fg-secondary hover:text-fg border border-line transition-colors cursor-pointer"
                                  >
                                    {isPortrait ? (
                                      <ArrowUpDown className="w-3.5 h-3.5" />
                                    ) : (
                                      <ArrowLeftRight className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  <div className="flex items-center gap-2">
                                    <span className="text-meta font-mono text-fg-muted">
                                      Divisão
                                    </span>
                                    <Slider
                                      min={15}
                                      max={85}
                                      step={1}
                                      value={Math.round(splitRatio * 100)}
                                      onChange={(val) => setSplitRatio(val / 100)}
                                      className="w-20 md:w-28"
                                      aria-label="Divisão de tela"
                                    />
                                    <span className="text-meta font-mono font-bold text-fg-muted w-12 text-center">
                                      {Math.round(splitRatio * 100)}/
                                      {100 - Math.round(splitRatio * 100)}
                                    </span>
                                  </div>

                                  {splitRatio !== 0.5 && (
                                    <button
                                      type="button"
                                      onClick={() => setSplitRatio(0.5)}
                                      className="text-meta font-mono text-fg-muted hover:text-fg bg-surface hover:bg-muted px-1.5 py-0.5 rounded border border-line cursor-pointer"
                                      title="Restaurar 50/50"
                                    >
                                      50/50
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Low-profile Subtle Timer Overlay in Corner */}
                              <div className="absolute bottom-3 right-3 bg-app/60 border border-line/40 px-2.5 py-1 rounded-lg backdrop-blur flex items-center gap-1.5 z-10 select-none opacity-85 hover:opacity-100 transition-opacity">
                                <span className="w-1.5 h-1.5 rounded-full bg-inverse animate-pulse" />
                                <span className="font-mono text-meta font-bold text-fg-secondary leading-none">
                                  {formatTimer(recordingDuration)}
                                  {recordingTimerLimit !== null &&
                                    recordingTimerLimit > 0 &&
                                    ` / ${formatTimer(recordingTimerLimit)}`}
                                </span>
                              </div>
                            </div>
                          );
                        } else {
                          // Standard Picture-in-Picture layout
                          const isCircle = cameraShape === "circle";
                          const isRect = cameraShape === "rectangle";

                          let bubbleSizeClasses = "";
                          if (isCircle) {
                            bubbleSizeClasses =
                              bubbleSize === "sm"
                                ? "w-40 h-40 md:w-56 md:h-56 rounded-full"
                                : bubbleSize === "md"
                                  ? "w-56 h-56 md:w-80 md:h-80 rounded-full"
                                  : "w-80 h-80 md:w-[448px] md:h-[448px] rounded-full";
                          } else {
                            bubbleSizeClasses =
                              bubbleSize === "sm"
                                ? "w-64 h-48 md:w-88 md:h-66 rounded-2xl"
                                : bubbleSize === "md"
                                  ? "w-88 h-66 md:w-[512px] md:h-[384px] rounded-2xl"
                                  : "w-[512px] h-[384px] md:w-[640px] md:h-[480px] rounded-2xl";
                          }

                          let cameraPositionClasses = "";
                          if (cameraPosition === "top-left")
                            cameraPositionClasses = "top-4 left-4";
                          else if (cameraPosition === "top-right")
                            cameraPositionClasses = "top-4 right-4";
                          else if (cameraPosition === "bottom-right")
                            cameraPositionClasses = "bottom-4 right-4";
                          else if (cameraPosition === "bottom-center")
                            cameraPositionClasses =
                              "bottom-4 left-1/2 -translate-x-1/2";
                          else if (cameraPosition === "top-center")
                            cameraPositionClasses =
                              "top-4 left-1/2 -translate-x-1/2";
                          else cameraPositionClasses = "bottom-4 left-4"; // bottom-left

                          let videoWrapperClass =
                            "w-full h-full relative overflow-hidden flex items-center justify-center bg-app transition-all duration-300";
                          let videoClass =
                            cameraShape === "fullscreen" ||
                            (isPortrait && cameraShape === "centralized")
                              ? "w-full h-full object-cover bg-app"
                              : "w-full h-full object-contain bg-app";

                          if (screenSize === "medium") {
                            videoWrapperClass =
                              "max-w-[90%] max-h-[90%] aspect-video rounded-2xl shadow-2xl border border-white/15 bg-app overflow-hidden transition-all duration-300";
                            videoClass = "w-full h-full object-contain";
                          } else if (screenSize === "compact") {
                            videoWrapperClass =
                              "max-w-[80%] max-h-[80%] aspect-video rounded-3xl shadow-2xl border border-white/15 bg-app overflow-hidden transition-all duration-300";
                            videoClass = "w-full h-full object-contain";
                          }

                          return (
                            <div
                              className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl animate-fade-in"
                              style={getPreviewBgStyle()}
                            >
                              {screenBgType === "camera" && (
                                <CameraBlurredBackground
                                  stream={cameraStream}
                                  blurAmount={cameraBgBlurAmount || 24}
                                />
                              )}
                              {/* Underneath: Screen Stream */}
                              <div
                                className={`${videoWrapperClass} relative z-10`}
                                style={
                                  isCustomCropEnabled && isRecording
                                    ? {
                                        aspectRatio: `${cropWidthPercent} / ${cropHeightPercent}`,
                                      }
                                    : {}
                                }
                              >
                                {screenStream ? (
                                  <>
                                    <ScreenPreviewMedia
                                      stream={screenStream}
                                      className={videoClass}
                                      style={
                                        isCustomCropEnabled && isRecording
                                          ? {
                                              width: `${(100 / cropWidthPercent) * 100}%`,
                                              height: `${(100 / cropHeightPercent) * 100}%`,
                                              left: `-${(cropXPercent / cropWidthPercent) * 100}%`,
                                              top: `-${(cropYPercent / cropHeightPercent) * 100}%`,
                                              position: "absolute" as const,
                                            }
                                          : {}
                                      }
                                    />
                                    {renderCropOverlay()}
                                  </>
                                ) : (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-app">
                                    <Loader2 className="w-6 h-6 text-fg-muted animate-spin" />
                                    <span className="text-xs text-fg-muted">
                                      Compartilhando tela...
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Floating on Top: Camera Stream */}
                              {hasCam && (
                                <div
                                  className={`absolute z-20 ${cameraPositionClasses}`}
                                >
                                  <div
                                    className={`border border-white/10 shadow-2xl overflow-hidden bg-app relative flex items-center justify-center ${bubbleSizeClasses}`}
                                  >
                                    <CameraPreviewMedia
                                      stream={cameraStream}
                                      cameraBlurEnabled={cameraBlurEnabled}
                                      cameraBgBlurAmount={cameraBgBlurAmount}
                                      filterStyle={getCanvasFilterString(
                                        cameraFilter,
                                        cameraBrightness,
                                        cameraContrast,
                                        cameraShadow,
                                        cameraBlackPoint,
                                        studioLightEnabled,
                                        studioLightIntensity,
                                      )}
                                      flipH={cameraFlipH}
                                      flipV={cameraFlipV}
                                      objectPosition={`${cameraOffsetX}% ${cameraOffsetY}%`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Low-profile Subtle Timer Overlay in Corner */}
                              <div className="absolute bottom-3 right-3 bg-app/60 border border-line/40 px-2.5 py-1 rounded-lg backdrop-blur flex items-center gap-1.5 z-10 select-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                                <span className="w-1.5 h-1.5 rounded-full bg-inverse animate-pulse" />
                                <span className="font-mono text-meta font-bold text-fg-secondary leading-none">
                                  {formatTimer(recordingDuration)}
                                  {recordingTimerLimit !== null &&
                                    recordingTimerLimit > 0 &&
                                    ` / ${formatTimer(recordingTimerLimit)}`}
                                </span>
                              </div>
                            </div>
                          );
                        }
                      })()
                    )
                  ) : selectedClip ? (
                    // Video Clip Player View
                    <div className="relative w-full h-full flex items-center justify-center bg-app rounded-2xl overflow-hidden">
                      <CustomPlayer
                        ref={mainVideoPlayerRef}
                        src={selectedClip.url}
                        downloadName={`video_${selectedClip.name}`}
                        onTimeUpdateCallback={(currentTime) => {
                          setCurrentPlaybackTime(currentTime);
                        }}
                      />
                    </div>
                  ) : (
                    // Warm Live Preview Area (Camera Mode or Screen+Camera Mode)
                    <div className="absolute inset-0 flex items-center justify-center bg-app">
                      {recordingMode === "camera" ? (
                        // Live full-screen camera standby preview
                        (() => {
                          const isCircle = cameraShape === "circle";
                          const isRect = cameraShape === "rectangle";
                          const showBackground = isCircle || isRect;

                          let sizeClasses = "";
                          if (isCircle) {
                            if (bubbleSize === "sm")
                              sizeClasses =
                                "h-[28%] aspect-square rounded-full";
                            else if (bubbleSize === "md")
                              sizeClasses =
                                "h-[40%] aspect-square rounded-full";
                            else
                              sizeClasses =
                                "h-[55%] aspect-square rounded-full";
                          } else if (isRect) {
                            if (bubbleSize === "sm")
                              sizeClasses =
                                "h-[28%] aspect-[4/3] rounded-2xl";
                            else if (bubbleSize === "md")
                              sizeClasses =
                                "h-[40%] aspect-[4/3] rounded-2xl";
                            else
                              sizeClasses =
                                "h-[55%] aspect-[4/3] rounded-2xl";
                          } else {
                            sizeClasses = "w-full h-full";
                          }

                          return (
                            <div
                              className="w-full h-full relative flex items-center justify-center overflow-hidden transition-all duration-300"
                              style={
                                showBackground
                                  ? getPreviewBgStyle()
                                  : undefined
                              }
                            >
                              {showBackground && screenBgType === "camera" && (
                                <CameraBlurredBackground
                                  stream={cameraStream}
                                  blurAmount={cameraBgBlurAmount || 24}
                                />
                              )}
                              {cameraStream ? (
                                <div
                                  className={`relative z-10 ${showBackground ? `${sizeClasses} border-2 border-white/20 shadow-2xl overflow-hidden` : "w-full h-full"}`}
                                >
                                  <CameraPreviewMedia
                                    stream={cameraStream}
                                    cameraBlurEnabled={cameraBlurEnabled}
                                    cameraBgBlurAmount={cameraBgBlurAmount}
                                    filterStyle={getCanvasFilterString(
                                      cameraFilter,
                                      cameraBrightness,
                                      cameraContrast,
                                      cameraShadow,
                                      cameraBlackPoint,
                                      studioLightEnabled,
                                      studioLightIntensity,
                                    )}
                                    flipH={cameraFlipH}
                                    flipV={cameraFlipV}
                                    objectPosition={`${cameraOffsetX}% ${cameraOffsetY}%`}
                                    className={`w-full h-full ${showBackground ? "object-cover" : "object-cover bg-app"}`}
                                  />
                                  {recordingMode === "camera" && (
                                    <CameraGridOverlay
                                      enabled={cameraGridEnabled}
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-app">
                                  <Loader2 className="w-8 h-8 text-fg-muted animate-spin" />
                                  <span className="text-xs text-fg-muted">
                                    Iniciando feed da câmera...
                                  </span>
                                </div>
                              )}

                              {/* Fullscreen Camera Position Overlay Sliders */}
                              {cameraShape === "fullscreen" && (
                                <div className="absolute top-4 right-4 bg-app/85 border border-line/80 p-2 rounded-2xl shadow-2xl backdrop-blur flex flex-col gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                                  <div className="flex items-center gap-2">
                                    <ArrowUp className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                                    <Slider
                                      min={0}
                                      max={100}
                                      step={1}
                                      value={cameraOffsetY}
                                      onChange={setCameraOffsetY}
                                      className="w-20 sm:w-28"
                                      aria-label="Posição vertical da câmera"
                                    />
                                    <ArrowDown className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <ArrowLeft className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                                    <Slider
                                      min={0}
                                      max={100}
                                      step={1}
                                      value={cameraOffsetX}
                                      onChange={setCameraOffsetX}
                                      className="w-20 sm:w-28"
                                      aria-label="Posição horizontal da câmera"
                                    />
                                    <ArrowRight className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                                  </div>
                                </div>
                              )}

                              {/* Standby Label Overlay */}
                              <div className="absolute top-4 left-4 bg-app/80 border border-line px-3 py-1.5 rounded-xl shadow backdrop-blur flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                                <span className="w-2 h-2 rounded-full bg-fg-muted animate-pulse" />
                                <span className="font-mono text-meta font-bold text-fg uppercase tracking-wider">
                                  Pronto para Gravar (Apenas Câmera)
                                </span>
                              </div>

                              {/* Quick Flip Camera and Mirror in Standby Preview */}
                              <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                                {isMobile && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={handleFlipCamera}
                                      title="Alternar Câmera (Frontal / Traseira)"
                                      className="bg-app/85 hover:bg-surface text-fg-default border border-line-strong/80 px-3 py-1.5 rounded-xl shadow-lg backdrop-blur flex items-center gap-2 text-xs font-medium cursor-pointer transition-all hover:scale-105 active:scale-95"
                                    >
                                      <SwitchCamera className="w-4 h-4 text-fg-muted" />
                                      <span className="inline">
                                        {cameraFacingMode === "user"
                                          ? "Frontal"
                                          : "Traseira"}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCameraFlipH(!cameraFlipH)
                                      }
                                      title={
                                        cameraFlipH
                                          ? "Modo Espelho Ativo (Clique para desativar)"
                                          : "Modo Natural (Clique para espelhar)"
                                      }
                                      className={`p-1.5 rounded-xl border shadow-lg backdrop-blur transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                                        cameraFlipH
                                          ? "bg-muted text-fg-muted border-line-strong"
                                          : "bg-app/85 text-fg-secondary border-line-strong/80 hover:bg-surface"
                                      }`}
                                    >
                                      <FlipHorizontal className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })()
                      ) : // Simulated Screen + Camera Standby Preview
                      cameraShape === "split" ||
                        (recordingFormat === "portrait" &&
                          cameraShape !== "centralized" &&
                          cameraShape !== "fullscreen") ? (
                        (() => {
                          const ratioRaw = isFeatureEnabled(
                            "split_screen_control",
                          )
                            ? splitRatio
                            : 0.5;
                          const leftPct = `${Math.max(10, Math.min(90, ratioRaw * 100))}%`;
                          const rightPct = `${100 - Math.max(10, Math.min(90, ratioRaw * 100))}%`;
                          const isPort = recordingFormat === "portrait";

                          const dims = getRecordingDimensions(
                            recordingResolution,
                            recordingFormat,
                          );
                          const screenTargetW = Math.round(
                            isPort
                              ? dims.width
                              : dims.width *
                                  (splitInverted ? 1 - ratioRaw : ratioRaw),
                          );
                          const screenTargetH = Math.round(
                            isPort
                              ? dims.height *
                                  (splitInverted ? 1 - ratioRaw : ratioRaw)
                              : dims.height,
                          );
                          const resHint = `Proporção ideal: ${screenTargetW}x${screenTargetH}`;

                          const screenStandbyEl = (
                            <div
                              className="bg-app/90 border-line flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all duration-75"
                              style={{
                                width: isPort
                                  ? "100%"
                                  : splitInverted
                                    ? rightPct
                                    : leftPct,
                                height: isPort
                                  ? splitInverted
                                    ? rightPct
                                    : leftPct
                                  : "100%",
                              }}
                            >
                              {screenStream ? (
                                <div className="relative w-full h-full group">
                                  <ScreenPreviewMedia
                                    stream={screenStream}
                                    className="w-full h-full object-cover bg-app"
                                  />
                                  <div className="absolute bottom-2 left-2 bg-surface/95 text-fg-default text-meta px-2 py-1.5 rounded-md backdrop-blur border border-line-strong shadow-md z-20 pointer-events-none transition-opacity duration-200 opacity-60 group-hover:opacity-100">
                                    <span className="font-semibold text-fg-muted">
                                      {resHint}
                                    </span>
                                    <div className="text-meta text-fg-muted leading-tight mt-0.5">
                                      Redimensione a janela
                                      <br />
                                      p/ evitar cortes
                                    </div>
                                  </div>
                                  <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                    <button
                                      type="button"
                                      onClick={() => requestScreenShare()}
                                      className="text-meta font-medium bg-surface/90 hover:bg-muted border border-line-strong text-fg-default px-2 py-1 rounded-lg backdrop-blur transition-all cursor-pointer flex items-center gap-1 shadow-md"
                                      title="Alterar janela ou tela compartilhada"
                                    >
                                      <Monitor className="w-3 h-3 text-fg-muted" />
                                      <span>Trocar</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (screenStreamRef.current) {
                                          screenStreamRef.current
                                            .getTracks()
                                            .forEach((track) => track.stop());
                                          updateScreenStream(null);
                                        }
                                      }}
                                      className="text-meta font-medium bg-surface/90 hover:bg-inverse border border-line-strong text-fg-default hover:text-fg px-2 py-1 rounded-lg backdrop-blur transition-all cursor-pointer flex items-center gap-1 shadow-md"
                                      title="Parar compartilhamento de tela"
                                    >
                                      <X className="w-3 h-3" />
                                      <span>Parar</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center flex-grow py-4 text-center">
                                  <Monitor className="w-5 h-5 md:w-6 md:h-6 text-fg-muted/80 mb-2" />
                                  <span className="text-meta font-semibold text-fg-secondary mb-2">
                                    Compartilhamento de Tela
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => requestScreenShare()}
                                    className="text-meta font-medium bg-inverse hover:bg-inverse text-on-inverse px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-md mb-2.5"
                                  >
                                    Testar Compartilhamento
                                  </button>
                                  <div className="text-meta text-fg-muted max-w-[90%] leading-relaxed bg-surface/50 p-1.5 rounded border border-line">
                                    Dica: Compartilhe uma janela de{" "}
                                    <strong className="text-fg-muted">
                                      {screenTargetW}x{screenTargetH}
                                    </strong>{" "}
                                    para preencher a tela perfeitamente sem
                                    cortes.
                                  </div>
                                </div>
                              )}
                            </div>
                          );

                          const cameraStandbyEl = useCamera ? (
                            <div
                              className="bg-app border-white/15 shadow-2xl overflow-hidden relative transition-all duration-75"
                              style={{
                                width: isPort
                                  ? "100%"
                                  : splitInverted
                                    ? leftPct
                                    : rightPct,
                                height: isPort
                                  ? splitInverted
                                    ? leftPct
                                    : rightPct
                                  : "100%",
                              }}
                            >
                              {cameraStream ? (
                                <CameraPreviewMedia
                                  stream={cameraStream}
                                  cameraBlurEnabled={cameraBlurEnabled}
                                  cameraBgBlurAmount={cameraBgBlurAmount}
                                  filterStyle={getCanvasFilterString(
                                    cameraFilter,
                                    cameraBrightness,
                                    cameraContrast,
                                    cameraShadow,
                                    cameraBlackPoint,
                                    studioLightEnabled,
                                    studioLightIntensity,
                                  )}
                                  flipH={cameraFlipH}
                                  flipV={cameraFlipV}
                                  objectPosition={`${cameraOffsetX}% ${cameraOffsetY}%`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-fg-subtle">
                                  <Loader2 className="w-4 h-4 animate-spin text-fg-muted" />
                                  <span className="text-meta font-mono">
                                    Iniciando...
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : null;

                          return (
                            <div
                              className="w-full h-full relative flex items-center justify-center overflow-hidden"
                              style={getPreviewBgStyle()}
                            >
                              {screenBgType === "camera" && (
                                <CameraBlurredBackground
                                  stream={cameraStream}
                                  blurAmount={cameraBgBlurAmount || 24}
                                />
                              )}
                              <div
                                className={`w-full h-full flex items-center justify-center relative z-10 ${isPort ? "flex-col" : "flex-row"}`}
                              >
                                {splitInverted
                                  ? cameraStandbyEl
                                  : screenStandbyEl}
                                {splitInverted
                                  ? screenStandbyEl
                                  : cameraStandbyEl}
                              </div>

                              {/* Quick Split Controls Overlay on Standby Stage */}
                              {isFeatureEnabled("split_screen_control") && (
                                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-app/85 border border-line/80 px-3 py-1.5 rounded-2xl backdrop-blur shadow-2xl flex items-center gap-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSplitInverted(!splitInverted)
                                    }
                                    title="Inverter Posição da Tela e Câmera"
                                    className="p-1 rounded-lg bg-surface hover:bg-muted text-fg-secondary hover:text-fg border border-line transition-colors cursor-pointer"
                                  >
                                    {isPort ? (
                                      <ArrowUpDown className="w-3.5 h-3.5" />
                                    ) : (
                                      <ArrowLeftRight className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  <div className="flex items-center gap-2">
                                    <span className="text-meta font-mono text-fg-muted">
                                      Divisão
                                    </span>
                                    <Slider
                                      min={15}
                                      max={85}
                                      step={1}
                                      value={Math.round(splitRatio * 100)}
                                      onChange={(val) => setSplitRatio(val / 100)}
                                      className="w-20 md:w-28"
                                      aria-label="Divisão de tela"
                                    />
                                    <span className="text-meta font-mono font-bold text-fg-muted w-12 text-center">
                                      {Math.round(splitRatio * 100)}/
                                      {100 - Math.round(splitRatio * 100)}
                                    </span>
                                  </div>

                                  {splitRatio !== 0.5 && (
                                    <button
                                      type="button"
                                      onClick={() => setSplitRatio(0.5)}
                                      className="text-meta font-mono text-fg-muted hover:text-fg bg-surface hover:bg-muted px-1.5 py-0.5 rounded border border-line cursor-pointer"
                                      title="Restaurar 50/50"
                                    >
                                      50/50
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Standby Label Overlay */}
                              <div className="absolute top-4 right-4 bg-app/80 border border-line px-3 py-1.5 rounded-xl shadow backdrop-blur flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                                <span className="w-2 h-2 rounded-full bg-fg-muted animate-pulse" />
                                <span className="font-mono text-meta font-bold text-fg uppercase tracking-wider">
                                  Tela Dividida (Split)
                                </span>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div
                          className="w-full h-full relative p-6 md:p-8 flex flex-col justify-between overflow-hidden transition-all duration-300 animate-fade-in"
                          style={getPreviewBgStyle()}
                        >
                          {screenBgType === "camera" && (
                            <CameraBlurredBackground
                              stream={cameraStream}
                              blurAmount={cameraBgBlurAmount || 24}
                            />
                          )}
                          <>
                            {/* Simulated Operating System Header */}
                            <div className="flex items-center justify-between border-b border-line/60 pb-3 z-10">
                              <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                                <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                                <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                              </div>
                              <span className="text-meta font-mono text-fg-muted tracking-widest uppercase">
                                daniloom Desktop
                              </span>
                              <div className="w-8" />
                            </div>

                            {/* Mock Screen Content (Scaled according to screenSize) */}
                            <div className="flex items-center justify-center flex-grow py-4 relative z-10">
                              {screenStream ? (
                                <div
                                  className={`relative transition-all duration-300 w-full max-w-lg aspect-video overflow-hidden border border-line/80 rounded-2xl shadow-xl bg-app group ${
                                    screenSize === "compact"
                                      ? "scale-75"
                                      : screenSize === "medium"
                                        ? "scale-90"
                                        : "scale-100"
                                  }`}
                                >
                                  <ScreenPreviewMedia
                                    stream={screenStream}
                                    className="w-full h-full object-contain bg-app"
                                  />
                                  <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                    <button
                                      type="button"
                                      onClick={() => requestScreenShare()}
                                      className="text-meta font-medium bg-surface/90 hover:bg-muted border border-line-strong text-fg-default px-2 py-1 rounded-lg backdrop-blur transition-all cursor-pointer flex items-center gap-1 shadow-md"
                                      title="Alterar janela ou tela compartilhada"
                                    >
                                      <Monitor className="w-3 h-3 text-fg-muted" />
                                      <span>Trocar Tela</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (screenStreamRef.current) {
                                          screenStreamRef.current
                                            .getTracks()
                                            .forEach((track) => track.stop());
                                          updateScreenStream(null);
                                        }
                                      }}
                                      className="text-meta font-medium bg-surface/90 hover:bg-inverse border border-line-strong text-fg-default hover:text-fg px-2 py-1 rounded-lg backdrop-blur transition-all cursor-pointer flex items-center gap-1 shadow-md"
                                      title="Parar compartilhamento de tela"
                                    >
                                      <X className="w-3 h-3" />
                                      <span>Parar</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={`flex flex-col items-center justify-center text-center transition-all duration-300 w-full max-w-lg aspect-video ${
                                    screenSize === "compact"
                                      ? "scale-75 bg-app/85 border border-line rounded-3xl shadow-2xl p-6"
                                      : screenSize === "medium"
                                        ? "scale-90 bg-app/70 border border-line rounded-2xl shadow-xl p-5"
                                        : "scale-100 bg-app/45 border border-line/20 rounded-xl p-4"
                                  }`}
                                >
                                  <div className="w-12 h-12 rounded-2xl bg-inverse/5 flex items-center justify-center border border-line-strong/10 mb-3 animate-pulse-slow">
                                    <Monitor className="w-5.5 h-5.5 text-fg-muted/80" />
                                  </div>
                                  <h4 className="font-sans font-medium text-fg-default text-xs">
                                    Pré-visualização de Tela Ativa
                                  </h4>
                                  <p className="text-meta text-fg-muted max-w-xs mt-0.5 leading-relaxed mb-3">
                                    Sua área de trabalho será selecionada ao
                                    iniciar. A câmera flutuará em tempo real.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => requestScreenShare()}
                                    className="text-meta font-medium bg-surface hover:bg-muted border border-line-strong/80 text-fg-default px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Monitor className="w-3.5 h-3.5 text-fg-muted" />
                                    <span>Testar Compartilhamento</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </>

                          {/* Camera Overlay inside mockup */}
                          {useCamera &&
                            (cameraShape === "circle" ||
                              cameraShape === "rectangle") && (
                              <div
                                className={`absolute flex items-center gap-3 transition-all duration-300 z-20 ${
                                  cameraPosition === "top-left"
                                    ? "top-14 left-6"
                                    : cameraPosition === "top-right"
                                      ? "top-14 right-6"
                                      : cameraPosition === "bottom-right"
                                        ? "bottom-6 right-6"
                                        : cameraPosition === "bottom-center"
                                          ? "bottom-6 left-1/2 -translate-x-1/2"
                                          : cameraPosition === "top-center"
                                            ? "top-14 left-1/2 -translate-x-1/2"
                                            : "bottom-6 left-6"
                                }`}
                              >
                                 <div
                                  className={`border border-white/15 shadow-2xl overflow-hidden bg-app relative flex items-center justify-center transition-all duration-300 ${
                                    cameraShape === "circle"
                                      ? "rounded-full"
                                      : "rounded-2xl"
                                  } ${
                                    cameraShape === "circle"
                                      ? bubbleSize === "sm"
                                        ? "w-28 h-28"
                                        : bubbleSize === "md"
                                          ? "w-40 h-40"
                                          : "w-56 h-56"
                                      : bubbleSize === "sm"
                                        ? "w-48 h-36"
                                        : bubbleSize === "md"
                                          ? "w-64 h-48"
                                          : "w-88 h-64"
                                  }`}
                                >
                                  {cameraStream ? (
                                    <CameraPreviewMedia
                                      stream={cameraStream}
                                      cameraBlurEnabled={cameraBlurEnabled}
                                      cameraBgBlurAmount={cameraBgBlurAmount}
                                      filterStyle={getCanvasFilterString(
                                        cameraFilter,
                                        cameraBrightness,
                                        cameraContrast,
                                        cameraShadow,
                                        cameraBlackPoint,
                                        studioLightEnabled,
                                        studioLightIntensity,
                                      )}
                                      flipH={cameraFlipH}
                                      flipV={cameraFlipV}
                                      objectPosition={`${cameraOffsetX}% ${cameraOffsetY}%`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center gap-1 text-fg-subtle">
                                      <Loader2 className="w-4 h-4 animate-spin text-fg-muted" />
                                      <span className="text-meta font-mono">
                                        Câmera...
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="bg-app/80 border border-line px-2 py-1 rounded-lg backdrop-blur text-meta font-medium font-mono text-fg-muted">
                                  Câmera (
                                  {cameraShape === "circle"
                                    ? "Círculo"
                                    : "Retângulo"}
                                  )
                                </div>
                              </div>
                            )}

                          {/* Standby Label Overlay */}
                          <div className="absolute top-4 right-4 bg-app/80 border border-line px-3 py-1.5 rounded-xl shadow backdrop-blur flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                            <span className="w-2 h-2 rounded-full bg-fg-muted animate-pulse" />
                            <span className="font-mono text-meta font-bold text-fg uppercase tracking-wider">
                              Pronto (Sobreposição)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Float Toast Banner */}
                {toastMessage && (
                  <div
                    className={`absolute top-4 left-4 right-4 border px-4 py-3 rounded-xl text-xs flex items-center justify-between backdrop-blur shadow-2xl z-50 transition-all ${
                      toastMessage.type === "error"
                        ? "bg-muted border-line-strong text-fg-default"
                        : toastMessage.type === "success"
                          ? "bg-overlay border-line text-fg-default"
                          : "bg-surface/90 border-line-strong/40 text-fg-default"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {toastMessage.type === "success" && (
                        <Check className="w-4 h-4" />
                      )}
                      <span>{toastMessage.text}</span>
                    </div>
                    <button
                      onClick={() => setToastMessage(null)}
                      className="opacity-70 hover:opacity-100 font-mono font-bold px-1 text-sm"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Hidden file input for WAV audio replacement */}
                <input
                  type="file"
                  ref={audioInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleAudioUpload(file);
                    }
                    e.target.value = "";
                  }}
                  accept=".wav"
                  className="hidden"
                />
              </div>
            </div>{" "}
            {/* Close Main Stage Container */}
            {showTrim && isAdmin() && (
              <div>
                <TrimSection
                  clip={selectedClip}
                  onClose={() => setShowTrim(false)}
                  currentTime={currentPlaybackTime}
                  onFinish={(newBlob, newDuration, newUrl) => {
                    if (selectedClip) {
                      const updatedClip = {
                        ...selectedClip,
                        blob: newBlob,
                        duration: newDuration,
                        url: newUrl,
                      };
                      setClips((prev) =>
                        prev.map((c) =>
                          c.id === selectedClip.id ? updatedClip : c,
                        ),
                      );
                      setSelectedClip(updatedClip);
                    }
                    setShowTrim(false);
                    showToast("Clip ajustado com sucesso!", "success");
                  }}
                />
              </div>
            )}
            {!timelineCollapsed && (
              <Timeline
                clips={currentClips}
                selectedClipId={selectedClip?.id || null}
                onSelectClip={setSelectedClip}
                onRemoveClip={handleRemoveClip}
                onReorderClips={handleReorderClips}
                onRenameClip={handleRenameClip}
                onImportClip={(newClip) => {
                  setClips((prev) => [
                    ...prev,
                    { ...newClip, format: recordingFormat },
                  ]);
                }}
                onClearClips={handleClearClips}
                onDownloadClip={handleDownloadClip}
                onMergeAndDownload={handleMergeAndDownload}
                onOpenYouTubeUpload={(clip) => {
                  setYoutubeUploadClip(clip);
                  setShowYouTubeModal(true);
                }}
                onMergeClipsToTimeline={handleMergeClipsToTimeline}
                isMergingToTimeline={isMergingToTimeline}
                isExporting={isMerging}
                exportProgress={isMergingToTimeline ? mergeTimelineProgress : mergeProgress}
              />
            )}
          </section>

          {/* RIGHT SIDE: Control tabs & configuration */}
          {isRightSidebarVisible && (
            <section className="lg:col-span-4 flex flex-col gap-6 w-full lg:self-start">
              {/* Tabs Nav */}
              <SegmentedControl
                value={activeTab}
                onChange={(tab) => setActiveTab(tab as typeof activeTab)}
                options={[
                  { value: "record", label: "Gravação" },
                  { value: "scenes", label: "Cenas" },
                  { value: "settings", label: "Configurações" },
                ]}
              />

              {/* TAB CONTAINER */}
              <div className="ds-glass rounded-3xl p-6 flex-1 min-h-0 flex flex-col overflow-y-auto">
                {/* TAB 1: Recording & Device setup */}
                {activeTab === "record" && (
                  <div className="flex flex-col gap-6 h-full justify-between">
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
                          <Settings className="w-4 h-4 text-fg-muted" />
                          <span>Configurar Gravação</span>
                        </h3>
                        {/* Video Format (Aspect Ratio) */}
                        <div className="flex items-center p-0.5 gap-0.5">
                          <button
                            onClick={() => handleFormatSelect("landscape")}
                            disabled={isRecording}
                            title="Computador"
                            className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                              recordingFormat === "landscape"
                                ? "ds-active"
                                : "text-fg-muted hover:text-fg-secondary hover:bg-muted/50"
                            } disabled:opacity-50 cursor-pointer`}
                          >
                            <Monitor className="w-4 h-4" />
                          </button>
                          {isFeatureEnabled("recording_mode_mobile") && (
                            <button
                              onClick={() => handleFormatSelect("portrait")}
                              disabled={isRecording}
                              title="Celular"
                              className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                                recordingFormat === "portrait"
                                  ? "ds-active"
                                  : "text-fg-muted hover:text-fg-secondary hover:bg-muted/50"
                              } disabled:opacity-50 cursor-pointer`}
                            >
                              <Smartphone className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ACCORDION TABS NAVIGATION FOR RECORD SETUP */}
                      <div className="flex items-center gap-1 p-1 rounded-xl text-xs font-medium">
                        <button
                          onClick={() => setActiveConfigSection("devices")}
                          className={`flex-1 py-1 rounded-lg transition-all cursor-pointer text-center ${
                            activeConfigSection === "devices"
                              ? "ds-active"
                              : "text-fg-muted hover:text-fg-secondary"
                          }`}
                        >
                          Aparelhos
                        </button>
                        {isFeatureEnabled("color_filters") && (
                          <button
                            onClick={() => setActiveConfigSection("filters")}
                            className={`flex-1 py-1 rounded-lg transition-all cursor-pointer text-center ${
                              activeConfigSection === "filters"
                                ? "ds-active"
                                : "text-fg-muted hover:text-fg-secondary"
                            }`}
                          >
                            Filtros
                          </button>
                        )}
                        <button
                          onClick={() => setActiveConfigSection("layout")}
                          className={`flex-1 py-1 rounded-lg transition-all cursor-pointer text-center ${
                            activeConfigSection === "layout"
                              ? "ds-active"
                              : "text-fg-muted hover:text-fg-secondary"
                          }`}
                        >
                          Layout
                        </button>
                        {isFeatureEnabled("stage_backgrounds") && (
                          <button
                            onClick={() => setActiveConfigSection("background")}
                            className={`flex-1 py-1 rounded-lg transition-all cursor-pointer text-center ${
                              activeConfigSection === "background"
                                ? "ds-active"
                                : "text-fg-muted hover:text-fg-secondary"
                            }`}
                          >
                            Fundo
                          </button>
                        )}
                      </div>

                      {/* SECTION 1: DEVICES */}
                      {activeConfigSection === "devices" && (
                        <div className="space-y-4 animate-fade-in text-left">
                          {/* Recording Mode */}
                          <div className="space-y-1.5">
                            <label className="block mb-2 text-xs font-medium text-fg-muted">
                              Modo de Gravação
                            </label>
                            <div className="grid grid-cols-3 gap-1">
                              <div className="relative group">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRecordingLayout("screen")
                                  }
                                  disabled={isRecording}
                                  title="Somente tela"
                                  className={`w-full py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center ${
                                    recordingLayout === "screen"
                                      ? "ds-active"
                                      : "text-fg-muted hover:text-fg hover:bg-hover"
                                  } disabled:opacity-50 cursor-pointer`}
                                >
                                  <Monitor className="w-4 h-4" />
                                </button>
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-overlay text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                  Somente tela
                                </span>
                              </div>
                              <div className="relative group">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRecordingLayout("overlay")
                                  }
                                  disabled={isRecording}
                                  title="Tela + câmera"
                                  className={`w-full py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center ${
                                    recordingLayout === "overlay"
                                      ? "ds-active"
                                      : "text-fg-muted hover:text-fg hover:bg-hover"
                                  } disabled:opacity-50 cursor-pointer`}
                                >
                                  <PictureInPicture2 className="w-4 h-4" />
                                </button>
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-overlay text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                  Tela + câmera
                                </span>
                              </div>
                              <div className="relative group">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRecordingLayout("camera")
                                  }
                                  disabled={isRecording}
                                  title="Somente câmera"
                                  className={`w-full py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center ${
                                    recordingLayout === "camera"
                                      ? "ds-active"
                                      : "text-fg-muted hover:text-fg hover:bg-hover"
                                  } disabled:opacity-50 cursor-pointer`}
                                >
                                  <Video className="w-4 h-4" />
                                </button>
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-overlay text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                  Somente câmera
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Camera Select & Flip Controls */}
                          {recordingLayout !== "screen" && (
                            <div className="space-y-1.5">
                              <label className="block mb-2 text-xs font-medium text-fg-muted">
                                Câmera (Webcam)
                              </label>
                              <div className="flex items-center gap-2">
                                <select
                                  value={selectedCamera}
                                  onChange={(e) =>
                                    setSelectedCamera(e.target.value)
                                  }
                                  disabled={
                                    (recordingMode === "screen" && !useCamera) ||
                                    videoDevices.length === 0
                                  }
                                  className="flex-1 bg-transparent px-3 py-2 rounded-xl text-xs text-fg-default outline-none focus:bg-hover disabled:opacity-40"
                                >
                                  {videoDevices.length === 0 ? (
                                    <option value="">
                                      Nenhuma câmera encontrada
                                    </option>
                                  ) : (
                                    videoDevices.map((d) => (
                                      <option key={d.deviceId} value={d.deviceId}>
                                        {d.label ||
                                          `Camera ${d.deviceId.substring(0, 5)}`}
                                      </option>
                                    ))
                                  )}
                                </select>
                                {isMobile && (
                                  <button
                                    type="button"
                                    onClick={handleFlipCamera}
                                    disabled={
                                      recordingMode === "screen" && !useCamera
                                    }
                                    title="Alternar Câmera (Frontal / Traseira / Mobile Flip)"
                                className="p-2 hover:bg-hover text-fg-muted hover:text-fg rounded-xl transition-all cursor-pointer disabled:opacity-40 shrink-0"
                                  >
                                    <SwitchCamera className="w-4 h-4 text-fg-muted" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setCameraFlipH(!cameraFlipH)}
                                  disabled={
                                    recordingMode === "screen" && !useCamera
                                  }
                                  title={
                                    cameraFlipH
                                      ? "Modo Espelho Ativo (Clique para desativar)"
                                      : "Modo Natural (Clique para espelhar)"
                                  }
                                  className={`p-2 rounded-xl transition-all cursor-pointer disabled:opacity-40 shrink-0 ${
                                    cameraFlipH
                                      ? "ds-active"
                                      : "text-fg-muted hover:text-fg hover:bg-hover"
                                  }`}
                                >
                                  <FlipHorizontal className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Mic Select */}
                          <div className="space-y-2">
                            <label className="mb-2 text-xs font-medium text-fg-muted flex items-center justify-between">
                              <span>Microfone (Áudio)</span>
                              <input
                                type="checkbox"
                                checked={useMic}
                                onChange={(e) => setUseMic(e.target.checked)}
                                className="rounded border-line-strong bg-app text-fg-muted focus:ring-line"
                              />
                            </label>
                            <select
                              value={selectedMic}
                              onChange={(e) => handleMicSelect(e.target.value)}
                              disabled={!useMic}
                              className="w-full bg-transparent px-3 py-2 rounded-xl text-xs text-fg-default outline-none focus:bg-hover disabled:opacity-40"
                            >
                              <option value="default">
                                🔊 Padrão do Sistema (Automático)
                              </option>
                              {audioDevices
                                .filter((d) => d.deviceId !== "default")
                                .map((d) => (
                                  <option key={d.deviceId} value={d.deviceId}>
                                    {d.label ||
                                      `Microfone ${d.deviceId.substring(0, 5)}`}
                                  </option>
                                ))}
                            </select>

                            {/* Volume Control Slider with Real-time Visual Audio Return (Retorno de Áudio) */}
                            {useMic && (
                              <div className="pt-1 animate-fade-in">
                                <MicVolumeSlider
                                  stream={micStreamForVU}
                                  volume={micGain}
                                  onChange={handleMicGainChange}
                                  onSpeakingChange={setIsSpeaking}
                                />
                              </div>
                            )}
                          </div>

                          {/* Recording Resolution Selector */}
                          <div className="space-y-1.5">
                            <label className="mb-2 text-xs font-medium text-fg-muted flex items-center justify-between">
                              <span>Resolução de Gravação</span>
                              <span className="text-meta text-fg-muted font-normal">
                                Otimização de CPU
                              </span>
                            </label>
                            <div className="grid grid-cols-3 gap-1">
                              {[
                                {
                                  id: "720p",
                                  label: "720p (HD)",
                                  desc: "Menos CPU • Rápido",
                                },
                                {
                                  id: "1080p",
                                  label: "1080p (FHD)",
                                  desc: "Recomendado",
                                },
                                {
                                  id: "4k",
                                  label: "4K (UHD)",
                                  desc: "Alta Qualidade",
                                },
                              ].map((res) => (
                                <div
                                  key={res.id}
                                  className="relative group flex-1"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleResolutionSelect(res.id as any)
                                    }
                                    className={`w-full py-1.5 rounded-xl text-xs font-medium transition-all flex items-center justify-center cursor-pointer ${
                                      recordingResolution === res.id
                                        ? "ds-active"
                                        : "text-fg-muted hover:text-fg hover:bg-hover"
                                    }`}
                                  >
                                    {res.id.toUpperCase()}
                                  </button>
                                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-app border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                    {res.label} - {res.desc}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* SECTION 2: WEBCAM FILTERS */}
                      {activeConfigSection === "filters" && (
                        <div className="space-y-4 animate-fade-in text-left">
                          <div className="space-y-1.5">
                            <label className="block mb-2 text-xs font-medium text-fg-muted">
                              Filtro da Webcam
                            </label>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                { id: "none", label: "Nenhum", icon: Ban },
                                {
                                  id: "cool",
                                  label: "Frio ❄️",
                                  icon: Snowflake,
                                },
                                { id: "warm", label: "Quente 🔥", icon: Flame },
                                {
                                  id: "grayscale",
                                  label: "P&B 🎬",
                                  icon: Film,
                                },
                              ].map((filter) => {
                                const IconComponent = filter.icon;
                                return (
                                  <div
                                    key={filter.id}
                                    className="relative group flex-1"
                                  >
                                    <button
                                      onClick={() => setCameraFilter(filter.id)}
                                      className={`w-full py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center border cursor-pointer ${
                                        cameraFilter === filter.id
                                          ? "ds-active border-transparent"
                                          : "bg-transparent border-transparent text-fg-muted hover:text-fg-secondary hover:bg-surface/50"
                                      }`}
                                    >
                                      <IconComponent className="w-4 h-4" />
                                    </button>
                                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-app border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                      {filter.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Image Adjustments (Ajustes de Imagem) */}
                          <div className="pt-3 border-t border-line space-y-4">
                            <label className="block mb-2 text-xs font-medium text-fg-muted">
                              Ajustes de Imagem
                            </label>

                            {/* Tabs with Icons */}
                            <div className="grid grid-cols-4 gap-1">
                              {[
                                {
                                  id: "brightness",
                                  label: "Brilho",
                                  icon: Sun,
                                },
                                {
                                  id: "contrast",
                                  label: "Contraste",
                                  icon: Contrast,
                                },
                                { id: "shadow", label: "Sombra", icon: Moon },
                                {
                                  id: "blackPoint",
                                  label: "Ponto Preto",
                                  icon: Sliders,
                                },
                              ].map((tab) => {
                                const IconComp = tab.icon;
                                const isActive = activeAdjustmentTab === tab.id;
                                return (
                                  <div
                                    key={tab.id}
                                    className="relative group flex-1"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveAdjustmentTab(tab.id as any)
                                      }
                                      className={`w-full py-2 rounded-lg transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                                        isActive
                                          ? "ds-active"
                                          : "text-fg-muted hover:text-fg-secondary hover:bg-surface/40"
                                      }`}
                                    >
                                      <IconComp className="w-4.5 h-4.5" />
                                    </button>
                                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-app border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                      {tab.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="pt-1.5">
                              {activeAdjustmentTab === "brightness" && (
                                <div className="py-2">
                                  <Slider
                                    min={50}
                                    max={150}
                                    step={1}
                                    value={cameraBrightness}
                                    onChange={setCameraBrightness}
                                    aria-label="Brilho da câmera"
                                  />
                                </div>
                              )}

                              {activeAdjustmentTab === "contrast" && (
                                <div className="py-2">
                                  <Slider
                                    min={50}
                                    max={150}
                                    step={1}
                                    value={cameraContrast}
                                    onChange={setCameraContrast}
                                    aria-label="Contraste da câmera"
                                  />
                                </div>
                              )}

                              {activeAdjustmentTab === "shadow" && (
                                <div className="py-2">
                                  <Slider
                                    min={-50}
                                    max={50}
                                    step={1}
                                    value={cameraShadow}
                                    onChange={setCameraShadow}
                                    aria-label="Sombra da câmera"
                                  />
                                </div>
                              )}

                              {activeAdjustmentTab === "blackPoint" && (
                                <div className="py-2">
                                  <Slider
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={cameraBlackPoint}
                                    onChange={setCameraBlackPoint}
                                    aria-label="Ponto preto da câmera"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Desfoque de Fundo */}
                          {isFeatureEnabled("camera_blur") && (
                            <div className="pt-3 border-t border-line space-y-1.5">
                              <label className="block mb-2 text-xs font-medium text-fg-muted">
                                Desfoque de Fundo
                              </label>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[
                                  {
                                    amount: 0,
                                    title: "Sem Desfoque",
                                    icon: User,
                                  },
                                  {
                                    amount: 5,
                                    title: "Desfoque Leve",
                                    icon: CircleDashed,
                                  },
                                  {
                                    amount: 12,
                                    title: "Desfoque Intenso",
                                    icon: CircleDot,
                                  },
                                ].map((blurOpt) => {
                                  const IconComponent = blurOpt.icon;
                                  const isActive =
                                    (!cameraBlurEnabled &&
                                      blurOpt.amount === 0) ||
                                    (cameraBlurEnabled &&
                                      cameraBgBlurAmount === blurOpt.amount &&
                                      blurOpt.amount !== 0);
                                  return (
                                    <div
                                      key={blurOpt.amount}
                                      className="relative group flex-1"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (blurOpt.amount === 0) {
                                            if (cameraBlurEnabled)
                                              toggleCameraBlur();
                                          } else {
                                            if (!cameraBlurEnabled)
                                              toggleCameraBlur();
                                            setCameraBgBlurAmount(
                                              blurOpt.amount,
                                            );
                                            localStorage.setItem(
                                              "daniloom_camera_bg_blur_amount",
                                              String(blurOpt.amount),
                                            );
                                          }
                                        }}
                                        className={`w-full py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center border cursor-pointer ${
                                          isActive
                                            ? "ds-active border-transparent"
                                            : "bg-transparent border-transparent text-fg-muted hover:text-fg-secondary hover:bg-surface/50"
                                        }`}
                                      >
                                        <IconComponent className="w-4 h-4" />
                                      </button>
                                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-app border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                        {blurOpt.title}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Flips Toggles */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="relative group flex-1">
                              <button
                                onClick={() => setCameraFlipH(!cameraFlipH)}
                                className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center cursor-pointer ${
                                  cameraFlipH
                                    ? "ds-active border-transparent"
                                    : "bg-transparent border-transparent text-fg-muted hover:text-fg-default hover:border-line-strong"
                                }`}
                              >
                                <ArrowLeftRight className="w-4 h-4" />
                              </button>
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-app border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                Espelhar Horizontalmente (Horiz.)
                              </span>
                            </div>

                            <div className="relative group flex-1">
                              <button
                                onClick={() => setCameraFlipV(!cameraFlipV)}
                                className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center cursor-pointer ${
                                  cameraFlipV
                                    ? "ds-active border-transparent"
                                    : "bg-transparent border-transparent text-fg-muted hover:text-fg-default hover:border-line-strong"
                                }`}
                              >
                                <ArrowUpDown className="w-4 h-4" />
                              </button>
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-app border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                Espelhar Verticalmente (Vert.)
                              </span>
                            </div>
                          </div>

                          {/* Persistent Save and Reset Buttons */}
                          <div className="pt-3 border-t border-line grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCameraFilter("none");
                                setCameraBrightness(100);
                                setCameraContrast(100);
                                setCameraShadow(0);
                                setCameraBlackPoint(0);
                                setCameraFlipH(true);
                                setCameraFlipV(false);
                              }}
                              className="py-2 px-3 rounded-xl text-xs font-semibold bg-transparent hover:bg-hover text-fg-muted hover:text-fg-default border border-transparent hover:border-line-strong transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Resetar Padrão</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                localStorage.setItem(
                                  "daniloom_default_camera_filter",
                                  cameraFilter,
                                );
                                localStorage.setItem(
                                  "daniloom_default_camera_brightness",
                                  String(cameraBrightness),
                                );
                                localStorage.setItem(
                                  "daniloom_default_camera_contrast",
                                  String(cameraContrast),
                                );
                                localStorage.setItem(
                                  "daniloom_default_camera_shadow",
                                  String(cameraShadow),
                                );
                                localStorage.setItem(
                                  "daniloom_default_camera_black_point",
                                  String(cameraBlackPoint),
                                );
                                localStorage.setItem(
                                  "daniloom_default_camera_flip_h",
                                  String(cameraFlipH),
                                );
                                localStorage.setItem(
                                  "daniloom_default_camera_flip_v",
                                  String(cameraFlipV),
                                );
                                setFilterSavedFeedback(true);
                                setTimeout(
                                  () => setFilterSavedFeedback(false),
                                  2000,
                                );
                              }}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                                filterSavedFeedback
                                  ? "bg-inverse hover:bg-inverse-hover text-on-inverse"
                                  : "bg-surface hover:bg-muted text-fg-default border border-line"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>
                                {filterSavedFeedback
                                  ? "Ajustes Salvos!"
                                  : "Salvar Padrões"}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* SECTION 3: RECORDING LAYOUT */}
                      {activeConfigSection === "layout" && (
                        <div className="space-y-4 animate-fade-in text-left">
                          {/* Camera Shape */}
                          <div className="space-y-1.5">
                            <label className="block mb-2 text-xs font-medium text-fg-muted">
                              Formato da Webcam
                            </label>
                            <div className="grid grid-cols-6 gap-1">
                              {[
                                {
                                  id: "circle",
                                  label: "Círculo",
                                  icon: Circle,
                                },
                                {
                                  id: "rectangle",
                                  label: "Retângulo",
                                  icon: Square,
                                },
                                {
                                  id: "split",
                                  label: "Dividido",
                                  icon: Columns,
                                },
                                {
                                  id: "centralized",
                                  label: "Centralizando",
                                  icon: Focus,
                                },
                                {
                                  id: "fullscreen",
                                  label: "Tela Cheia",
                                  icon: Maximize,
                                },
                                {
                                  id: "hidden",
                                  label: "Ocultar",
                                  icon: EyeOff,
                                },
                              ].map((shape) => {
                                const IconComponent = shape.icon;
                                return (
                                  <div
                                    key={shape.id}
                                    className="relative group flex-1"
                                  >
                                    <button
                                      onClick={() =>
                                        setCameraShape(shape.id as any)
                                      }
                                      className={`w-full py-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                                        cameraShape === shape.id
                                          ? "ds-active"
                                          : "text-fg-muted hover:text-fg-secondary hover:bg-surface/40"
                                      }`}
                                    >
                                      <IconComponent className="w-4 h-4" />
                                    </button>
                                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-app border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                      {shape.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Camera Position / Enquadramento Sliders */}
                          {cameraShape !== "hidden" && (
                            <div className="space-y-2 pt-2 border-t border-line/80 animate-fade-in">
                              <label className="block mb-2 text-xs font-medium text-fg-muted">
                                Enquadramento / Posição na Câmera
                              </label>
                              <div className="flex items-center gap-2.5 px-1 py-1.5">
                                <ArrowUp className="w-4 h-4 text-fg-muted shrink-0" />
                                <Slider
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={cameraOffsetY}
                                  onChange={setCameraOffsetY}
                                  aria-label="Posição vertical do enquadramento"
                                />
                                <ArrowDown className="w-4 h-4 text-fg-muted shrink-0" />
                              </div>

                              <div className="flex items-center gap-2.5 px-1 py-1.5">
                                <ArrowLeft className="w-4 h-4 text-fg-muted shrink-0" />
                                <Slider
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={cameraOffsetX}
                                  onChange={setCameraOffsetX}
                                  aria-label="Posição horizontal do enquadramento"
                                />
                                <ArrowRight className="w-4 h-4 text-fg-muted shrink-0" />
                              </div>
                            </div>
                          )}

                          {/* Camera Alignment Grid (Only active in Camera Mode) */}
                          {recordingMode === "camera" && (
                            <div className="flex items-center justify-between p-3 rounded-xl border border-line animate-fade-in">
                              <div className="flex flex-col pr-2">
                                <div className="flex items-center gap-1.5">
                                  <Grid3X3 className="w-3.5 h-3.5 text-fg-muted" />
                                  <span className="text-xs font-semibold text-fg-default">
                                    Grade de Enquadramento
                                  </span>
                                </div>
                                <span className="text-meta text-fg-muted mt-0.5">
                                  Linhas 3x3 e ponto central minimalista para
                                  alinhar e centralizar sua posição
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={toggleCameraGrid}
                                className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                                  cameraGridEnabled ? "bg-inverse" : "bg-muted"
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                                    cameraGridEnabled ? "left-5" : "left-1"
                                  }`}
                                />
                              </button>
                            </div>
                          )}

                          {/* Camera Position (if standard PIP overlay) */}
                          {recordingMode === "screen" &&
                            cameraShape !== "split" &&
                            cameraShape !== "hidden" &&
                            cameraShape !== "centralized" &&
                            cameraShape !== "fullscreen" &&
                            recordingFormat === "landscape" && (
                              <div className="space-y-1.5">
                                <label className="block mb-2 text-xs font-medium text-fg-muted">
                                  Posição da Câmera
                                </label>
                                <div className="grid grid-cols-4 gap-1.5">
                                  {[
                                    {
                                      id: "top-left",
                                      label: "Sup. Esq.",
                                      icon: ArrowUpLeft,
                                    },
                                    {
                                      id: "top-right",
                                      label: "Sup. Dir.",
                                      icon: ArrowUpRight,
                                    },
                                    {
                                      id: "bottom-left",
                                      label: "Inf. Esq.",
                                      icon: ArrowDownLeft,
                                    },
                                    {
                                      id: "bottom-right",
                                      label: "Inf. Dir.",
                                      icon: ArrowDownRight,
                                    },
                                  ].map((pos) => {
                                    const IconComponent = pos.icon;
                                    return (
                                      <div
                                        key={pos.id}
                                        className="relative group flex-1"
                                      >
                                        <button
                                          onClick={() =>
                                            setCameraPosition(pos.id as any)
                                          }
                                          className={`w-full py-1.5 rounded-lg transition-all flex items-center justify-center border cursor-pointer ${
                                            cameraPosition === pos.id
                                              ? "ds-active border-transparent"
                                              : "bg-transparent border-transparent text-fg-muted hover:text-fg-secondary hover:bg-surface/50"
                                          }`}
                                        >
                                          <IconComponent className="w-4 h-4" />
                                        </button>
                                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-app border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                          {pos.label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                          {/* Split Screen Invert & Ratio Controls (Computer & Mobile) */}
                          {(cameraShape === "split" ||
                            (recordingFormat === "portrait" &&
                              cameraShape !== "centralized" &&
                              cameraShape !== "fullscreen")) && (
                            <div className="space-y-3 pt-2 border-t border-line/80">
                              {/* Invert Position Button */}
                              <div className="space-y-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSplitInverted(!splitInverted)
                                  }
                                  title="Inverter Posição da Tela e Câmera"
                                  className={`w-full py-2.5 px-3 rounded-xl border border-line text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                                    splitInverted
                                      ? "ds-active"
                                      : "bg-surface text-fg-secondary hover:bg-zinc-850 hover:text-fg"
                                  }`}
                                >
                                  {recordingFormat === "portrait" ? (
                                    <ArrowUpDown className="w-4 h-4" />
                                  ) : (
                                    <ArrowLeftRight className="w-4 h-4" />
                                  )}
                                  <span>
                                    {splitInverted
                                      ? "Restaurar Posição Padrão"
                                      : "Inverter Posição da Tela e Câmera"}
                                  </span>
                                </button>
                              </div>

                              {/* Split Ratio Slider */}
                              {isFeatureEnabled("split_screen_control") && (
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex items-center justify-end gap-2">
                                    <span className="text-xs font-mono font-bold text-fg-muted">
                                      {Math.round(splitRatio * 100)}% /{" "}
                                      {Math.round((1 - splitRatio) * 100)}%
                                    </span>
                                    {splitRatio !== 0.5 && (
                                      <button
                                        type="button"
                                        onClick={() => setSplitRatio(0.5)}
                                        className="text-meta px-1.5 py-0.5 rounded bg-muted hover:bg-muted text-fg-secondary font-mono transition-colors cursor-pointer"
                                        title="Restaurar 50/50"
                                      >
                                        50/50
                                      </button>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 px-1 py-1.5">
                                    <span className="text-meta font-mono text-fg-muted shrink-0">
                                      {recordingFormat === "portrait"
                                        ? "Topo"
                                        : "Esq"}
                                    </span>
                                    <Slider
                                      min={15}
                                      max={85}
                                      step={1}
                                      value={Math.round(splitRatio * 100)}
                                      onChange={(val) => setSplitRatio(val / 100)}
                                      aria-label="Proporção da divisão de tela"
                                    />
                                    <span className="text-meta font-mono text-fg-muted shrink-0">
                                      {recordingFormat === "portrait"
                                        ? "Base"
                                        : "Dir"}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Camera Bubble Size */}
                          {((recordingMode === "screen" &&
                            cameraShape !== "split" &&
                            cameraShape !== "hidden" &&
                            cameraShape !== "centralized" &&
                            cameraShape !== "fullscreen" &&
                            recordingFormat === "landscape") ||
                            (recordingMode === "camera" &&
                              cameraShape !== "split" &&
                              cameraShape !== "hidden" &&
                              cameraShape !== "centralized" &&
                              cameraShape !== "fullscreen")) && (
                            <div className="space-y-1.5">
                              <label className="block mb-2 text-xs font-medium text-fg-muted">
                                Tamanho da Câmera
                              </label>
                              <div className="grid grid-cols-3 gap-1">
                                {(
                                  [
                                    {
                                      id: "sm",
                                      label: "Pequeno",
                                      sizeClass: "w-2.5 h-2.5",
                                    },
                                    {
                                      id: "md",
                                      label: "Médio",
                                      sizeClass: "w-3.5 h-3.5",
                                    },
                                    {
                                      id: "lg",
                                      label: "Grande",
                                      sizeClass: "w-4.5 h-4.5",
                                    },
                                  ] as const
                                ).map((sz) => (
                                  <div
                                    key={sz.id}
                                    className="relative group flex-1"
                                  >
                                    <button
                                      onClick={() => setBubbleSize(sz.id)}
                                      className={`w-full py-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                                        bubbleSize === sz.id
                                          ? "ds-active"
                                          : "text-fg-muted hover:text-fg-secondary hover:bg-surface/40"
                                      }`}
                                    >
                                      <Circle
                                        className={`${sz.sizeClass} fill-current`}
                                      />
                                    </button>
                                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-app border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                      {sz.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Simulated Desktop Screen Size to expose background */}
                          {recordingMode === "screen" &&
                            cameraShape !== "split" &&
                            recordingFormat !== "portrait" && (
                              <div className="space-y-1.5">
                                <label className="block mb-2 text-xs font-medium text-fg-muted">
                                  Tamanho da Tela
                                </label>
                                <div className="grid grid-cols-3 gap-1">
                                  {[
                                    {
                                      id: "compact",
                                      label: "Compacto",
                                      icon: Minimize2,
                                    },
                                    {
                                      id: "medium",
                                      label: "Médio",
                                      icon: Maximize2,
                                    },
                                    {
                                      id: "full",
                                      label: "Cheio",
                                      icon: Maximize,
                                    },
                                  ].map((sz) => {
                                    const IconComponent = sz.icon;
                                    return (
                                      <div
                                        key={sz.id}
                                        className="relative group flex-1"
                                      >
                                        <button
                                          onClick={() =>
                                            setScreenSize(sz.id as any)
                                          }
                                          className={`w-full py-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                                            screenSize === sz.id
                                              ? "ds-active"
                                              : "text-fg-muted hover:text-fg-secondary hover:bg-surface/40"
                                          }`}
                                        >
                                          <IconComponent className="w-3.5 h-3.5" />
                                        </button>
                                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-app border border-line text-fg-default text-meta py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 font-medium">
                                          {sz.label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                          {/* Speaker Name Display Configuration */}
                          <div className="pt-3 border-t border-line/60 space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-fg-muted">
                                Exibir Nome na Webcam
                              </label>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={showSpeakerName}
                                  onChange={(e) =>
                                    setShowSpeakerName(e.target.checked)
                                  }
                                  className="sr-only peer"
                                />
                                <div className="w-8 h-4 bg-zinc-850 rounded-full peer peer-focus:ring-1 peer-focus:ring-line peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-muted after:border-line after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-inverse peer-checked:after:bg-white peer-checked:after:border-white"></div>
                              </label>
                            </div>

                            {showSpeakerName && (
                              <div className="space-y-1.5 animate-fade-in">
                                <label className="block mb-2 text-xs font-medium text-fg-muted">
                                  Nome do Apresentador
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="Ex: Danilo Silva"
                                    value={speakerName}
                                    onChange={(e) =>
                                      setSpeakerName(e.target.value)
                                    }
                                    className="w-full bg-transparent border border-line px-3 py-1.5 rounded-xl text-xs text-fg-secondary placeholder:text-fg-subtle outline-none focus:border-line-strong"
                                  />
                                  <Type className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* SECTION 4: SCREEN BACKGROUND */}
                      {activeConfigSection === "background" && (
                        <div className="space-y-4 animate-fade-in text-left">
                          {/* Background Type */}
                          <div className="space-y-1.5">
                            <label className="block mb-2 text-xs font-medium text-fg-muted">
                              Tipo de Fundo
                            </label>
                            <div className="grid grid-cols-4 gap-1 text-meta">
                              {[
                                { id: "solid", label: "Sólido" },
                                { id: "gradient", label: "Gradiente" },
                                { id: "pattern", label: "Padrão" },
                                { id: "camera", label: "Câmera" },
                              ].map((type) => (
                                <button
                                  key={type.id}
                                  onClick={() => {
                                    setScreenBgType(type.id as any);
                                    if (type.id === "solid")
                                      setScreenBgValue("#1e293b");
                                    else if (type.id === "gradient")
                                      setScreenBgValue("sunset");
                                    else if (type.id === "pattern")
                                      setScreenBgValue("grid");
                                    else setScreenBgValue("camera_blur");
                                  }}
                                  className={`py-1 rounded-lg transition-all cursor-pointer ${
                                    screenBgType === type.id
                                      ? "ds-active"
                                      : "text-fg-muted hover:text-fg-secondary"
                                  }`}
                                >
                                  {type.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Background Value Select or Color picker */}
                          {screenBgType === "solid" && (
                            <div className="space-y-2">
                              <label className="block mb-2 text-xs font-medium text-fg-muted">
                                Cor Sólida
                              </label>
                              <div className="flex items-center gap-3 border border-line p-2 rounded-xl">
                                <input
                                  type="color"
                                  value={screenBgValue}
                                  onChange={(e) =>
                                    setScreenBgValue(e.target.value)
                                  }
                                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 outline-none"
                                />
                                <div className="text-left flex-1">
                                  <span className="text-xs font-mono text-fg-secondary block">
                                    {screenBgValue.toUpperCase()}
                                  </span>
                                  <span className="text-meta text-fg-muted block">
                                    Escolha uma cor sólida de fundo.
                                  </span>
                                </div>
                              </div>

                              {/* Color presets swatches */}
                              <div className="flex gap-1 justify-between pt-1">
                                {[
                                  "#0c0d0f",
                                  "#18181b",
                                  "#27272a",
                                  "#3f3f46",
                                  "#f4f4f5",
                                  "#ffffff",
                                  "#1a1410",
                                ].map((color) => (
                                  <button
                                    key={color}
                                    onClick={() => setScreenBgValue(color)}
                                    style={{ backgroundColor: color }}
                                    className={`w-5.5 h-5.5 rounded-md border cursor-pointer ${
                                      screenBgValue === color
                                        ? "border-line-strong ring-2 ring-line-strong scale-110"
                                        : "border-line"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {screenBgType === "gradient" && (
                            <div className="space-y-2">
                              <label className="block mb-2 text-xs font-medium text-fg-muted">
                                Efeito Gradiente
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  {
                                    id: "sunset",
                                    label: "🌅 Pôr do Sol",
                                    style:
                                      "linear-gradient(135deg, #f43f5e, #8b5cf6)",
                                  },
                                  {
                                    id: "ocean",
                                    label: "🌊 Oceano Profundo",
                                    style:
                                      "linear-gradient(135deg, #0ea5e9, #10b981)",
                                  },
                                  {
                                    id: "cosmic",
                                    label: "🌌 Nebulosa Cósmica",
                                    style:
                                      "linear-gradient(135deg, #6366f1, #ec4899)",
                                  },
                                  {
                                    id: "emerald",
                                    label: "🌲 Floresta Esmeralda",
                                    style:
                                      "linear-gradient(135deg, #065f46, #022c22)",
                                  },
                                ].map((grad) => (
                                  <button
                                    key={grad.id}
                                    onClick={() => setScreenBgValue(grad.id)}
                                    className={`p-2 rounded-xl text-left text-meta font-medium transition-all relative overflow-hidden border cursor-pointer ${
                                      screenBgValue === grad.id
                                        ? "border-line-strong shadow-lg text-fg"
                                        : "border-line text-fg-secondary"
                                    }`}
                                  >
                                    <div
                                      className="absolute inset-0 opacity-15 pointer-events-none"
                                      style={{ backgroundImage: grad.style }}
                                    />
                                    <span className="relative z-10">
                                      {grad.label}
                                    </span>
                                  </button>
                                ))}
                              </div>

                              {/* Custom linear gradient inputs */}
                              <div className="pt-2 border-t border-line space-y-1.5">
                                <span className="text-xs font-medium text-fg-muted block mb-2">
                                  Gradiente Customizado (Hex1,Hex2)
                                </span>
                                <input
                                  type="text"
                                  placeholder="#3b82f6,#8b5cf6"
                                  value={
                                    screenBgValue.includes(",")
                                      ? screenBgValue
                                      : ""
                                  }
                                  onChange={(e) =>
                                    setScreenBgValue(e.target.value)
                                  }
                                  className="w-full bg-transparent border border-line px-3 py-1.5 rounded-xl text-xs font-mono text-fg-secondary outline-none focus:border-line-strong"
                                />
                              </div>
                            </div>
                          )}

                          {screenBgType === "pattern" && (
                            <div className="space-y-1.5">
                              <label className="block mb-2 text-xs font-medium text-fg-muted">
                                Padrão Vetorial
                              </label>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { id: "grid", label: "Grade 🌐" },
                                  { id: "dots", label: "Pontos 🎯" },
                                  { id: "stripes", label: "Listras 🏁" },
                                ].map((pat) => (
                                  <button
                                    key={pat.id}
                                    onClick={() => setScreenBgValue(pat.id)}
                                    className={`py-2 px-1 rounded-xl text-center text-xs font-medium transition-all border cursor-pointer ${
                                      screenBgValue === pat.id
                                        ? "ds-active border-transparent"
                                        : "bg-transparent border-transparent text-fg-muted hover:text-fg-default"
                                    }`}
                                  >
                                    {pat.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {screenBgType === "camera" && (
                            <div className="space-y-2 pt-1 animate-fade-in">
                              <div className="flex items-center justify-between text-meta">
                                <span className="text-fg-muted">Intensidade do Desfoque</span>
                                <span className="font-mono font-medium text-fg">
                                  {cameraBgBlurAmount || 24}px
                                </span>
                              </div>
                              <Slider
                                min={8}
                                max={50}
                                step={2}
                                value={cameraBgBlurAmount || 24}
                                onChange={(val) => setCameraBgBlurAmount(val)}
                                className="w-full"
                                aria-label="Intensidade do Blur da Câmera"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions / Control Buttons */}
                    <div className="pt-2 space-y-3">
                      {!isRecording ? (
                        <div className="space-y-3 w-full animate-fade-in">
                          <div className="flex items-center gap-3 w-full">
                            <button
                              type="button"
                              onClick={startRecordingWithCountdown}
                              disabled={countdown !== null}
                              className="flex-1 py-2.5 rounded-xl bg-inverse hover:bg-inverse-hover text-on-inverse font-medium text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Gravar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowTimerModal(true)}
                              disabled={countdown !== null}
                              className="flex-1 py-2.5 rounded-xl bg-muted hover:bg-hover text-fg font-medium text-xs flex items-center justify-center gap-2 border border-line cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Clock className="w-3.5 h-3.5 text-fg-muted" />
                              <span>
                                Timer{" "}
                                {recordingTimerLimit
                                  ? `(${recordingTimerLimit}s)`
                                  : ""}
                              </span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={
                                isPaused ? resumeRecording : pauseRecording
                              }
                              className={`py-3 rounded-2xl ${
                                isPaused
                                  ? "bg-inverse hover:bg-inverse-hover text-on-inverse shadow-lg shadow-xs"
                                  : "bg-muted hover:bg-muted text-fg border border-zinc-750"
                              } font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all`}
                            >
                              {isPaused ? (
                                <Play className="w-4 h-4 text-fg fill-current" />
                              ) : (
                                <Pause className="w-4 h-4 text-fg-muted" />
                              )}
                              <span>
                                {isPaused
                                  ? isWaitingNextClip
                                    ? "Gravar Próximo"
                                    : "Retomar"
                                  : "Pausar"}
                              </span>
                            </button>
                            <button
                              onClick={stopRecording}
                              className="py-3 rounded-2xl bg-inverse hover:bg-inverse-hover text-on-inverse font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-xs"
                            >
                              <Square className="w-4 h-4 text-on-inverse" />
                              <span>Parar</span>
                            </button>
                          </div>
                          <button
                            onClick={splitClipAndRecordNext}
                            disabled={isWaitingNextClip}
                            className={`w-full py-2.5 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow ${
                              isWaitingNextClip
                                ? "bg-muted border-line text-fg-secondary opacity-80 cursor-default"
                                : "bg-surface hover:bg-muted border-zinc-750 hover:border-line-strong text-fg-default hover:text-fg cursor-pointer"
                            }`}
                            title={
                              isWaitingNextClip
                                ? "Clipe já salvo na timeline. Clique no Play para iniciar a próxima gravação."
                                : "Salvar clipe atual na timeline e pausar para iniciar o próximo manualmente"
                            }
                          >
                            <Clapperboard className="w-3.5 h-3.5 text-fg-muted" />
                            <span>
                              {isWaitingNextClip
                                ? "Clipe Salvo"
                                : "Salvar Clipe & Pausar"}
                            </span>
                          </button>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => void resetRecording()}
                              className="py-2.5 rounded-xl bg-app hover:bg-surface border border-line hover:border-zinc-750 text-fg-secondary hover:text-fg font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-fg-muted" />
                              <span>Resetar</span>
                            </button>
                            <button
                              onClick={() => void cancelRecording()}
                              className="py-2.5 rounded-xl bg-app hover:bg-surface border border-line hover:border-zinc-750 text-fg-secondary hover:text-fg font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow"
                            >
                              <X className="w-3.5 h-3.5 text-fg-muted" />
                              <span>Cancelar</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: Scene Management */}
                {activeTab === "scenes" && (
                  <div className="flex flex-col h-full gap-4 text-left">
                    <div>
                      <h3 className="text-sm font-semibold text-fg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clapperboard className="w-4 h-4 text-fg-muted" />
                          <span>Gerenciador de Cenas</span>
                        </div>
                        <span className="text-meta bg-muted text-fg-muted px-2 py-0.5 rounded-full font-medium">
                          {scenes.length}{" "}
                          {scenes.length === 1 ? "Cena" : "Cenas"}
                        </span>
                      </h3>
                      <p className="text-meta text-fg-muted mt-1">
                        Salve e alterne layouts, fundos e filtros de câmera
                      </p>
                    </div>

                    {/* Create Scene Input */}
                    <div className="pt-1">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Nome da cena (ex: Apresentação)"
                          value={newSceneName}
                          onChange={(e) => setNewSceneName(e.target.value)}
                          className="flex-1 bg-app border border-zinc-850 px-3 py-2 rounded-xl text-xs text-fg-default outline-none focus:border-line-strong font-sans"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const name = newSceneName.trim();
                              if (name) {
                                createScene(name);
                                setNewSceneName("");
                              }
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            const name = newSceneName.trim();
                            if (name) {
                              createScene(name);
                              setNewSceneName("");
                            }
                          }}
                          disabled={!newSceneName.trim()}
                          className="bg-inverse hover:bg-inverse-hover disabled:opacity-40 text-on-inverse p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                          title="Salvar Cena"
                        >
                          <Plus className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>

                    {/* Scene List */}
                    <div className="flex-1 space-y-2 overflow-y-auto min-h-0 pr-1 scrollbar-thin">
                      {scenes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-line rounded-2xl bg-app/20">
                          <Sparkles className="w-6 h-6 text-fg-subtle mb-1.5" />
                          <p className="text-meta text-fg-muted max-w-[200px] leading-relaxed">
                            Nenhuma cena salva. Defina o layout e fundo
                            desejados e salve acima para fácil acesso.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {scenes.map((scene) => (
                            <div
                              key={scene.id}
                              className="group flex items-center justify-between p-2.5 rounded-xl bg-app/60 border border-zinc-850 hover:border-line transition-all text-left"
                            >
                              {editingSceneId === scene.id ? (
                                <div className="flex items-center gap-2 w-full">
                                  <input
                                    type="text"
                                    value={editingSceneName}
                                    onChange={(e) =>
                                      setEditingSceneName(e.target.value)
                                    }
                                    className="flex-1 bg-app border border-line text-xs px-2 py-1.5 rounded-lg text-fg outline-none focus:border-line-strong"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        updateSceneName(
                                          scene.id,
                                          editingSceneName,
                                        );
                                        setEditingSceneId(null);
                                      } else if (e.key === "Escape") {
                                        setEditingSceneId(null);
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      updateSceneName(
                                        scene.id,
                                        editingSceneName,
                                      );
                                      setEditingSceneId(null);
                                    }}
                                    className="p-1.5 rounded-lg text-fg-muted hover:bg-hover transition-all cursor-pointer shrink-0"
                                    title="Salvar"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingSceneId(null)}
                                    className="p-1.5 rounded-lg text-fg-muted hover:bg-muted transition-all cursor-pointer shrink-0"
                                    title="Cancelar"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      applyScene(scene);
                                    }}
                                    className="flex-1 text-left flex flex-col gap-0.5 cursor-pointer"
                                  >
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-semibold text-fg-default group-hover:text-fg-muted transition-colors">
                                        {scene.name}
                                      </span>
                                    </div>
                                    <span className="text-meta text-fg-muted">
                                      {scene.recordingMode === "camera"
                                        ? "Modo Câmera"
                                        : "Modo Tela"}{" "}
                                      • {scene.cameraShape}
                                    </span>
                                  </button>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => {
                                        setEditingSceneId(scene.id);
                                        setEditingSceneName(scene.name);
                                      }}
                                      className="p-1.5 rounded-lg text-fg-subtle hover:text-fg-muted hover:bg-inverse/5 transition-all cursor-pointer"
                                      title="Editar Nome"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        deleteScene(scene.id);
                                      }}
                                      className="p-1.5 rounded-lg text-fg-subtle hover:text-fg-muted hover:bg-inverse/5 transition-all cursor-pointer"
                                      title="Excluir Cena"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "settings" && (
                  <div className="flex flex-col h-full gap-4 text-left">
                    <div>
                      <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
                        <Settings className="w-4 h-4 text-fg-muted" />
                        Configurações
                      </h3>
                      <p className="text-meta text-fg-muted mt-1">
                        Tema e fundo da interface. As cores seguem o design
                        system nos dois modos.
                      </p>
                    </div>
                    <AppearanceSettings
                      theme={theme}
                      onUpdateTheme={updateTheme}
                    />
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </Layout>

      <Modal
        open={showWatermarkModal}
        onClose={() => setShowWatermarkModal(false)}
        size="lg"
        srTitle="Marca d'água"
      >
        <ModalHeader title="Marca d'água" />
        <ModalBody>
          <WatermarkPanel
            config={watermarkConfig}
            onChange={handleWatermarkConfigChange}
          />
        </ModalBody>
      </Modal>

      {isRecording ? (
        <button
          type="button"
          onClick={stopRecording}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary hover:bg-primary-hover text-on-primary shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center animate-pulse"
          title="Parar Gravação"
        >
          <Square className="w-5 h-5 text-on-inverse fill-current" />
        </button>
      ) : (
        (activeTab !== "record" || sidebarCollapsed) && (
          <button
            type="button"
            onClick={() => {
              setActiveTab("record");
              setTimeout(() => {
                startRecordingWithCountdown();
              }, 150);
            }}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary hover:bg-primary-hover text-on-primary shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
            title="Gravar"
          >
            <Video className="w-6 h-6 text-on-inverse" />
          </button>
        )
      )}

      {!isRecording && (
        <button
          type="button"
          onClick={() => setShowHelpModal(true)}
          className="fixed bottom-6 left-6 z-40 w-12 h-12 rounded-full ds-glass text-fg-muted hover:text-fg flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer"
          title="Ajuda e Dicas"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      )}

      <Modal
        open={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        size="xl"
      >
        <ModalHeader
          title="Central de Ajuda"
          icon={<HelpCircle className="w-4 h-4 text-fg-muted" />}
        />
        <ModalBody>
          <SegmentedControl
            value={helpTab}
            onChange={(tab) => setHelpTab(tab as "tips" | "shortcuts")}
            options={[
              { value: "tips" as const, label: "Dicas & Otimização" },
              { value: "shortcuts" as const, label: "Atalhos" },
            ]}
          />
          {helpTab === "tips" ? (
            <div className="space-y-6 text-xs text-fg-secondary">
              <section>
                <h4 className="font-semibold text-fg-default flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-success-fg" />
                  Técnicas de Otimização e Prevenção de Lags
                </h4>
                <ul className="space-y-2 list-disc list-inside ml-2">
                  <li>
                    <strong>Feche abas não utilizadas:</strong> O Chrome consome
                    muita memória RAM. Para evitar que a câmera trave, mantenha
                    poucas abas e programas abertos.
                  </li>
                  <li>
                    <strong>Aceleração de Hardware:</strong> Certifique-se de
                    que a aceleração de hardware esteja ativada no seu
                    navegador.
                  </li>
                  <li>
                    <strong>Tamanho de Tela:</strong> Ao gravar a tela e a
                    câmera simultaneamente, monitores 4K podem sobrecarregar o
                    processador. Se estiver travando, diminua a resolução do seu
                    monitor para 1080p ou 720p.
                  </li>
                  <li>
                    <strong>Energia:</strong> Se usar notebook, deixe-o
                    conectado na tomada. O modo de economia de energia reduz a
                    performance do processador e causa lentidão no vídeo.
                  </li>
                </ul>
              </section>
              <section>
                <h4 className="font-semibold text-fg-default flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-fg-muted" />
                  Qual o melhor formato de tela?
                </h4>
                <p className="mb-2">
                  Para criar conteúdos consistentes, escolha o formato antes de
                  iniciar a gravação:
                </p>
                <ul className="space-y-2 list-disc list-inside ml-2">
                  <li>
                    <strong>Paisagem (16:9):</strong> Ideal para YouTube,
                    cursos, apresentações e webinars. (1920x1080 ou 1280x720).
                  </li>
                  <li>
                    <strong>Retrato (9:16):</strong> Perfeito para TikTok,
                    Reels, Shorts e Instagram. (1080x1920 ou 720x1280).
                  </li>
                </ul>
              </section>
            </div>
          ) : (
            <div className="space-y-3">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.id}
                  className="flex items-center justify-between py-2 border-b border-line"
                >
                  <span className="text-xs text-fg-secondary font-medium">
                    {shortcut.label}
                  </span>
                  <Kbd>{renderShortcutKeys(shortcut)}</Kbd>
                </div>
              ))}
            </div>
          )}
        </ModalBody>
      </Modal>

      <Modal
        open={showTimerModal}
        onClose={() => setShowTimerModal(false)}
        size="sm"
      >
        <ModalHeader
          title="Limite de Gravação"
          icon={<Clock className="w-4 h-4 text-fg-muted" />}
        />
        <ModalBody>
          <p className="text-xs text-fg-muted leading-relaxed">
            Defina o tempo máximo da gravação. A gravação irá parar
            automaticamente ao atingir o limite estipulado.
          </p>
          <div>
            <Label>Tempo em segundos (Ex: 60 para 1 minuto)</Label>
            <Input
              type="number"
              min={1}
              placeholder="Ex: 60"
              value={recordingTimerLimit || ""}
              onChange={(e) =>
                setRecordingTimerLimit(
                  e.target.value ? parseInt(e.target.value, 10) : null,
                )
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="subtle"
              size="sm"
              className="flex-1"
              onClick={() => setRecordingTimerLimit(60)}
            >
              60s (1 min)
            </Button>
            <Button
              variant="subtle"
              size="sm"
              className="flex-1"
              onClick={() => {
                setRecordingTimerLimit(null);
                setShowTimerModal(false);
              }}
            >
              Sem Limite
            </Button>
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowTimerModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setShowTimerModal(false)}>Salvar</Button>
          </ModalFooter>
        </ModalBody>
      </Modal>

      {/* Picture-in-Picture Floating Controller Portal */}
      {isFeatureEnabled("pip_widget") &&
        pipWindow &&
        createPortal(
          <div className="flex flex-col items-center justify-center h-full w-full bg-app p-3 text-fg select-none">
            {countdown !== null ? (
              <div className="flex flex-col items-center justify-center gap-1">
                <div className="text-meta text-fg-muted font-medium uppercase tracking-wider">
                  Iniciando Gravação
                </div>
                <div className="text-3xl font-bold text-fg-muted animate-pulse">
                  {countdown}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full px-4 gap-6">
                {/* Status and Timer */}
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${isPaused ? "bg-fg-subtle" : "bg-inverse animate-pulse"}`}
                  />
                  <span className="text-sm font-mono font-bold text-fg tabular-nums">
                    {formatTimer(recordingDuration)}
                  </span>
                  {isPaused && (
                    <span className="text-meta bg-fg-subtle/10 text-fg-muted px-1.5 py-0.5 rounded font-semibold uppercase">
                      Pausa
                    </span>
                  )}
                </div>

                {/* Action buttons (only icons with native title/tooltip, no labels as requested) */}
                <div className="flex items-center gap-3">
                  {/* Play/Pause */}
                  <button
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    title={
                      isPaused
                        ? isWaitingNextClip
                          ? "Gravar Próximo Clipe"
                          : "Retomar Gravação"
                        : "Pausar Gravação"
                    }
                    className={`p-2 rounded-lg ${
                      isPaused
                        ? "bg-inverse hover:bg-inverse-hover text-on-inverse"
                        : "bg-muted hover:bg-muted text-fg-default hover:text-fg"
                    } transition-colors cursor-pointer border border-line-strong flex items-center justify-center`}
                  >
                    {isPaused ? (
                      <Play className="w-4 h-4 text-fg fill-current" />
                    ) : (
                      <Pause className="w-4 h-4 text-fg-muted" />
                    )}
                  </button>

                  {/* Split / New Clip */}
                  <button
                    onClick={splitClipAndRecordNext}
                    disabled={isWaitingNextClip}
                    title={
                      isWaitingNextClip
                        ? "Clipe salvo. Clique no Play para gravar o próximo."
                        : "Salvar clipe e pausar"
                    }
                    className={`p-2 rounded-lg ${
                      isWaitingNextClip
                        ? "bg-muted border-line text-fg-secondary opacity-60"
                        : "bg-muted hover:bg-muted text-fg-default hover:text-fg"
                    } transition-colors cursor-pointer border border-line-strong flex items-center justify-center`}
                  >
                    <Clapperboard className="w-4 h-4 text-fg-muted" />
                  </button>

                  {/* Screenshot */}
                  <button
                    onClick={captureScreenShare}
                    title="Capturar Tela"
                    className="p-2 rounded-lg bg-muted hover:bg-muted text-fg-default hover:text-fg transition-colors cursor-pointer border border-line-strong flex items-center justify-center"
                  >
                    <Camera className="w-4 h-4 text-fg-muted" />
                  </button>

                  {/* Reset */}
                  <button
                    onClick={() => void resetRecording()}
                    title="Reiniciar Gravação"
                    className="p-2 rounded-lg bg-muted hover:bg-muted text-fg-default hover:text-fg transition-colors cursor-pointer border border-line-strong flex items-center justify-center"
                  >
                    <RotateCcw className="w-4 h-4 text-fg-muted" />
                  </button>

                  {/* Cancel */}
                  <button
                    onClick={() => void cancelRecording()}
                    title="Cancelar Gravação"
                    className="p-2 rounded-lg bg-muted hover:bg-muted text-fg-default hover:text-fg transition-colors cursor-pointer border border-line-strong flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-fg-muted" />
                  </button>

                  {/* Stop and Save */}
                  <button
                    onClick={stopRecording}
                    title="Parar e Salvar Gravação"
                    className="p-2 rounded-lg bg-inverse hover:bg-inverse-hover text-on-inverse transition-colors cursor-pointer shadow-lg shadow-xs flex items-center justify-center"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>,
          pipWindow.document.body,
        )}

      {/* Picture-in-Picture Floating Controller Fallback (Inline Widget) */}
      {isFeatureEnabled("pip_widget") &&
        isPipFallbackActive &&
        (isRecording || countdown !== null) && (
          <div className="fixed bottom-4 right-4 z-[9999] w-96 bg-surface border border-line rounded-2xl shadow-2xl p-3 text-fg select-none">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-meta text-fg-muted font-medium tracking-wider uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-fg-muted animate-pulse" />
                Controle Flutuante (Iframe)
              </span>
              <button
                onClick={() => setIsPipFallbackActive(false)}
                title="Fechar Widget"
                className="text-fg-muted hover:text-fg-default transition-colors cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {countdown !== null ? (
              <div className="flex flex-col items-center justify-center py-2 gap-1 bg-app/60 rounded-xl border border-line">
                <div className="text-meta text-fg-muted font-medium uppercase tracking-wider">
                  Iniciando em
                </div>
                <div className="text-2xl font-bold text-fg-muted animate-pulse">
                  {countdown}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full px-2 py-1.5 bg-app/60 rounded-xl border border-line gap-4">
                {/* Status and Timer */}
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${isPaused ? "bg-fg-subtle" : "bg-inverse animate-pulse"}`}
                  />
                  <span className="text-base font-mono font-bold text-fg tabular-nums">
                    {formatTimer(recordingDuration)}
                  </span>
                  {isPaused && (
                    <span className="text-meta bg-fg-subtle/10 text-fg-muted px-1 py-0.5 rounded font-semibold uppercase">
                      Pausa
                    </span>
                  )}
                </div>

                {/* Action buttons (only icons with native title/tooltip, no labels as requested) */}
                <div className="flex items-center gap-2.5">
                  {/* Play/Pause */}
                  <button
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    title={
                      isPaused
                        ? isWaitingNextClip
                          ? "Gravar Próximo Clipe"
                          : "Retomar Gravação"
                        : "Pausar Gravação"
                    }
                    className={`p-1.5 rounded-lg ${
                      isPaused
                        ? "bg-inverse hover:bg-inverse-hover text-on-inverse"
                        : "bg-zinc-850 hover:bg-zinc-750 text-fg-default hover:text-fg"
                    } transition-colors cursor-pointer border border-zinc-750 flex items-center justify-center`}
                  >
                    {isPaused ? (
                      <Play className="w-3.5 h-3.5 text-fg fill-current" />
                    ) : (
                      <Pause className="w-3.5 h-3.5 text-fg-muted" />
                    )}
                  </button>

                  {/* Split / New Clip */}
                  <button
                    onClick={splitClipAndRecordNext}
                    disabled={isWaitingNextClip}
                    title={
                      isWaitingNextClip
                        ? "Clipe salvo. Clique no Play para gravar o próximo."
                        : "Salvar clipe e pausar"
                    }
                    className={`p-1.5 rounded-lg ${
                      isWaitingNextClip
                        ? "bg-muted border-line text-fg-secondary opacity-60"
                        : "bg-zinc-850 hover:bg-zinc-750 text-fg-default hover:text-fg"
                    } transition-colors cursor-pointer border border-zinc-750 flex items-center justify-center`}
                  >
                    <Clapperboard className="w-3.5 h-3.5 text-fg-muted" />
                  </button>

                  {/* Screenshot */}
                  <button
                    onClick={captureScreenShare}
                    title="Capturar Tela"
                    className="p-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-750 text-fg-default hover:text-fg transition-colors cursor-pointer border border-zinc-750 flex items-center justify-center"
                  >
                    <Camera className="w-3.5 h-3.5 text-fg-muted" />
                  </button>

                  {/* Reset */}
                  <button
                    onClick={() => void resetRecording()}
                    title="Reiniciar Gravação"
                    className="p-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-750 text-fg-default hover:text-fg transition-colors cursor-pointer border border-zinc-750 flex items-center justify-center"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-fg-muted" />
                  </button>

                  {/* Cancel */}
                  <button
                    onClick={() => void cancelRecording()}
                    title="Cancelar Gravação"
                    className="p-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-750 text-fg-default hover:text-fg transition-colors cursor-pointer border border-zinc-750 flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5 text-fg-muted" />
                  </button>

                  {/* Stop and Save */}
                  <button
                    onClick={stopRecording}
                    title="Parar e Salvar Gravação"
                    className="p-1.5 rounded-lg bg-inverse hover:bg-inverse-hover text-on-inverse transition-colors cursor-pointer shadow-lg shadow-xs flex items-center justify-center"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="mt-1.5 text-center">
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-meta text-fg-muted hover:text-fg-muted underline font-medium inline-block"
              >
                Abra em nova aba para usar o PiP real do sistema
              </a>
            </div>
          </div>
        )}

      {showCropModal && (
        <CropRegionSelector
          cropRegion={cropRegion}
          onChange={(newReg) => {
            setCropRegion(newReg);
            localStorage.setItem(
              "daniloom_crop_region",
              JSON.stringify(newReg),
            );
            setIsCustomCropEnabled(newReg.enabled);
            setCropXPercent(newReg.x);
            setCropYPercent(newReg.y);
            setCropWidthPercent(newReg.width);
            setCropHeightPercent(newReg.height);
          }}
          onClose={() => setShowCropModal(false)}
        />
      )}

      {/* Mobile Always-Visible Floating Recording Bar (Top-of-site / Viewfinder Dock) */}
      {(isMobile ||
        (typeof window !== "undefined" && window.innerWidth <= 768)) &&
        !showTrim &&
        !showWatermarkModal &&
        !showCropModal &&
        !showTimerModal && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 sm:hidden flex items-center gap-2 p-1.5 rounded-full bg-app/92 border border-zinc-750/90 shadow-2xl shadow-black/80 backdrop-blur-xl max-w-[94vw] animate-fade-in select-none">
            {countdown !== null ? (
              <div className="flex items-center gap-3 px-4 py-1.5">
                <span className="text-sm font-black text-fg-muted font-sans animate-pulse">
                  {countdown}
                </span>
                <span className="text-xs text-fg-default font-medium">
                  Iniciando gravação...
                </span>
                <button
                  type="button"
                  onClick={cancelCountdown}
                  className="px-2.5 py-1 text-meta font-semibold text-fg-secondary bg-muted hover:bg-muted rounded-full border border-line-strong transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : !isRecording ? (
              <>
                {/* Switch Camera (if camera is active or in camera mode) */}
                {(recordingMode === "camera" || useCamera) && (
                  <button
                    type="button"
                    onClick={handleFlipCamera}
                    title="Alternar Câmera (Frontal / Traseira)"
                    className="p-2.5 rounded-full bg-surface/90 text-fg-secondary hover:text-fg border border-zinc-750 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-md"
                  >
                    <SwitchCamera className="w-4 h-4 text-fg-muted" />
                  </button>
                )}

                {/* Bluetooth Selfie Remote Trigger / Status */}
                <button
                  type="button"
                  onClick={() => {
                    activateAudioSession();
                    showToast(
                      isAudioSessionActive
                        ? "Controle Remoto Bluetooth Conectado! Pressione o botão do selfie stick."
                        : "Controle Remoto Bluetooth Ativado para iOS! Pressione o botão do selfie stick.",
                      "success",
                    );
                  }}
                  title={
                    isAudioSessionActive
                      ? "Controle Bluetooth Ativo (Clique para testar)"
                      : "Ativar Controle Bluetooth / Pau de Selfie"
                  }
                  className={`p-2.5 rounded-full border active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-md ${
                    isAudioSessionActive
                      ? "bg-muted text-fg-muted border-line-strong"
                      : "bg-surface/90 text-fg-secondary hover:text-fg border-zinc-750"
                  }`}
                >
                  <Bluetooth className="w-4 h-4" />
                </button>

                {/* Timer Modal Button */}
                <button
                  type="button"
                  onClick={() => setShowTimerModal(true)}
                  title="Timer de Gravação"
                  className="p-2.5 rounded-full bg-surface/90 text-fg-secondary hover:text-fg border border-zinc-750 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-md"
                >
                  <Clock className="w-4 h-4 text-fg-muted" />
                  {recordingTimerLimit ? (
                    <span className="text-meta font-mono font-bold text-fg-muted ml-1">
                      {recordingTimerLimit}s
                    </span>
                  ) : null}
                </button>

                {/* Main Record Action Button */}
                <button
                  type="button"
                  onClick={startRecordingWithCountdown}
                  className="px-5 py-2.5 rounded-full bg-inverse hover:bg-inverse-hover text-on-inverse font-medium text-xs flex items-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-on-inverse animate-pulse" />
                  <Video className="w-4 h-4 fill-current" />
                  <span>Gravar</span>
                </button>
              </>
            ) : (
              <>
                {/* Timer Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-line rounded-full">
                  <span
                    className={`w-2 h-2 rounded-full ${isPaused ? "bg-fg-subtle" : "bg-inverse animate-pulse"}`}
                  />
                  <span className="font-mono text-xs font-bold text-fg tabular-nums">
                    {formatTimer(recordingDuration)}
                    {recordingTimerLimit
                      ? ` / ${formatTimer(recordingTimerLimit)}`
                      : ""}
                  </span>
                  {isPaused && (
                    <span className="text-meta bg-muted text-fg-muted px-1 py-0.2 rounded font-semibold uppercase">
                      Pausa
                    </span>
                  )}
                </div>

                {/* Pause / Resume */}
                <button
                  type="button"
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  title={
                    isPaused
                      ? isWaitingNextClip
                        ? "Gravar Próximo"
                        : "Retomar"
                      : "Pausar"
                  }
                  className={`p-2.5 rounded-full border transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
                    isPaused
                      ? "bg-inverse border-line-strong text-on-inverse shadow-xs"
                      : "bg-surface text-fg-default border-line"
                  }`}
                >
                  {isPaused ? (
                    <Play className="w-4 h-4 fill-current" />
                  ) : (
                    <Pause className="w-4 h-4 text-fg-muted" />
                  )}
                </button>

                {/* Split / Save Clip */}
                <button
                  type="button"
                  onClick={splitClipAndRecordNext}
                  disabled={isWaitingNextClip}
                  title={
                    isWaitingNextClip ? "Clipe salvo" : "Salvar clipe e pausar"
                  }
                  className={`p-2.5 rounded-full border transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
                    isWaitingNextClip
                      ? "bg-muted border-line text-fg-secondary opacity-60"
                      : "bg-surface border-line text-fg-secondary"
                  }`}
                >
                  <Clapperboard className="w-4 h-4 text-fg-muted" />
                </button>

                {/* Reset */}
                <button
                  type="button"
                  onClick={() => void resetRecording()}
                  title="Reiniciar Gravação"
                  className="p-2.5 rounded-full bg-surface border border-line text-fg-muted hover:text-fg-default active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-fg-muted" />
                </button>

                {/* Stop and Save */}
                <button
                  type="button"
                  onClick={stopRecording}
                  title="Parar e Salvar Gravação"
                  className="px-4 py-2.5 rounded-full bg-inverse hover:bg-inverse-hover text-on-inverse font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Parar</span>
                </button>
              </>
            )}
          </div>
        )}

      {showYouTubeModal && (
        <YouTubeUploadModal
          open={showYouTubeModal}
          onClose={() => {
            setShowYouTubeModal(false);
            setYoutubeUploadClip(null);
          }}
          clip={youtubeUploadClip}
        />
      )}
    </>
  );
}
