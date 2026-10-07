export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  category:
    "layout" | "projeto" | "audio" | "exportacao" | "workspace" | "admin";
  isPrivate?: boolean; // Se for true, só administradores visualizam/gerenciam
  defaultEnabled: boolean;
  isBeta: boolean; // true = "Beta", false = "Em desenvolvimento"
}

export const PLATFORM_FEATURES: FeatureFlag[] = [
  // 1. Layout, Filtros e Fundos (Públicas)
  {
    id: "color_filters",
    name: "Filtros de Cor do Vídeo",
    description:
      "Permite aplicar estilos de cor como P&B, Vintage, Warm, Cool e ajuste de contraste.",
    category: "layout",
    defaultEnabled: true,
    isBeta: true,
  },
  {
    id: "stage_backgrounds",
    name: "Planos de Fundo & Grids",
    description:
      "Permite escolher fundos de gradiente, malhas e pontos para a área de trabalho.",
    category: "layout",
    defaultEnabled: true,
    isBeta: true,
  },
  {
    id: "camera_blur",
    name: "Desfoque de Fundo da Câmera",
    description:
      "Aplica efeito de blur sutil no fundo da moldura da câmera em tempo real.",
    category: "layout",
    defaultEnabled: false,
    isBeta: false,
  },
  {
    id: "studio_light",
    name: "Ajuste de Iluminação (Studio Light)",
    description:
      "Simula iluminação de estúdio no rosto com spotlight sutil e realce de calor/brilho.",
    category: "layout",
    defaultEnabled: false,
    isBeta: false,
  },
  {
    id: "crop_region",
    name: "Gravação de Área Específica (Crop / cropTo)",
    description:
      "Permite selecionar e cortar uma sub-região percentual do palco/tela para gravação.",
    category: "layout",
    defaultEnabled: false,
    isBeta: false,
  },
  {
    id: "camera_shapes",
    name: "Formatos & Molduras da Câmera",
    description:
      "Permite alternar a câmera entre Círculo, Quadrado, Tela Dividida e 16:9 / 9:16.",
    category: "layout",
    defaultEnabled: false,
    isBeta: false,
  },
  {
    id: "recording_mode_mobile",
    name: "Modo de Gravação para Celular (Retrato 9:16)",
    description:
      "Habilita a alternância para modo vertical / smartphone na barra de gravação.",
    category: "layout",
    defaultEnabled: true,
    isBeta: true,
  },
  {
    id: "bluetooth_shutter",
    name: "Gatilho Remoto Bluetooth / Pau de Selfie",
    description:
      "Inicia e para a gravação usando controle remoto Bluetooth, botões de volume ou botões de mídia.",
    category: "layout",
    defaultEnabled: true,
    isBeta: true,
  },
  {
    id: "pip_widget",
    name: "Widget Picture-in-Picture (PiP) Flutuante",
    description:
      "Exibe o widget flutuante de controle da gravação com botões de atalho ao iniciar a captura.",
    category: "layout",
    defaultEnabled: false,
    isBeta: false,
  },
  {
    id: "preview_zoom",
    name: "Controle de Zoom da Prévia",
    description:
      "Exibe os controles de aproximar e afastar o palco de gravação no topo da prévia.",
    category: "layout",
    defaultEnabled: false,
    isBeta: false,
  },
  {
    id: "split_screen_control",
    name: "Controle de Tela Dividida (Inverter e Porcentagem / Slider)",
    description:
      "Inverter posição (Tela/Câmera) no modo computador e slider para ajustar proporção da divisão de tela.",
    category: "layout",
    defaultEnabled: true,
    isBeta: true,
  },

  // 2. Projeto & Cenas (Públicas)
  {
    id: "multi_scene",
    name: "Editor de Cenas & Clipes",
    description:
      "Habilita a linha do tempo para organizar, mesclar e deletar múltiplos clipes.",
    category: "projeto",
    defaultEnabled: true,
    isBeta: true,
  },
  {
    id: "trim_cut",
    name: "Ferramenta de Trim / Cortes Finos",
    description:
      "Permite aparar os pontos de início e fim dos clipes gravados com precisão.",
    category: "projeto",
    defaultEnabled: true,
    isBeta: true,
  },
  {
    id: "screenshot",
    name: "Capturar Frame (Screenshot)",
    description:
      "Captura uma foto instantânea do palco de vídeo durante a prévia.",
    category: "projeto",
    defaultEnabled: true,
    isBeta: true,
  },
  {
    id: "audio_replacement",
    name: "Substituição & Download de Áudio (.wav)",
    description:
      "Opção de baixar faixa de áudio isolada e enviar áudio tratado de volta.",
    category: "projeto",
    defaultEnabled: true,
    isBeta: true,
  },

  // 3. Áudio & Efeitos (Públicas)
  {
    id: "noise_cancellation",
    name: "Cancelamento de Ruído do Microfone (DSP)",
    description:
      "Filtro passa-alta e cortes em 60Hz/120Hz para eliminar ruídos de fundo e ar-condicionado.",
    category: "audio",
    defaultEnabled: true,
    isBeta: true,
  },
  {
    id: "sound_effects",
    name: "Efeitos Sonoros de Interação",
    description:
      "Sinais audíveis ao iniciar, pausar, parar gravações e concluir ações.",
    category: "audio",
    defaultEnabled: true,
    isBeta: true,
  },

  // 4. Exportação & Marca D'água (Públicas)
  {
    id: "watermark_overlay",
    name: "Marca D'água Personalizada",
    description:
      "Painel para upload de logo, opacidade e posicionamento na tela.",
    category: "exportacao",
    defaultEnabled: false,
    isBeta: false,
  },

  // 5. Workspace & Organização de Ícones (Públicas)
  {
    id: "performance_mode",
    name: "Modo Desempenho (Sombra de CPU)",
    description:
      "Oculta a prévia da câmera em gravações intensas para economizar processamento.",
    category: "workspace",
    defaultEnabled: false,
    isBeta: false,
  },
  {
    id: "opfs_storage",
    name: "Armazenamento & Stream em Disco (OPFS)",
    description:
      "Utiliza Origin Private File System para stream direto sem carregar dados pesados na RAM.",
    category: "workspace",
    defaultEnabled: true,
    isBeta: true,
  },
];

