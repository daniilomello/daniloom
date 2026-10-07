# Fundamentos

Valores e regras visuais do design system. Os tokens citados estão definidos em `src/styles/tokens.css` e viram classes do Tailwind (`bg-surface`, `text-fg-muted`, `border-line`…).

## 1. Princípios

1. **Monocromático primeiro.** A interface é toda em escala de cinza (zinc). Cor aparece só com significado: status, criar, perigo, seleção. Não há cor de marca decorativa.
2. **Dark-first.** O tema escuro é o padrão (`<html class="dark">`) e o mais cuidado. Os cinzas do dark são quase pretos com leve tom frio, não `zinc-900` puro.
3. **Densidade de ferramenta.** O texto base da UI tem **12px**, e metadados ficam entre 10 e 11px. Conteúdo longo (markdown) sobe para 14px.
4. **Mono para dados, sans para pessoas.** Contadores, datas, tempos, atalhos, badges técnicos e a marca usam JetBrains Mono. Títulos e texto corrido usam Plus Jakarta Sans.
5. **Ação primária = cor invertida.** O botão principal é preto no light e quase branco no dark. Nunca colorido, exceto o vermelho das ações destrutivas.
6. **Ações aparecem no hover.** Editar e excluir ficam ocultos até o hover do card.
7. **Teclado em tudo.** `⌘K` busca, `Esc` fecha overlay, `Enter` confirma, `↑↓` navega.
8. **Profundidade por borda, não por sombra.** Cards têm borda de 1px e `shadow-xs`. Sombras fortes só em camadas flutuantes.

## 2. Tema

- O tema é uma classe no `<html>`: `dark` ou `light`. Tudo que depende de tema usa os tokens (ou a variante `dark:`).
- O fundo da página é uma classe no `<body>`: `bg-pattern-dots` (padrão), `bg-pattern-solid`, `bg-pattern-grid` ou `bg-pattern-radial`.
- O danban guarda `{ mode, background }` no `localStorage` e aplica as classes em `App.tsx`.

## 3. Cores

### 3.1 Superfícies (do fundo para a frente)

| Token | Uso | Light | Dark |
|---|---|---|---|
| `app` | Canvas, body | `#ffffff` | `#0c0d0f` |
| `chrome` | Barra superior | `#ffffff` | `#0e0f11` |
| `rail` | Sidebar de ícones | `#ffffff` | `#111215` |
| `surface` | Cards, tiles | `#ffffff` | `#131417` |
| `surface-hover` | Hover de card | `#fafafa` (zinc-50) | `#16171b` |
| `overlay` | Modal, popover, palette | `#ffffff` | `#141518` |
| `overlay-footer` | Rodapé de palette | `#fafafa` | `#101114` |
| `field` | Inputs | `#fafafa` | `#18181b` (zinc-900) |
| `muted` | Trilho de abas, chips, item ativo | `#f4f4f5` (zinc-100) | `#27272a` (zinc-800) |
| `hover` | Hover de linha e ícone | zinc-100 | zinc-800/60 |
| `scrim` | Fundo atrás de modal | black/60 | black/80 |

No dark, cada camada sobe 2–3% de luminosidade: `0c0d0f → 0e0f11 → 111215 → 131417 → 141518 → 16171b`. Se precisar de uma camada nova, mantenha essa progressão e crie o token.

### 3.2 Bordas

| Token | Light | Dark | Uso |
|---|---|---|---|
| `line` | zinc-200 | zinc-800/80 | Borda padrão e divisores |
| `line-strong` | zinc-300 | zinc-700 | Hover, foco, selecionado, borda tracejada |

### 3.3 Texto

| Token | Light | Dark | Uso |
|---|---|---|---|
| `fg` | zinc-950 | white | Títulos de página, item ativo |
| `fg-default` | zinc-900 | zinc-100 | Corpo, títulos de card e de modal |
| `fg-secondary` | zinc-600 | zinc-400 | Labels, descrições, itens de menu |
| `fg-muted` | zinc-500 | zinc-500 | Metadados, ícones de navegação inativos |
| `fg-subtle` | zinc-400 | zinc-600 | Placeholder, ícones decorativos, separadores |

### 3.4 Ação primária

| Token | Light | Dark |
|---|---|---|
| `inverse` | zinc-900 | zinc-200 |
| `inverse-hover` | zinc-800 | white |
| `on-inverse` | white | zinc-900 |

