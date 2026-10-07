# Componentes

Todos ficam em `src/components/ui/` e são exportados por `src/components/ui/index.ts`:

```tsx
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from './ui';
```

Todos aceitam `className`, que é juntado com `cn()`: a sua classe vence a padrão quando as duas conflitam. Use isso para ajustes pontuais. Se o mesmo ajuste se repetir, crie uma `variant`.

---

## Button

```tsx
<Button onClick={save}>Salvar</Button>
<Button variant="ghost" onClick={onClose}>Cancelar</Button>
<Button size="toolbar" onClick={onNew}><Plus className="w-3.5 h-3.5" /><span>Novo Board</span></Button>
<Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
```

| `variant` | Visual | Quando usar |
|---|---|---|
| `primary` (padrão) | Invertido: preto no light, quase branco no dark | Ação principal. No máximo uma por região |
| `ghost` | Texto secundário, fundo só no hover | Cancelar, ações secundárias de modal |
| `secondary` | Fundo de campo + borda | Gatilhos de busca e filtro |
| `subtle` | Fundo `muted` | Ações auxiliares dentro de formulário ("Adicionar", copiar link) |
| `destructive` | Vermelho sólido | Confirmar exclusão |
| `link` | Só texto, `fg-muted` | Cancelar discreto |
| `danger` | Só texto vermelho | "Excluir" no rodapé de configurações |

| `size` | Padding | Quando usar |
|---|---|---|
| `md` (padrão) | `px-4 py-1.5` | Rodapé de modal |
| `sm` | `px-2.5 py-1` | Botões dentro de formulário |
| `lg` | `px-4 py-2 rounded-xl` | Submit de modal de configurações |
| `toolbar` | `px-3 py-1.5 rounded-xl font-semibold shadow-xs` | Ação principal no cabeçalho da página |
| `bare` | sem padding | Botão de texto (`link`, `danger`) |

- `type` é `"button"` por padrão. Passe `type="submit"` dentro de formulários.
- `disabled` aplica `opacity-40` e cursor de bloqueado.
- Ícone sempre à esquerda do texto, em `w-3.5 h-3.5`.

## IconButton

```tsx
<IconButton title="Editar board" onClick={edit}><SlidersHorizontal className="w-3.5 h-3.5" /></IconButton>
<IconButton danger title="Excluir board" onClick={remove}><Trash2 className="w-3.5 h-3.5" /></IconButton>
<IconButton variant="rail" active={view === 'cards'} title="Todos os Cards"><Layers className="w-4 h-4" /></IconButton>
```

| Prop | Efeito |
|---|---|
| `variant="default"` | `p-1.5 rounded-lg`, cinza claro, fundo no hover |
| `variant="rail"` | `w-9 h-9 rounded-xl`, item da sidebar |
| `active` | Item selecionado: fundo `muted`, texto `fg`, `shadow-xs` |
| `danger` | Hover vermelho (excluir) |

`title` é obrigatório, porque é o único rótulo do botão.

## Modal

Casca de modal sobre Radix Dialog. Cuida de scrim, foco preso, Esc, clique fora, retorno do foco e animação de entrada.

```tsx
<Modal open={isOpen} onClose={onClose} size="md">
  <ModalHeader title="Configurações do Board" />
  <ModalBody>
    <form onSubmit={save} className="space-y-4">
      …
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Salvar</Button>
      </ModalFooter>
    </form>
  </ModalBody>
</Modal>
```

| Prop de `Modal` | Descrição |
|---|---|
| `open`, `onClose` | Controle. `onClose` é chamado por Esc, clique fora e botão ✕ |
| `size` | `sm` 384px (dialog) · `md` 448px (formulário, padrão) · `lg` 512px · `xl` 576px (palette) · `editor` 580px |
| `align` | `center` (padrão) ou `top` (ancorado a 80px do topo, para palette) |
| `srTitle` | Título só para leitor de tela, quando não há `ModalHeader`/`ModalTitle` |
| `onEscapeKeyDown` | Chame `e.preventDefault()` para o Esc fechar um sub-painel em vez do modal |
| `onKeyDown` | Atalhos dentro do modal (ex.: Enter confirma) |
| `className` | Ajustes no painel (ex.: `p-5 space-y-4` para modal sem cabeçalho separado) |

| Parte | Descrição |
|---|---|
| `ModalHeader` | `title`, `icon` opcional, `bordered` (padrão `true`). Inclui o botão ✕ |
| `ModalTitle` | Título sozinho (`text-sm font-semibold`), para cabeçalhos personalizados |
| `ModalClose` | Botão ✕ sozinho |
| `ModalBody` | `p-5 space-y-4`, com rolagem própria |
| `ModalFooter` | `border-t`, ações à direita. Use `className="justify-between"` para ter uma ação à esquerda (excluir) |

