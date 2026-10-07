# Padrões e Arquitetura do Projeto 🏛️

Este arquivo documenta as diretrizes arquiteturais, a organização de pastas por domínios, as convenções e as práticas de codificação adotadas neste projeto. Todos os desenvolvedores e assistentes de IA (como o Gemini) devem seguir rigidamente estes padrões para garantir consistência e escalabilidade.

---

## 📂 Organização das Pastas (Arquitetura por Domínios)

Para garantir escalabilidade e facilitar a manutenção, o projeto é estruturado em **Features/Domínios** ao invés de centralizar componentes em pastas genéricas gigantescas.

<details>
<summary><b>🗺️ Ver Mapa da Estrutura de Pastas (Clique para expandir)</b></summary>

```text
/
├── docs/                      # Documentações específicas do projeto
│   └── SOLID.md               # Diretrizes detalhadas dos princípios SOLID no React
├── src/
│   ├── components/            # Componentes reutilizáveis compartilhados (Globais)
│   │   ├── Layout.tsx         # Componente de layout base para páginas
│   │   └── Logo.tsx           # Logo do aplicativo
│   ├── features/              # Domínios de negócio da aplicação (Feature folders)
│   │   ├── admin/             # Módulo de administração de projetos
│   │   │   └── components/
│   │   │       └── ProjectsAdmin.tsx
│   │   ├── editing/           # Edição de timeline, cortes e legendas
│   │   │   └── components/
│   │   │       ├── Timeline.tsx
│   │   │       └── SubtitlesPanel.tsx
│   │   ├── recording/         # Gravação de webcam e tela
│   │   │   └── components/
│   │   │       └── CameraBubble.tsx
│   │   └── sharing/           # Visualização de links compartilhados públicos
│   │       └── components/
│   │           └── ShareView.tsx
│   ├── hooks/                 # Hooks globais compartilhados
│   ├── utils/                 # Utilitários globais compartilhados (Drive, FFmpeg, etc.)
│   ├── firebase.ts            # Inicialização e utilitários de autenticação/banco
│   ├── main.tsx               # Ponto de entrada com configuração de rotas
│   └── App.tsx                # Interface e controle principal do gravador/editor
```

</details>

---

## 🎨 Componente de Layout Reutilizável (`Layout.tsx`)

<details>
<summary><b>📦 Detalhes do Componente de Layout (Clique para expandir)</b></summary>

Criamos um componente de layout unificado em `src/components/Layout.tsx` para garantir que todas as telas possuam a mesma identidade visual, cabeçalho e estrutura de containers de forma desacoplada.

**Atributos e Funcionalidades:**
- **Segrega Responsabilidades:** O cabeçalho, logotipo e menu do usuário são gerenciados de forma abstrata. O estado de login e handlers de autenticação são repassados via propriedades (Props).
- **Slots Personalizáveis:** Permite a injeção de ações específicas nas laterais do cabeçalho através das propriedades `rightHeaderActions` e `leftHeaderActions`.
- **Estilo Unificado:** Centraliza as margens responsivas padrão (`max-w-7xl mx-auto px-6 py-8`) e o tema escuro elegante (`slate-950`).

</details>

---

## 🏗️ Padrões de Projeto & Princípios SOLID

<details>
<summary><b>📖 Como aplicamos SOLID no código? (Clique para expandir)</b></summary>

A arquitetura do projeto segue estritamente os princípios SOLID adaptados para o ecossistema React.

Para ver as implementações detalhadas com exemplos interativos de código antes/depois, consulte:
👉 **[Documentação de Princípios SOLID no React (docs/SOLID.md)](./docs/SOLID.md)**

### Princípios Resumidos:
- **SRP (Responsabilidade Única)**: Separamos o gerenciamento de estado complexo e requisições assíncronas em Hooks Customizados, mantendo componentes limpos focado apenas em renderização visual.
- **OCP (Aberto/Fechado)**: Nossos layouts de página e botões aceitam elementos injetados (como `children` e Slots) em vez de fixar elementos estáticos no código interno.
- **LSP (Substituição de Liskov)**: Todos os componentes de input e botão estendem as propriedades originais do HTML nativo para permitir substituição direta sem quebra de comportamento.
- **ISP (Segregação de Interfaces)**: Subcomponentes menores declaram interfaces enxutas de propriedades em vez de receberem o objeto completo vindo do banco.
- **DIP (Inversão de Dependência)**: O código de UI não invoca utilitários ou APIs de terceiros diretamente; em vez disso, recebe métodos manipuladores através de propriedades ou de contextos injetáveis.

</details>

---

## ⚡ Práticas de Codificação Recomendadas

<details>
<summary><b>🛠️ Regras de Desenvolvimento (Clique para expandir)</b></summary>

1. **Icons**: Importe todos os ícones da biblioteca `lucide-react`. Nunca crie SVGs manuais se houver um correspondente na biblioteca.
2. **Estilização**: Utilize exclusivamente as classes utilitárias do **Tailwind CSS**. Evite criar arquivos CSS adicionais ou usar estilos inline.
3. **Gerenciamento de Tipos**: Declare os tipos compartilhados e interfaces centrais dentro do arquivo `src/types.ts`.
4. **Clean Code**: Mantenha as funções curtas, nomeie variáveis em inglês de forma autoexplicativa e comente apenas lógicas de negócios complexas.

</details>
