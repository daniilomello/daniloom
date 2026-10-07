# Reutilizar em outro projeto

O design system está em quatro arquivos/pastas autocontidos. Nenhum depende do domínio do danban (boards, cards, Firebase).

## 1. Pré-requisitos

- React 18+ (o danban usa 19)
- **Tailwind CSS v4.** Os tokens usam `@theme`, `@theme inline` e `@custom-variant`, que não existem no v3.
- TypeScript (opcional, mas os componentes são `.tsx`)

## 2. Instalar

```bash
npm i tailwindcss @tailwindcss/vite clsx tailwind-merge lucide-react \
      @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm i cmdk   # só se for ter command palette
```

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
export default { plugins: [react(), tailwindcss()] };
```

## 3. Copiar

| Do danban | Para o projeto novo | Observação |
|---|---|---|
| `src/styles/tokens.css` | `src/styles/tokens.css` | Obrigatório |
| `src/lib/cn.ts` | `src/lib/cn.ts` | Obrigatório. Os componentes importam de `../../lib/cn` |
| `src/components/ui/` (pasta inteira) | `src/components/ui/` | Obrigatório |
| `src/context/DialogContext.tsx` | `src/context/DialogContext.tsx` | Opcional: `alert`/`confirm`/`prompt` com promise. Ajuste o import de `../components/ui` |
| `src/components/CommandPalette.tsx` | — | Só como referência. A lista de ações e a busca são do danban |
| `docs/design-system/` | `docs/design-system/` | Ajuste a tabela de status e as regras ao novo projeto |

Se a estrutura de pastas for outra, o único caminho a corrigir é o import de `cn` nos arquivos de `ui/`.

## 4. Ligar

```css
/* src/index.css */
@import "tailwindcss";
@import "./styles/tokens.css";
```

```html
<!-- index.html -->
<html lang="pt-BR" class="dark">
  <head>
    <meta name="theme-color" content="#0e0f11" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body class="antialiased min-h-screen bg-pattern-dots">
```

```tsx
// main.tsx (se copiou o DialogContext)
<DialogProvider><App /></DialogProvider>
```

Para trocar de tema, alterne `dark`/`light` no `<html>`. Para trocar o fundo, alterne `bg-pattern-dots | solid | grid | radial` no `<body>`.

## 5. Conferir

Monte uma página de teste com `Button`, um `Modal` com `ModalHeader`/`ModalBody`/`ModalFooter` e um `Menu`, e abra nos dois temas. Se as cores aparecerem e o Esc fechar o modal, está tudo ligado.

Se `text-2xs`/`text-meta` sumirem de algum componente, o `cn.ts` copiado não é a versão configurada: o tailwind-merge padrão trata esses tamanhos como cor e os descarta.

## 6. Adaptar à identidade do novo projeto

Tudo o que é marca fica em `tokens.css`. Os componentes não precisam mudar.

| Quer mudar | Onde |
|---|---|
| Cinzas e camadas de superfície | `--ds-app` … `--ds-hover` em `:root` (light) e `.dark` |
| Cor da ação primária | `--ds-inverse`, `--ds-inverse-hover`, `--ds-on-inverse`. Para um primário colorido, coloque a cor da marca aqui |
| Cores de status | `--ds-success-fg`, `--ds-danger-fg`, `--ds-warning-fg`, `--ds-accent-fg` |
| Fontes | `--font-sans`, `--font-mono` em `@theme` + o `<link>` do Google Fonts |
| Densidade | Os tamanhos estão nos componentes (`text-xs`, `px-4 py-1.5`). Para uma UI menos densa, ajuste `sizes` em `Button.tsx` e o `fieldBase` em `Field.tsx` |
| Fundo da página | Classes `.bg-pattern-*` no fim do `tokens.css` |
| Cores de domínio | `--color-overdue`, `--color-link` em `@theme`. Remova as que não fizerem sentido |

Mantenha:

- os **nomes** dos tokens (`surface`, `line`, `fg-muted`…), porque os componentes dependem deles;
- `zinc-750` e `zinc-850` enquanto algum componente usar esses tons;
- a extensão de `cn.ts` sincronizada com os tamanhos de fonte criados em `@theme` (`--text-*`).

## 7. O que não vem junto

- Não há `Tooltip`, `Popover`, `Toast`, `Tabs` com painéis, `Checkbox`, `Radio` nem `DatePicker`. Se precisar, siga o mesmo padrão: comportamento do Radix (`@radix-ui/react-*`), visual com os tokens, arquivo novo em `ui/` exportado no `index.ts`.
- Os padrões de card, tile, timer e login estão só documentados em [components.md](components.md#padrões-ainda-sem-componente), sem componente pronto.