O foco inicial vai para o primeiro campo com `autoFocus`. Se nenhum tiver, vai para o painel, sem anel de foco no ✕. O painel tem `max-h-[85vh]`.

## Dialogs: `useDialog()`

```tsx
const { confirm, prompt, alert } = useDialog();

if (await confirm(`Tem certeza que deseja excluir o board "${b.name}"?`, {
  title: 'Excluir Board', confirmText: 'Excluir', destructive: true,
})) { … }

const title = await prompt('Digite o título para o novo card:', {
  title: 'Novo Card', placeholder: 'Ex: Tarefa importante...', confirmText: 'Criar Card',
}); // string | null

await alert('Board salvo.', { type: 'success' }); // info · warning · error · success
```

- `Enter` confirma e `Esc` ou clique fora cancela. O `confirm` devolve `true` ou `false`; o `prompt` devolve o texto ou `null`.
- Abre por cima de outro `Modal` (ex.: excluir dentro de configurações).
- `window.alert` é redirecionado para `alert()`.

## Menu

Dropdown sobre Radix DropdownMenu, com setas, Enter, Esc, clique fora e posicionamento automático.

```tsx
<Menu>
  <MenuTrigger asChild>
    <button title={email}>…avatar…</button>
  </MenuTrigger>
  <MenuContent side="right" align="end">
    <MenuLabel>{email}</MenuLabel>
    <MenuSeparator />
    <MenuItem icon={<Settings />} onSelect={openSettings}>Configurações</MenuItem>
    <MenuItem danger icon={<LogOut />} onSelect={signOut}>Sair</MenuItem>
  </MenuContent>
</Menu>
```

| Parte | Descrição |
|---|---|
| `MenuTrigger` | Use `asChild` e passe o botão |
| `MenuContent` | `w-48`, `p-2`, `shadow-2xl`. Aceita `side`, `align` e `sideOffset` do Radix |
| `MenuItem` | `icon` (dimensionado para 14px automaticamente), `danger`, `onSelect` |
| `MenuLabel` | Texto não clicável (e-mail, título de grupo) |
| `MenuSeparator` | Divisor |

Ordem dos itens: navegação e ações comuns primeiro; criação depois de um divisor (ícone emerald ou amber); destrutivas (vermelho) por último.

## Campos

```tsx
<Label>Nome do Board</Label>
<Input value={name} onChange={…} required />
<Textarea rows={2} placeholder="Notas..." />
<Select value={col} onChange={…}>{…}</Select>
<SearchInput placeholder="Buscar boards..." value={q} onChange={…} className="w-36 sm:w-48" />
<Switch checked={isPublic} onChange={setIsPublic} title="Tornar público" />
```

| Componente | Visual |
|---|---|
| `Label` | `text-xs font-medium text-fg-secondary`, `mb-1.5` |
| `Input`, `Select` | `text-xs`, `px-3 py-2`, `rounded-lg`, borda zinc-300 / zinc-800, foco `zinc-500` |
| `Textarea` | Igual ao `Input`, em fonte mono |
| `SearchInput` | Busca de toolbar: fundo `muted`, `rounded-xl`, ícone de lupa à esquerda. `wrapperClassName` estiliza o contêiner |
| `Switch` | Liga/desliga emerald, `role="switch"` |

O campo do `prompt` usa anel de foco emerald (`focus:ring-1 focus:ring-emerald-500`). Repita isso em campos de entrada principal de um fluxo.

## Badge, StatusDot, Kbd

```tsx
<Badge variant="count">{n} boards</Badge>
<Badge variant="success">público</Badge>
<Badge variant="label"><StatusDot color={label.color} />{label.name}</Badge>
<Kbd>ESC</Kbd>
```

| `Badge variant` | Uso |
|---|---|
| `count` | Contador mono ao lado do título da página |
| `label` (padrão) | Pill neutra de tag, com `StatusDot` |
| `success` | Status positivo mono ("público") |

`StatusDot` é um ponto de 6px; a cor entra pela prop `color`. `Kbd` é a tecla de atalho em mono 10px.

## SegmentedControl e OptionTiles

