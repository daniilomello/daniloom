import { useState } from "react";
import {
  Upload,
  Camera,
  Sparkles,
  Image as ImageIcon,
  Check,
} from "lucide-react";
import { Switch, Button, Input, Slider } from "./ui";

export interface WatermarkConfig {
  enabled: boolean;
  image: string; // Data URL or URL
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  opacity: number; // 0.1 to 1.0
  scale: number; // 0.05 to 0.35 (percent of canvas width)
}

interface WatermarkPanelProps {
  config: WatermarkConfig;
  onChange: (newConfig: WatermarkConfig) => void;
  cameraStream?: MediaStream | null;
  showToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

export const WatermarkPanel = ({
  config,
  onChange,
  cameraStream,
  showToast,
}: WatermarkPanelProps) => {
  const [aiPrompt, setAiPrompt] = useState(
    "Selo minimalista em alta definição escrito 'DANILOOM CREATOR' com borda circular e brilho sutil",
  );
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        onChange({
          ...config,
          enabled: true,
          image: evt.target.result as string,
        });
        showToast?.("Marca d'água carregada com sucesso!", "success");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureCamera = () => {
    if (!cameraStream) {
      showToast?.(
        "Ative a câmera para capturar uma foto para a marca d'água.",
        "info",
      );
      return;
    }

    try {
      const videoTrack = cameraStream.getVideoTracks()[0];
      if (!videoTrack) return;

      const video = document.createElement("video");
      video.srcObject = cameraStream;
      video.play();

      video.onloadedmetadata = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Circular clip camera snapshot
          ctx.beginPath();
          ctx.arc(150, 150, 140, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(video, 0, 0, 300, 300);

          // Border
          ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
          ctx.lineWidth = 6;
          ctx.stroke();

          const dataUrl = canvas.toDataURL("image/png");
          onChange({
            ...config,
            enabled: true,
            image: dataUrl,
          });
          showToast?.("Foto da câmera capturada para marca d'água!", "success");
        }
        video.srcObject = null;
      };
    } catch (err) {
      console.error("Camera snapshot error:", err);
      showToast?.("Erro ao capturar foto da câmera.", "error");
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return;

    setIsGeneratingAI(true);
    try {
      // Call server endpoint or fallback to client canvas badge generator
      const res = await fetch("/api/generate-watermark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.image) {
          onChange({
            ...config,
            enabled: true,
            image: data.image,
          });
          showToast?.("Marca d'água gerada com IA!", "success");
          setIsGeneratingAI(false);
          return;
        }
      }

      // Fallback AI Canvas Badge Generator
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 160;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Gradient badge
        const grad = ctx.createLinearGradient(0, 0, 400, 160);
        grad.addColorStop(0, "#4f46e5");
        grad.addColorStop(1, "#9333ea");
        ctx.fillStyle = grad;

        ctx.beginPath();
        if (typeof (ctx as any).roundRect === "function") {
          (ctx as any).roundRect(10, 10, 380, 140, 24);
        } else {
          ctx.rect(10, 10, 380, 140);
        }
        ctx.fill();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px Plus Jakarta Sans, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(aiPrompt.substring(0, 24).toUpperCase(), 200, 80);

        const dataUrl = canvas.toDataURL("image/png");
        onChange({
          ...config,
          enabled: true,
          image: dataUrl,
        });
        showToast?.("Marca d'água personalizada criada!", "success");
      }
    } catch (err) {
      console.error("AI Watermark error:", err);
      showToast?.("Erro ao gerar marca d'água.", "error");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 text-fg-default">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-fg-muted" />
          <h3 className="text-sm font-semibold text-fg">
            Marca d'Água Personalizada
          </h3>
        </div>

        <Switch
          title="Ativar marca d'água"
          checked={config.enabled}
          onChange={(enabled) => onChange({ ...config, enabled })}
        />
      </div>

      {config.enabled && (
        <>
          {/* Action Cards */}
          <div className="grid grid-cols-3 gap-2">
            {/* Upload */}
            <label className="flex flex-col items-center justify-center p-3 bg-app border border-line hover:border-line rounded-xl cursor-pointer transition-all hover:scale-[1.02]">
              <Upload className="w-5 h-5 text-fg-muted mb-1" />
              <span className="text-meta font-medium text-fg-secondary">
                Upload Imagem
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Camera */}
            <button
              onClick={handleCaptureCamera}
              className="flex flex-col items-center justify-center p-3 bg-app border border-line hover:border-line rounded-xl cursor-pointer transition-all hover:scale-[1.02]"
            >
              <Camera className="w-5 h-5 text-fg-muted mb-1" />
              <span className="text-meta font-medium text-fg-secondary">
                Foto Câmera
              </span>
            </button>

            {/* AI Generator */}
            <button
              onClick={handleGenerateAI}
              disabled={isGeneratingAI}
              className="flex flex-col items-center justify-center p-3 bg-app border border-line hover:border-line rounded-xl cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5 text-fg-muted mb-1 animate-pulse" />
              <span className="text-meta font-medium text-fg-secondary">
                {isGeneratingAI ? "Gerando..." : "Gerar com IA"}
              </span>
            </button>
          </div>

          {/* AI Prompt Input */}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Descreva a marca d'água para IA..."
              className="flex-1"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerateAI}
              disabled={isGeneratingAI}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gerar</span>
            </Button>
          </div>

          {/* Preview & Position Controls */}
          {config.image && (
            <div className="flex flex-col gap-3 pt-2 border-t border-line">
              <div className="flex items-center justify-between text-xs text-fg-muted">
                <span>Posição na Tela</span>
                <span className="text-fg-muted font-mono capitalize">
                  {config.position.replace("-", " ")}
                </span>
              </div>

              {/* 4-Corner Position Picker */}
              <div className="grid grid-cols-2 gap-2 p-2 bg-app border border-line rounded-xl relative h-28">
                {(
                  [
                    "top-left",
                    "top-right",
                    "bottom-left",
                    "bottom-right",
                  ] as const
                ).map((pos) => {
                  const isSelected = config.position === pos;
                  return (
                    <button
                      key={pos}
                      onClick={() => onChange({ ...config, position: pos })}
                      className={`relative flex items-center justify-center p-2 rounded-lg border transition-all ${
                        isSelected
                          ? "bg-muted border-line-strong text-fg-secondary"
                          : "bg-surface/60 border-line text-fg-muted hover:text-fg-secondary"
                      }`}
                    >
                      <span className="text-meta font-mono capitalize">
                        {pos.replace("-", " ")}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 absolute right-2 text-fg-muted" />
                      )}
                    </button>
                  );
                })}

                {/* Simulated Image Watermark Overlay preview */}
                <div
                  className="absolute pointer-events-none transition-all duration-300"
                  style={{
                    top: config.position.startsWith("top") ? "12px" : "auto",
                    bottom: config.position.startsWith("bottom")
                      ? "12px"
                      : "auto",
                    left: config.position.endsWith("left") ? "12px" : "auto",
                    right: config.position.endsWith("right") ? "12px" : "auto",
                    opacity: config.opacity,
                    width: `${config.scale * 100 * 1.5}px`,
                  }}
                >
                  <img
                    src={config.image}
                    alt="Watermark"
                    className="w-full h-auto object-contain rounded"
                  />
                </div>
              </div>

              {/* Sliders: Opacity & Scale */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-meta text-fg-muted">
                    <span>Opacidade</span>
                    <span className="font-mono">
                      {Math.round(config.opacity * 100)}%
                    </span>
                  </div>
                  <Slider
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={config.opacity}
                    onChange={(val) =>
                      onChange({
                        ...config,
                        opacity: val,
                      })
                    }
                    aria-label="Opacidade da marca d'água"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-meta text-fg-muted">
                    <span>Tamanho</span>
                    <span className="font-mono">
                      {Math.round(config.scale * 100)}%
                    </span>
                  </div>
                  <Slider
                    min={0.05}
                    max={0.35}
                    step={0.01}
                    value={config.scale}
                    onChange={(val) =>
                      onChange({ ...config, scale: val })
                    }
                    aria-label="Tamanho da marca d'água"
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