const STORAGE_KEY = "daniloom_feature_flags";
const FLAGS_VERSION_KEY = "daniloom_feature_flags_version";
const CURRENT_FLAGS_VERSION = "3.0";

export const getFeatureFlagsState = (): Record<string, boolean> => {
  try {
    const savedVersion = localStorage.getItem(FLAGS_VERSION_KEY);
    if (savedVersion !== CURRENT_FLAGS_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(FLAGS_VERSION_KEY, CURRENT_FLAGS_VERSION);
    } else {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const result: Record<string, boolean> = {};
        PLATFORM_FEATURES.forEach((f) => {
          result[f.id] =
            parsed[f.id] !== undefined
              ? Boolean(parsed[f.id])
              : f.defaultEnabled;
        });
        return result;
      }
    }
  } catch (e) {
    console.error("Erro ao carregar feature flags do localStorage", e);
  }

  const initial: Record<string, boolean> = {};
  PLATFORM_FEATURES.forEach((f) => {
    initial[f.id] = f.defaultEnabled;
  });
  return initial;
};

export const saveFeatureFlagsState = (state: Record<string, boolean>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event("daniloom_feature_flags_changed"));
  } catch (e) {
    console.error("Erro ao salvar feature flags no localStorage", e);
  }
};

export const isFeatureEnabled = (featureId: string): boolean => {
  const flags = getFeatureFlagsState();
  return Boolean(flags[featureId]);
};