### 3.5 Cores com significado

| Papel | Cor | Token de texto | Onde aparece |
|---|---|---|---|
| Sucesso / criar | emerald-500 `#10b981` | `success-fg` | Ícones de "Novo…", check de seleção, card finalizado, badge "público", foco do prompt |
| Perigo | red-500 `#ef4444` (botão red-600 → 700) | `danger-fg` | Excluir, sair, card inativo, erros |
| Atenção | amber-500 `#f59e0b` | `warning-fg` | Templates (`Sparkles`), card fixado (`Pin`), dialog de aviso |
| Seleção | indigo-500 `#6366f1` | `accent-fg` | Swatch selecionado, contador de filtros, barra de carregamento |
| Ao vivo | rose-500 `#f43f5e` | — | Timer rodando, botão de parar |
| Vencido | `overdue` `#ff6347` | — | Borda e glow de card com prazo vencido |
| Link | `link` `#38bdf8` | — | Links dentro de markdown |

Ícones do command palette têm cor por tipo: dashboard indigo-400, workspace emerald-400, board sky-400, editar purple-400, novo workspace amber-400, sair red-400.

**Ícone com tom** (dialogs): `bg-{cor}-500/10 border-{cor}-500/20 text-{cor}-500`.

**Glow de estado** (card): borda na cor + `shadow-[0_0_12px_rgba(R,G,B,0.18)]`.

### 3.6 Cores de dados (escolhidas pelo usuário)

| Status de card | Padrão |
|---|---|
| Ativo | `#000000` |
| Inativo | `#ef4444` |
| Finalizado | `#10b981` |
| Arquivado | `#71717a` |

- Paleta do seletor (12): `#000000 #ef4444 #ff6347 #10b981 #15803d #3b82f6 #6366f1 #8b5cf6 #f59e0b #ec4899 #06b6d4 #71717a`.
- Labels usam tons 400, legíveis no dark: `#818cf8 #34d399 #38bdf8 #f87171 #f472b6 #fbbf24`.

## 4. Tipografia

Plus Jakarta Sans (400/500/600/700) para a UI, JetBrains Mono (400/500/600) para dados. Variáveis `--font-sans` e `--font-mono`.

| Papel | Classes | Tamanho |
|---|---|---|
| Título de página | `text-xl sm:text-2xl font-bold tracking-tight text-fg` | 20/24px |
| Título de seção | `text-sm sm:text-base font-bold text-fg` | 14/16px |
| Título de modal, card de board | `text-sm font-semibold` | 14px |
| Título de card kanban | `text-xs sm:text-sm font-medium leading-snug` | 12/14px |
| **UI padrão** (botão, input, menu) | `text-xs font-medium` | **12px** |
| Metadado, subtítulo, rodapé | `text-meta` | 11px |
| Badge, kbd, contador | `text-2xs` | 10px |
| Eyebrow (rótulo de grupo) | `text-2xs font-medium uppercase tracking-wider text-fg-subtle` | 10px |
| Tag mínima | `text-3xs font-mono` | 9px |
| Markdown | `.ds-prose` | 14px, entrelinha 24px |

- `font-medium` é o peso de tudo que é clicável; `font-semibold` para títulos de modal e card; `font-bold` só para título de página e marca.
- `tracking-tight` em títulos grandes, `tracking-wider` só em eyebrows, `tracking-tighter` só no logotipo.
- Todo nome dinâmico em botão ou menu leva `truncate` e uma largura máxima.
- Separador de metadados: `•` ou `/` em `text-zinc-300 dark:text-zinc-700`.

## 5. Forma

### Raios

| Classe | Uso |
|---|---|
| `rounded` (4px) | Kbd, avatar compacto, link copiável |
| `rounded-md` (6px) | Gatilhos de breadcrumb |
| `rounded-lg` (8px) | Botões, itens de menu, ícone-botão, inputs de formulário |
| `rounded-xl` (12px) | Cards, busca, popovers, itens da sidebar, option tiles, ícone de dialog |
| `rounded-2xl` (16px) | Modais, colunas do kanban, tiles do dashboard |
| `rounded-full` | Badges, pills, avatar, status dot, swatches, switch, timer |

O filho tem um degrau de raio a menos que o pai: modal `2xl` → card `xl` → botão `lg`; trilho de abas `xl` → aba `lg`.

