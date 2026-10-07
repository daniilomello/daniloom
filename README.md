<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0a4c757b-388d-4f25-b930-3c21aed2b723

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Daniloom Desktop (macOS)

Execute `npm run desktop:dev` para abrir a versão desktop com a mesma interface, captura de tela do sistema, cópia incremental em disco e envio ao Drive dos projetos existentes. `npm run desktop:build` gera o instalador em `release/`.

Consulte [docs/desktop.md](docs/desktop.md) para instalação, login pelo navegador, banco compartilhado, atalhos e publicação da biblioteca no AI Studio.

## Instaladores

Baixe os instaladores na área [Releases](https://github.com/daniilomello/daniloom/releases) do repositório privado: macOS Apple Silicon (`.dmg`) e Windows x64 (`.exe`). É necessário acesso ao repositório. Os instaladores não possuem assinatura comercial nem notarização.

As tags `v*` geram os instaladores pelo GitHub Actions e os anexam à release correspondente, que deve ser criada antes do envio da tag. Para gerar localmente no Windows: `npm run desktop:build:win`.