```tsx
<SegmentedControl
  value={tab}
  onChange={setTab}
  options={[
    { value: 'theme', label: 'Tema & Fundo', icon: <Moon /> },
    { value: 'statusColors', label: 'Cores dos Status', icon: <Palette /> },
  ]}
/>

<OptionTiles
  value={theme.mode}
  onChange={(mode) => onUpdateTheme({ mode })}
  options={[
    { value: 'dark', label: 'Escuro', icon: <Moon /> },
    { value: 'light', label: 'Claro', icon: <Sun /> },
  ]}
/>
```

- `SegmentedControl`: abas em trilho `muted`; a ativa fica em superfície com `shadow-xs`.
- `OptionTiles`: grade de 2 colunas; a opção selecionada fica invertida, com check emerald.
- Os dois são genéricos no tipo do `value` e redimensionam os ícones sozinhos.

## Slider

Controle deslizante padronizado com trilha arredondada (`rounded-full`), preenchimento ativo translúcido e botão circular (`thumb`) na cor primária da aplicação.

```tsx
<Slider
  value={brightness}
  onChange={setBrightness}
  min={50}
  max={150}
  step={1}
  aria-label="Brilho da câmera"
/>
```

- Trilha: altura `6px`, formato de pílula contínuo, fundo `muted` com preenchimento ativo na cor do tema (`primary/45`).
- Knob (thumb): círculo de `14px` na cor `primary`, perfeitamente alinhado e centralizado no eixo da trilha sem vazar pelas extremidades.
- Acessibilidade: mantém elemento `<input type="range">` nativo subjacente com suporte completo a teclado (`←` / `→` / `Home` / `End`), toque móvel e leitores de tela.
- Suporta orientação horizontal (padrão) e vertical (`orientation="vertical"`).

## CommandPalette

`src/components/CommandPalette.tsx`, feito com **cmdk** dentro de `Modal align="top" size="xl"`.

- A filtragem é própria (`shouldFilter={false}`): busca por substring em título, subtítulo e palavras-chave, na ordem ações → cards → boards → workspaces.
- O cmdk cuida de `↑↓` (com volta ao início), `Enter`, seleção pelo hover do mouse e estado vazio.
- Para acrescentar uma ação, inclua um item no array `actions`, com `id`, `title`, `subtitle`, `keywords`, `icon` (colorido por tipo) e `action`.

---

## Padrões ainda sem componente

Ainda escritos à mão nos arquivos não migrados. Se for usar algum deles em mais de um lugar, transforme em componente.

### Card de kanban (`BoardView`)

- Base: `p-3.5 rounded-xl bg-surface border border-line shadow-xs`; no hover, `bg-surface-hover border-line-strong`.
- Título à esquerda (`flex-1`); ações e status à direita (`shrink-0`).
- Tags como `Badge variant="label"`; rodapé de metadados em `text-meta font-mono`, com ícones de 12px (descrição, anexos, data, recorrência, checklist `3/5`).
- Estados: inativo (borda e título vermelhos + glow), finalizado (emerald + glow), vencido (`overdue` + glow), arrastando (`opacity-30 scale-95`). Indicador de drop: `h-0.5 rounded-full bg-zinc-400`.

### Card de entidade (`BoardsView`, `WorkspacesView`)

Ícone em quadrado `w-8 h-8 rounded-lg bg-muted border`, nome `text-sm font-semibold`, metadados mono (`workspace • 12 cards • 3 col`). Ações aparecem no hover. A grade termina com um slot tracejado: `border border-dashed border-line-strong rounded-xl` com "+ Novo …".

### Tile de dashboard

`p-4 rounded-2xl bg-surface border border-line shadow-xs`, com eyebrow `text-xs font-semibold uppercase tracking-wider text-fg-muted`.

### Timer flutuante (`FloatingTimer`)

Pílula `fixed top-4 right-4 z-50 rounded-full`, sempre escura nos dois temas, com `backdrop-blur-md` e `animate-slide-down`. Ponto rose com `animate-ping`, tempo em mono bold, título truncado depois de um `border-l`, botão de parar redondo.

### Estados vazios e carregamento

- Vazio: `py-8` ou `py-12`, centralizado, `text-xs text-fg-muted`, uma frase.
- Carregando: `Loader2 animate-spin` no lugar do ícone do botão + texto no gerúndio; barra de 2px com `animate-pulse` no topo da área.

### Tela de login (`AuthGate`)

Card centralizado `max-w-[340px] p-7 rounded-2xl`; marca grande, título mono, um único botão grande (`h-10 rounded-xl`). Sem textos explicativos.

### Marca

Quadrado invertido com "d" em mono bold: `w-4` (inline), `w-8 rounded-xl` (rail), `w-10 rounded-xl` (login).