### Espaçamento

Escala base 4px. Os meio-passos (`1.5`, `2.5`, `3.5`) dão a densidade característica.

| Contexto | Valor |
|---|---|
| Página | `px-7 pt-6 pb-10` |
| Card | `p-3.5` (kanban), `p-4` (board, tile) |
| Modal | cabeçalho `px-5 py-4`, corpo `p-5 space-y-4` |
| Menu | painel `p-2`, item `px-2 py-1.5` |
| Botão | `px-4 py-1.5` (padrão), `px-3 py-1.5` (toolbar) |
| Gap ícone + texto | `gap-1.5` botão, `gap-2` menu, `gap-3` card |
| Grid de cards | `gap-3.5` |
| Colunas do kanban | `gap-5 sm:gap-6` |

### Ícones (lucide-react)

| Tamanho | Uso |
|---|---|
| `w-3 h-3` | Metadados, chevron de dropdown |
| `w-3.5 h-3.5` | **Padrão** em botões e menus |
| `w-4 h-4` | Sidebar, ícone de card, palette, fechar modal |
| `w-5 h-5` | Ícone de dialog |

Ícone inativo em `fg-subtle` ou `fg-muted`; no hover do grupo vai para `fg`.

## 6. Elevação

| Nível | Sombra | z-index | Exemplos |
|---|---|---|---|
| Conteúdo | `shadow-xs` | — | Card, tile, aba ativa |
| Chrome | só borda | `z-30` / `z-40` | Barra superior, sidebar |
| Popover | `shadow-xl` / `shadow-2xl` | `z-40`–`z-50` | Menus, filtros |
| Modal | `shadow-2xl` + scrim + `backdrop-blur-xs` | `z-50` | Modais, dialogs, palette, timer |

## 7. Movimento

| Animação | Duração | Uso |
|---|---|---|
| `animate-fade-in` | 100ms | Scrim, menus, páginas |
| `animate-pop-in` | 120ms | Painel de modal |
| `animate-slide-down` | 200ms | Timer flutuante |

- Transições curtas: `duration-75` em menus, `100` em cards, `150` em palette e grids.
- Micro-interações: logo `hover:scale-105`, swatch `hover:scale-110` (selecionado `scale-125`), botão grande `active:scale-[0.99]`, card arrastado `opacity-30 scale-95`.
- Indicadores vivos: `animate-ping` (timer), `animate-pulse` (barra de carregamento de 2px com gradiente indigo).

## 8. Layout

```
┌──┬───────────────────────────────────────────────┐
│d │  Título da página  [12 boards]   [busca] [+]  │  cabeçalho com border-b
│──│  ───────────────────────────────────────────  │
│⌂ │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌ ─ ─ ┐          │  grid de 1 a 5 colunas
│▥ │  │card│ │card│ │card│ │card│   + Novo         │
│▤ │  └────┘ └────┘ └────┘ └────┘ └ ─ ─ ┘          │
│▦ │                                               │
│⌕ │                                               │
│(A)│                                              │
└──┴───────────────────────────────────────────────┘
 rail w-14
```

- **Rail lateral** de 56px (`w-14`), só ícones (`IconButton variant="rail"`), marca no topo, divisor `w-6 h-px`, avatar com menu no rodapé.
- **Página:** `px-7 pt-6 pb-10`. Cabeçalho com título + `Badge variant="count"` à esquerda, filtros + `Button size="toolbar"` à direita, separado por `border-b`.
- **Kanban:** rolagem horizontal, colunas `w-72 sm:w-[300px]`, cards com `space-y-2.5`.
- **Dashboard:** `max-w-7xl mx-auto`, seções com `space-y-9`.
- **Grids:** `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5`.
- Breakpoint extra `xs` (30rem) além dos padrões do Tailwind.

## 9. Escrita

- pt-BR, frases curtas, sem ponto final em rótulos.
- Botões: "Novo Board", "Salvar", "Concluir", "Confirmar", "Cancelar", "Excluir", "Sair".
- Confirmação destrutiva cita o item: título "Excluir Board", mensagem `Tem certeza que deseja excluir o board "X"?`.
- Estado vazio em uma frase: `Nenhum board encontrado para "{busca}".`
- Carregando: verbo no gerúndio ("Salvando...", "Criando...", "Conectando...").
- Tooltip (`title`) em todo botão só de ícone, com o atalho quando houver.
