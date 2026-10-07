import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

app.post("/api/generate-watermark", async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Gere uma descrição de SVG/imagem transparente para marca d'água com a seguinte ideia: ${prompt}`,
    });
    res.json({ result: response.text });
  } catch (error) {
    next(error);
  }
});

// Exclusivo para o usuário oi@daniilo.dev: Geração de título e descrição para publicação no YouTube
app.post("/api/gemini/generate-youtube-metadata", async (req, res, next) => {
  try {
    const { userEmail, clipName, duration, format, context } = req.body;

    // Validação estrita do usuário autorizado
    if (!userEmail || userEmail.trim().toLowerCase() !== "oi@daniilo.dev") {
      return res.status(403).json({
        error: "Acesso negado: A geração automática de título e descrição via Gemini para o YouTube é uma funcionalidade exclusiva do usuário oi@daniilo.dev.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    const durationText = duration
      ? `${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`
      : "duração não informada";
    const formatText =
      format === "portrait"
        ? "Vertical (Shorts / Reels)"
        : "Horizontal (Vídeo padrão)";

    const promptText = `Você é um especialista em marketing de conteúdo e otimização de vídeos para o YouTube.
Gere um título impactante e uma descrição completa e envolvente para publicar este vídeo no YouTube.

Informações do vídeo:
- Nome/Ideia inicial: ${clipName || "Vídeo gravado no DaniLoom"}
- Duração: ${durationText}
- Formato: ${formatText}
${context ? `- Instruções/Contexto adicional do criador: ${context}` : ""}

Regras:
1. Título: Criativo, cativante, altamente atrativo para cliques (sem clickbait enganoso) e otimizado para busca. Máximo 100 caracteres.
2. Descrição: Estrutura profissional em Português com introdução envolvente, pontos de destaque, chamada para ação (curtir, comentar e se inscrever) e de 3 a 5 hashtags relevantes no final.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Título atrativo para o YouTube com no máximo 100 caracteres",
            },
            description: {
              type: Type.STRING,
              description: "Descrição completa do vídeo para o YouTube em Português com hashtags",
            },
          },
          required: ["title", "description"],
        },
      },
    });

    if (!response.text) {
      throw new Error("O Gemini não retornou nenhum conteúdo gerado.");
    }

    const data = JSON.parse(response.text);
    res.json({
      title: data.title,
      description: data.description,
    });
  } catch (error: any) {
    console.error("Erro na rota /api/gemini/generate-youtube-metadata:", error);
    next(error);
  }
});


// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Express global error caught:", err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
    details: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });
});

// Setup Vite Dev Server / Static Assets serving
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const isHmrDisabled = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
