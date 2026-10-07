# daniloom — Design System

Interface monocromática, dark-first e densa (texto base de 12px), feita com React 19, Tailwind CSS v4, Radix (comportamento sem estilo), cmdk e lucide-react.

Este diretório tem dois públicos:

- **Quem mexe no daniloom:** siga as [regras do projeto](#regras-do-projeto) abaixo.
- **Quem vai usar o design system em outro projeto:** veja [reuse.md](reuse.md).

| Documento | Conteúdo |
|---|---|
| [foundations.md](foundations.md) | Princípios, cores, tipografia, raios, espaçamento, ícones, elevação, movimento, layout, escrita |
| [components.md](components.md) | API de cada componente de `src/components/ui/` e padrões ainda sem componente |
| [reuse.md](reuse.md) | Como levar o design system para outro projeto e o que adaptar |

| Código | Papel |
|---|---|
| `src/styles/tokens.css` | Fonte única dos tokens (cores light/dark, fontes, tamanhos, animações, fundos, markdown) |
| `src/components/ui/` | Componentes do design system. Importe de `'./ui'` ou `'../components/ui'` |
| `src/lib/cn.ts` | `cn()` para juntar classes (clsx + tailwind-merge configurado para os tokens) |
| `src/context/DialogContext.tsx` | `useDialog()`: `alert` / `confirm` / `prompt` com promise |

---

## Regras do projeto

Valem para todo código de UI novo ou alterado no daniloom.

### 1. Componente antes de classe

- Use os componentes de `src/components/ui/` antes de escrever classes à mão: `Button`, `IconButton`, `Modal`, `Menu`, `Input`, `Badge`, etc. Veja [components.md](components.md).
- Se um padrão visual aparece **duas vezes ou mais** e não tem componente, crie o componente em `src/components/ui/`, exporte em `index.ts` e documente em `components.md`.
- Para pedir confirmação ou texto ao usuário, use `useDialog()`. Nunca `window.confirm` ou `window.prompt`. O `window.alert` já é redirecionado para o dialog do app.

### 2. Overlays só pelos componentes

- Modal, dialog e palette: `Modal` (Radix Dialog). Dropdown: `Menu` (Radix DropdownMenu).
- **Não** monte `fixed inset-0` à mão nem registre `window.addEventListener('keydown')` para Esc. O Radix já cuida de Esc, clique fora, foco preso e retorno do foco.
- Todo `Modal` precisa de título acessível: `ModalHeader`, `ModalTitle` ou a prop `srTitle`.
- Esc que precisa fechar um sub-painel antes do modal: use `onEscapeKeyDown` e chame `e.preventDefault()` (exemplo em `WorkspaceSettingsModal.tsx`).

### 3. Cores

- Em código novo, use os **tokens semânticos**: `bg-surface`, `bg-overlay`, `bg-muted`, `border-line`, `border-line-strong`, `text-fg`, `text-fg-default`, `text-fg-secondary`, `text-fg-muted`, `text-fg-subtle`, `bg-inverse` / `text-on-inverse`. Cada um já troca entre light e dark, então dispensa o par `x dark:y`.
- Zinc direto (`text-zinc-500`) só quando nenhum token serve.
- **Proibido** hex arbitrário em classe (`bg-[#131417]`). Se faltar uma cor, crie o token em `tokens.css`.
- Cor escolhida pelo usuário (status, label) entra por `style={{ backgroundColor }}`, nunca por classe montada em runtime.
- Cor tem significado. Verde = criar/concluído, vermelho = perigo, âmbar = templates/fixado, índigo = seleção, rose = ao vivo. Não use cor para decorar.

### 4. Tipografia e tamanhos

- Texto padrão de UI: `text-xs` (12px). Use `text-meta` (11px), `text-2xs` (10px) e `text-3xs` (9px) em vez de `text-[11px]`, `text-[10px]` e `text-[9px]`.
- Números, datas, contadores, atalhos e códigos usam `font-mono`.
- Ícones lucide: `w-3.5 h-3.5` em botões e menus, `w-4 h-4` em navegação e modais.

### 5. Classes

- Junte classes condicionais com `cn()`, que resolve conflitos. Não concatene template strings com ternários longos.
- Componentes aceitam `className` para ajustes pontuais. Se o ajuste se repete, vira `variant` ou `size`.
- Animações: só `animate-fade-in`, `animate-pop-in` e `animate-slide-down`. Os nomes `animate-in`, `fade-in`, `zoom-in-*` e `slide-in-*` não existem neste projeto.

### 6. Comportamento e acessibilidade

- Botão só de ícone tem `title` (com o atalho, se houver: `"Buscar / Comandos (⌘K)"`).
- Ações secundárias de card aparecem no hover (`opacity-0 group-hover:opacity-100`).
- Teclado: `⌘K` busca, `Esc` fecha, `Enter` confirma, `↑↓` navega.
- Textos em pt-BR, curtos, sem ponto final em rótulos. Confirmação destrutiva cita o nome do item.

### 7. Antes de entregar

- Confira a tela **nos dois temas** (Configurações → Tema & Fundo).
- `npm run lint` (typecheck) e `npm run build` passam.

---

## Status da migração

| Situação | Arquivos |
|---|---|
| ✅ Usando o design system | `tokens.css`, `src/components/ui/`, `DialogContext`, `Layout`, `ToastContainer`, `PWAInstallButton`, `OfflineIndicator`, `WatermarkPanel`, `CropRegionSelector`, `Timeline`, `App` (modais e dialogs) |
| ⏳ Tokens aplicados, padrões pontuais à refinar | `CustomPlayer`, `TrimSection`, `MicVolumeSlider`, `CameraBubble`, `CameraGridOverlay` |
