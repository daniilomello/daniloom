import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import { Loader2, FileText, Bot, CheckCircle, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Layout } from "../../../components/Layout";
import { Button } from "@heroui/react";

interface SubtitleItem {
  start: number;
  end: number;
  text: string;
}

interface SharedLinkData {
  fileId: string;
  expiresAt: number;
  subtitles?: SubtitleItem[] | null;
}

export function ShareView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<string | null>(null);
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);
  const [generatedChecklist, setGeneratedChecklist] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      if (!token) return;
      try {
        const docRef = doc(db, "sharedLinks", token);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const linkData = docSnap.data() as SharedLinkData;
          if (Date.now() > linkData.expiresAt) {
            setError("Este link expirou.");
          } else {
            setData(linkData);
          }
        } else {
          setError("Link não encontrado ou inválido.");
        }
      } catch (err) {
        console.error("Error fetching token:", err);
        setError("Ocorreu um erro ao carregar o vídeo.");
      } finally {
        setLoading(false);
      }
    };
    fetchToken();
  }, [token]);

  const handleGenerateArticle = async () => {
    if (!data?.subtitles) return;
    setIsGeneratingArticle(true);
    try {
      const res = await fetch("/api/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtitles: data.subtitles }),
      });
      const rawText = await res.text();
      let result: any;
      try {
        result = JSON.parse(rawText);
      } catch (e) {
        throw new Error("Resposta inválida do servidor ao gerar artigo");
      }
      if (!res.ok) throw new Error(result?.error || "Erro ao gerar artigo");
      setGeneratedArticle(result.article);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erro ao gerar artigo");
    } finally {
      setIsGeneratingArticle(false);
    }
  };

  const handleGenerateChecklist = async () => {
    if (!data?.subtitles) return;
    setIsGeneratingChecklist(true);
    try {
      const res = await fetch("/api/generate-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtitles: data.subtitles }),
      });
      const rawText = await res.text();
      let result: any;
      try {
        result = JSON.parse(rawText);
      } catch (e) {
        throw new Error("Resposta inválida do servidor ao gerar checklist");
      }
      if (!res.ok) throw new Error(result?.error || "Erro ao gerar checklist");
      setGeneratedChecklist(result.checklist);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erro ao gerar checklist");
    } finally {
      setIsGeneratingChecklist(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Copiado para a área de transferência!");
    });
  };

  if (loading) {
    return (
      <Layout containerClassName="flex items-center justify-center min-h-[calc(100vh-80px)]">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout containerClassName="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div className="bg-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-xl border border-slate-700/50">
          <h2 className="text-xl font-medium text-slate-200 mb-2">Vídeo Indisponível</h2>
          <p className="text-slate-400">{error}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout containerClassName="flex flex-col items-center py-10 px-4 sm:px-8">
      <div className="w-full max-w-5xl bg-slate-900/50 rounded-2xl overflow-hidden shadow-2xl border border-slate-800/50 ring-1 ring-white/5 flex flex-col mb-8">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <h1 className="text-lg font-medium text-slate-200 tracking-tight">Visualização de Vídeo</h1>
          <div className="flex items-center gap-2">
             <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
             </span>
             <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Disponível</span>
          </div>
        </div>
        <div className="aspect-video w-full bg-black relative">
          <iframe
            src={`https://drive.google.com/file/d/${data.fileId}/preview`}
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      </div>

      {data.subtitles && data.subtitles.length > 0 && (
        <div className="w-full max-w-5xl bg-slate-900/50 rounded-2xl p-6 shadow-2xl border border-slate-800/50">
          <div className="flex items-center gap-3 mb-6">
            <Bot className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-medium text-slate-200 tracking-tight">Análise com IA</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Button
              onPress={handleGenerateArticle}
              isDisabled={isGeneratingArticle}
              variant="primary"
              className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGeneratingArticle ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              <span>{isGeneratingArticle ? "Gerando Artigo..." : "Gerar Artigo a partir do Vídeo"}</span>
            </Button>

            <Button
              onPress={handleGenerateChecklist}
              isDisabled={isGeneratingChecklist}
              variant="secondary"
              className="flex items-center justify-center gap-2 w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors border border-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGeneratingChecklist ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              ) : (
                <CheckCircle className="w-5 h-5 text-indigo-400" />
              )}
              <span>{isGeneratingChecklist ? "Processando..." : "Criar Checklist de Ação"}</span>
            </Button>
          </div>

          {generatedArticle && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-slate-300">Artigo Gerado</h3>
                <Button 
                  size="sm"
                  variant="tertiary"
                  isIconOnly
                  onPress={() => copyToClipboard(generatedArticle)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  aria-label="Copiar artigo"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800/80 prose prose-invert max-w-none prose-p:text-slate-300 prose-headings:text-slate-100">
                <ReactMarkdown>{generatedArticle}</ReactMarkdown>
              </div>
            </div>
          )}

          {generatedChecklist && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-slate-300">Checklist Gerado</h3>
                <Button 
                  size="sm"
                  variant="tertiary"
                  isIconOnly
                  onPress={() => copyToClipboard(generatedChecklist)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  aria-label="Copiar checklist"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800/80 prose prose-invert max-w-none prose-p:text-slate-300 prose-headings:text-slate-100 prose-li:text-slate-300">
                <ReactMarkdown>{generatedChecklist}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}

