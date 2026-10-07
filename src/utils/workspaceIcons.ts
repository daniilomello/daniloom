export interface WorkspaceIconConfig {
  id: string;
  label: string;
  group: "Edição" | "Áudio & Leitura" | "Admin & IA" | "Sistema & Exportação";
  order: number;
  visible: boolean;
  isPrivate?: boolean;
}

export const DEFAULT_WORKSPACE_ICONS: WorkspaceIconConfig[] = [
  // Grupo 1: Edição
  {
    id: "clips",
    label: "Editor de Cenas & Clipes",
    group: "Edição",
    order: 0,
    visible: true,
  },
  {
    id: "trim",
    label: "Ferramenta Trim / Cortar",
    group: "Edição",
    order: 1,
    visible: false,
    isPrivate: true,
  },
  {
    id: "screenshot",
    label: "Capturar Frame (Screenshot)",
    group: "Edição",
    order: 2,
    visible: true,
  },

  // Grupo 2: Áudio & Leitura
  {
    id: "audio_download",
    label: "Baixar Áudio (.wav)",
    group: "Áudio & Leitura",
    order: 3,
    visible: true,
  },
  {
    id: "audio_upload",
    label: "Substituir Áudio (.wav)",
    group: "Áudio & Leitura",
    order: 4,
    visible: true,
  },

  // Grupo 4: Sistema
  {
    id: "sound_effects",
    label: "Sons de Interação",
    group: "Sistema & Exportação",
    order: 5,
    visible: false,
  },
  {
    id: "watermark",
    label: "Marca D'água",
    group: "Sistema & Exportação",
    order: 6,
    visible: false,
  },
  {
    id: "performance_mode",
    label: "Modo Desempenho",
    group: "Sistema & Exportação",
    order: 7,
    visible: false,
  },
];

const ICONS_STORAGE_KEY = "daniloom_workspace_icons_config";
const ICONS_VERSION_KEY = "daniloom_workspace_icons_version";
const CURRENT_ICONS_VERSION = "3.0";

export const getWorkspaceIconsConfig = (): WorkspaceIconConfig[] => {
  try {
    const savedVersion = localStorage.getItem(ICONS_VERSION_KEY);
    if (savedVersion !== CURRENT_ICONS_VERSION) {
      localStorage.removeItem(ICONS_STORAGE_KEY);
      localStorage.setItem(ICONS_VERSION_KEY, CURRENT_ICONS_VERSION);
    } else {
      const saved = localStorage.getItem(ICONS_STORAGE_KEY);
      if (saved) {
        const parsed: WorkspaceIconConfig[] = JSON.parse(saved);
        const merged = DEFAULT_WORKSPACE_ICONS.map((def) => {
          const found = parsed.find((p) => p.id === def.id);
          if (found) {
            return {
              ...def,
              order: found.order ?? def.order,
              visible: found.visible ?? def.visible,
            };
          }
          return def;
        });
        return merged.sort((a, b) => a.order - b.order);
      }
    }
  } catch (e) {
    console.error("Erro ao carregar configurações de ícones do workspace", e);
  }
  return [...DEFAULT_WORKSPACE_ICONS].sort((a, b) => a.order - b.order);
};

export const saveWorkspaceIconsConfig = (config: WorkspaceIconConfig[]) => {
  try {
    localStorage.setItem(ICONS_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event("daniloom_workspace_icons_changed"));
  } catch (e) {
    console.error("Erro ao salvar configurações de ícones do workspace", e);
  }
};

export const resetWorkspaceIconsConfig = () => {
  try {
    localStorage.removeItem(ICONS_STORAGE_KEY);
    window.dispatchEvent(new Event("daniloom_workspace_icons_changed"));
  } catch (e) {
    console.error("Erro ao resetar configurações de ícones do workspace", e);
  }
};
