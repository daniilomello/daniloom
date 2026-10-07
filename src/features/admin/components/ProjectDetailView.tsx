import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Folder, ArrowLeft, Play, ExternalLink, Edit2, Trash2, Loader2, Home,
  ChevronRight, Save, RefreshCw, Upload, Eye, FileVideo, FileText, FileCode,
  File, CheckCircle2, Tag, X, Check, FileEdit, Sparkles, FolderOpen, AlertCircle,
  Copy, ListChecks
} from 'lucide-react';
import Markdown from 'react-markdown';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth, getAccessToken, googleSignIn, logout } from '../../../firebase';
import { 
  listDriveFolderFiles, 
  deleteGoogleDriveFile, 
  renameGoogleDriveFile, 
  uploadFileToDrive, 
  downloadDriveFileAsBlob, 
  fetchProjectScriptFromDrive,
  saveProjectMarkdownScript,
  DriveFileMetadata 
} from '../../../utils/drive';
import { Layout } from '../../../components/Layout';
import { showToast } from '../../../utils/toast';

export const ProjectDetailView = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Project Data
  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth State
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isAdmin = () => user?.email === 'oi@daniilo.dev';

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'script' | 'files' | 'settings'>('script');

  // Markdown Script State
  const [markdownScript, setMarkdownScript] = useState<string>('');
  const [scriptFileId, setScriptFileId] = useState<string | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);
  const [savingScript, setSavingScript] = useState(false);
  const [scriptSyncStatus, setScriptSyncStatus] = useState<'synced' | 'pending' | 'saving' | 'error'>('synced');
  const [isEditingScript, setIsEditingScript] = useState(false);

  // Files State
  const [projectFiles, setProjectFiles] = useState<DriveFileMetadata[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<DriveFileMetadata | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [fileToRename, setFileToRename] = useState<DriveFileMetadata | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [isRenamingFile, setIsRenamingFile] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Video Preview State
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewVideoName, setPreviewVideoName] = useState<string | null>(null);
  const [loadingVideoPreview, setLoadingVideoPreview] = useState(false);

  // Project Settings State
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((usr) => {
      setUser(usr);
      setAuthChecking(false);
      if (usr) {
        if (usr.email !== 'oi@daniilo.dev') {
          navigate('/');
        } else if (projectId) {
          loadProjectDetails(projectId);
        }
      } else {
        navigate('/');
      }
    });

    return () => unsubscribe();
  }, [projectId, navigate]);

  const loadProjectDetails = async (pId: string) => {
    try {
      setLoading(true);
      setError(null);
      const docRef = doc(db, "projects", pId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setError("Projeto não encontrado.");
        setLoading(false);
        return;
      }

      const pData = { id: docSnap.id, ...docSnap.data() } as any;
      setProject(pData);
      setEditName(pData.name || '');
      setEditCategory(pData.category || '');

      // Load files and script
      if (pData.googleDriveFolderId) {
        await Promise.all([
          loadFiles(pData.googleDriveFolderId),
          loadScript(pData.googleDriveFolderId, pData.name)
        ]);
      }
    } catch (err: any) {
      console.error(err);
      setError("Erro ao carregar detalhes do projeto: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async (folderId: string) => {
    try {
      setLoadingFiles(true);
      const token = await getAccessToken();
      if (token) {
        const files = await listDriveFolderFiles(token, folderId);
        setProjectFiles(files);
      }
    } catch (err) {
      console.error("Erro ao listar arquivos:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadScript = async (folderId: string, projName: string) => {
    try {
      setLoadingScript(true);
      const token = await getAccessToken();
      if (token) {
        const { text, fileId } = await fetchProjectScriptFromDrive(token, folderId);
        setScriptFileId(fileId);

        if (text && text.trim().length > 0) {
          setMarkdownScript(text);
        } else {
          // Default Markdown template for video planning
          const defaultTemplate = `# Planejamento do Projeto: ${projName}

## 📋 Lista de Vídeos / Tópicos a Gravar:
- [ ] Tópico 1: Introdução e Apresentação do Conceito
- [ ] Tópico 2: Estrutura Principal e Pontos Chave
- [ ] Tópico 3: Demonstração Prática Passo a Passo
- [ ] Tópico 4: Dicas Especiais e Resolução de Dúvidas
- [ ] Tópico 5: Encerramento e Chamada para Ação (CTA)

## 🎬 Roteiro Detalhado & Anotações:
Escreva aqui o seu roteiro completo, ganchos visuais e pontos que não pode esquecer durante a gravação...
`;
          setMarkdownScript(defaultTemplate);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar roteiro:", err);
    } finally {
      setLoadingScript(false);
    }
  };

  const handleSaveScript = async () => {
    if (!project?.googleDriveFolderId) return;
    try {
      setSavingScript(true);
      setScriptSyncStatus('saving');
      const token = await getAccessToken();
      if (!token) throw new Error("Acesso ao Google Drive indisponível.");

      const fId = await saveProjectMarkdownScript(token, project.googleDriveFolderId, markdownScript);
      setScriptFileId(fId);
      setScriptSyncStatus('synced');
      showToast("Roteiro salvo e sincronizado com o Google Drive!", "success");
      // Refresh files list so roteiro.md appears
      await loadFiles(project.googleDriveFolderId);
    } catch (err: any) {
      console.error(err);
      setScriptSyncStatus('error');
      showToast("Erro ao salvar roteiro no Drive: " + err.message, "error");
    } finally {
      setSavingScript(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMarkdownScript(e.target.value);
    setScriptSyncStatus('pending');
  };

  const handleApplyAndStartProject = () => {
    if (!project) return;
    localStorage.setItem("daniloom_active_project_id", project.id);
    localStorage.setItem("daniloom_active_project_name", project.name);
    localStorage.setItem("daniloom_gdrive_folder_id", project.googleDriveFolderId);
    showToast(`Projeto "${project.name}" ativado com sucesso!`, "success");
    navigate('/');
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !project?.googleDriveFolderId) return;

    try {
      setIsUploadingFile(true);
      const token = await getAccessToken();
      if (!token) throw new Error("Acesso ao Google Drive não autorizado.");

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await uploadFileToDrive(
          token,
          {
            name: file.name,
            parents: [project.googleDriveFolderId],
            mimeType: file.type || "application/octet-stream"
          },
          file
        );
      }

      showToast("Arquivo(s) enviado(s) para a pasta do projeto!", "success");
      await loadFiles(project.googleDriveFolderId);
    } catch (err: any) {
      console.error(err);
      showToast("Erro no envio: " + err.message, "error");
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete || !project?.googleDriveFolderId) return;
    try {
      setIsDeletingFile(true);
      const token = await getAccessToken();
      if (!token) throw new Error("Token do Drive não encontrado.");

      await deleteGoogleDriveFile(token, fileToDelete.id);
      showToast("Arquivo removido do Google Drive.", "success");
      setFileToDelete(null);
      await loadFiles(project.googleDriveFolderId);
    } catch (err: any) {
      console.error(err);
      showToast("Erro ao excluir arquivo: " + err.message, "error");
    } finally {
      setIsDeletingFile(false);
    }
  };

  const handleRenameFile = async () => {
    if (!fileToRename || !newFileName.trim() || !project?.googleDriveFolderId) return;
    try {
      setIsRenamingFile(true);
      const token = await getAccessToken();
      if (!token) throw new Error("Token não encontrado.");

      await renameGoogleDriveFile(token, fileToRename.id, newFileName.trim());
      showToast("Arquivo renomeado!", "success");
      setFileToRename(null);
      setNewFileName('');
      await loadFiles(project.googleDriveFolderId);
    } catch (err: any) {
      console.error(err);
      showToast("Erro ao renomear: " + err.message, "error");
    } finally {
      setIsRenamingFile(false);
    }
  };

  const handlePreviewVideo = async (file: DriveFileMetadata) => {
    try {
      setLoadingVideoPreview(true);
      setPreviewVideoName(file.name || "Vídeo do Projeto");
      const token = await getAccessToken();
      if (!token) throw new Error("Acesso ao Drive indisponível.");

      const blob = await downloadDriveFileAsBlob(token, file.id);
      const videoUrl = URL.createObjectURL(blob);
      setPreviewVideoUrl(videoUrl);
    } catch (err: any) {
      console.error("Erro ao carregar vídeo:", err);
      showToast("Erro ao carregar pré-visualização do vídeo.", "error");
    } finally {
      setLoadingVideoPreview(false);
    }
  };

  const closeVideoPreview = () => {
    if (previewVideoUrl) {
      URL.revokeObjectURL(previewVideoUrl);
    }
    setPreviewVideoUrl(null);
    setPreviewVideoName(null);
  };

  const handleSaveProjectSettings = async () => {
    if (!project || !editName.trim()) return;
    try {
      setIsSavingSettings(true);
      const token = await getAccessToken();

      if (token && project.googleDriveFolderId) {
        await renameGoogleDriveFile(token, project.googleDriveFolderId, editName.trim());
      }

      await updateDoc(doc(db, "projects", project.id), {
        name: editName.trim(),
        category: editCategory.trim() || 'Geral'
      });

      setProject({
        ...project,
        name: editName.trim(),
        category: editCategory.trim() || 'Geral'
      });

      showToast("Configurações do projeto salvas!", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Erro ao salvar projeto: " + err.message, "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    try {
      setIsDeletingProject(true);
      const token = await getAccessToken();
      if (token && project.googleDriveFolderId) {
        await deleteGoogleDriveFile(token, project.googleDriveFolderId);
      }
      await deleteDoc(doc(db, "projects", project.id));

      if (localStorage.getItem("daniloom_active_project_id") === project.id) {
        localStorage.removeItem("daniloom_active_project_id");
        localStorage.removeItem("daniloom_active_project_name");
        localStorage.removeItem("daniloom_gdrive_folder_id");
      }

      showToast("Projeto excluído com sucesso.", "success");
      navigate('/projects');
    } catch (err: any) {
      console.error(err);
      showToast("Erro ao excluir projeto: " + err.message, "error");
    } finally {
      setIsDeletingProject(false);
    }
  };

  const insertMarkdownTemplate = (snippet: string) => {
    setMarkdownScript(prev => prev + "\n" + snippet);
    setScriptSyncStatus('pending');
  };

  const getChecklistStats = (md: string) => {
    const lines = md.split("\n");
    let total = 0;
    let completed = 0;
    lines.forEach(line => {
      if (/^\s*-\s*\[[ xX]\]/.test(line)) {
        total++;
        if (/^\s*-\s*\[[xX]\]/.test(line)) {
          completed++;
        }
      }
    });
    if (total === 0) return null;
    const percentage = Math.round((completed / total) * 100);
    return { completed, total, percentage };
  };

  const toggleChecklistItem = (itemIndex: number) => {
    let count = 0;
    const lines = markdownScript.split("\n");
    const newLines = lines.map(line => {
      if (/^\s*-\s*\[[ xX]\]/.test(line)) {
        if (count === itemIndex) {
          if (/^\s*-\s*\[[xX]\]/.test(line)) {
            line = line.replace(/-\s*\[[xX]\]/, "- [ ]");
          } else {
            line = line.replace(/-\s*\[ \]/, "- [x]");
          }
        }
        count++;
      }
      return line;
    });
    setMarkdownScript(newLines.join("\n"));
    setScriptSyncStatus('pending');
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = value.substring(lineStart, start);

      const checkMatch = currentLine.match(/^(\s*)-\s*\[[ xX]\]\s*(.*)$/);
      const bulletMatch = currentLine.match(/^(\s*)-\s+(.*)$/);

      if (checkMatch) {
        e.preventDefault();
        const indent = checkMatch[1];
        const content = checkMatch[2];

        if (content.trim() === '') {
          const newValue = value.substring(0, lineStart) + value.substring(start);
          setMarkdownScript(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          }, 0);
        } else {
          const prefix = `\n${indent}- [ ] `;
          const newValue = value.substring(0, start) + prefix + value.substring(end);
          setMarkdownScript(newValue);
          setScriptSyncStatus('pending');
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
          }, 0);
        }
      } else if (bulletMatch && !currentLine.includes('[')) {
        e.preventDefault();
        const indent = bulletMatch[1];
        const content = bulletMatch[2];

        if (content.trim() === '') {
          const newValue = value.substring(0, lineStart) + value.substring(start);
          setMarkdownScript(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          }, 0);
        } else {
          const prefix = `\n${indent}- `;
          const newValue = value.substring(0, start) + prefix + value.substring(end);
          setMarkdownScript(newValue);
          setScriptSyncStatus('pending');
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
          }, 0);
        }
      }
    }
  };

  const renderFormattedScript = () => {
    if (!markdownScript || markdownScript.trim().length === 0) {
      return (
        <div className="py-12 text-center text-slate-500 font-mono text-xs">
          Nenhum roteiro escrito ainda. Clique em "Editar Roteiro" para adicionar os tópicos e clipes do seu projeto.
        </div>
      );
    }

    const lines = markdownScript.split('\n');
    let itemIndex = 0;

    return (
      <div className="space-y-3 font-sans text-slate-200">
        {lines.map((line, idx) => {
          const checkMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
          
          if (checkMatch) {
            const isChecked = checkMatch[2].toLowerCase() === 'x';
            const textContent = checkMatch[3];
            const currentIndex = itemIndex++;

            return (
              <div
                key={idx}
                onClick={() => toggleChecklistItem(currentIndex)}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none group ${
                  isChecked
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-400'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-100 shadow-sm'
                }`}
              >
                <button
                  type="button"
                  className={`mt-0.5 p-0.5 rounded-lg transition-colors ${
                    isChecked ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                >
                  {isChecked ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-500/20" />
                  ) : (
                    <div className="w-5 h-5 rounded-lg border-2 border-slate-600 group-hover:border-slate-400 transition-colors" />
                  )}
                </button>
                <div className={`text-xs md:text-sm leading-relaxed flex-1 ${isChecked ? 'line-through text-slate-500' : 'font-medium text-slate-200'}`}>
                  <Markdown components={{ p: React.Fragment }}>{textContent}</Markdown>
                </div>
              </div>
            );
          }

          if (line.startsWith('# ')) {
            return <h1 key={idx} className="text-xl md:text-2xl font-bold text-slate-100 mt-6 mb-3 font-display border-b border-slate-800 pb-2">{line.replace('# ', '')}</h1>;
          }
          if (line.startsWith('## ')) {
            return <h2 key={idx} className="text-lg md:text-xl font-bold text-emerald-400 mt-5 mb-2 font-display flex items-center gap-2">{line.replace('## ', '')}</h2>;
          }
          if (line.startsWith('### ')) {
            return <h3 key={idx} className="text-base md:text-lg font-semibold text-slate-200 mt-4 mb-2 font-display">{line.replace('### ', '')}</h3>;
          }
          if (line.startsWith('> ')) {
            return (
              <blockquote key={idx} className="border-l-4 border-emerald-500/60 bg-emerald-950/10 p-3 rounded-r-xl my-2 text-xs text-slate-300 italic">
                <Markdown components={{ p: React.Fragment }}>{line.replace('> ', '')}</Markdown>
              </blockquote>
            );
          }
          if (line.trim() === '') {
            return <div key={idx} className="h-1.5" />;
          }

          return (
            <div key={idx} className="text-xs md:text-sm text-slate-300 leading-relaxed my-1">
              <Markdown components={{ p: React.Fragment }}>{line}</Markdown>
            </div>
          );
        })}
      </div>
    );
  };

  const getFileIcon = (mimeType?: string, name?: string) => {
    if (mimeType?.includes("video") || name?.endsWith(".webm") || name?.endsWith(".mp4") || name?.endsWith(".mov")) {
      return <FileVideo className="w-5 h-5 text-emerald-400" />;
    }
    if (mimeType?.includes("text") || name?.endsWith(".txt") || name?.endsWith(".md")) {
      return <FileText className="w-5 h-5 text-sky-400" />;
    }
    if (mimeType?.includes("json") || name?.endsWith(".json")) {
      return <FileCode className="w-5 h-5 text-amber-400" />;
    }
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const formatFileSize = (bytes?: number | string) => {
    if (!bytes) return "N/A";
    const num = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
    if (isNaN(num)) return "N/A";
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isActive = localStorage.getItem("daniloom_active_project_id") === projectId;

  const handleSignOut = async () => {
    try {
      await logout();
      setUser(null);
      window.location.href = "/";
    } catch (err: any) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-xs">Carregando detalhes do projeto...</span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <Layout
        user={user}
        authChecking={authChecking}
        isLoggingIn={isLoggingIn}
        isUserMenuOpen={isUserMenuOpen}
        onUserMenuToggle={() => setIsUserMenuOpen(!isUserMenuOpen)}
        onSignIn={async () => { await googleSignIn(); }}
        onSignOut={handleSignOut}
        isAdmin={isAdmin()}
        containerClassName="max-w-4xl mx-auto p-6"
      >
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center my-12">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-100 font-display">Projeto não encontrado</h2>
          <p className="text-xs text-slate-400 mt-2 mb-6">{error || "O projeto solicitado não existe ou foi removido."}</p>
          <button 
            onClick={() => navigate('/projects')}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Voltar para Projetos
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      user={user}
      authChecking={authChecking}
      isLoggingIn={isLoggingIn}
      isUserMenuOpen={isUserMenuOpen}
      onUserMenuToggle={() => setIsUserMenuOpen(!isUserMenuOpen)}
      onSignIn={async () => { await googleSignIn(); }}
      onSignOut={handleSignOut}
      isAdmin={isAdmin()}
      containerClassName="max-w-6xl mx-auto p-6 md:p-8"
    >
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6 font-medium">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-1 hover:text-slate-300 transition-colors cursor-pointer"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Início</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
        <button 
          onClick={() => navigate('/projects')} 
          className="hover:text-slate-300 transition-colors cursor-pointer"
        >
          Projetos
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
        <span className="text-slate-300 font-semibold truncate max-w-xs">{project.name}</span>
      </nav>

      {/* Project Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className={`p-3.5 rounded-2xl border ${
              isActive 
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <FolderOpen className="w-8 h-8" />
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-100 tracking-tight font-display">
                  {project.name}
                </h1>
                <span className="text-xs font-mono uppercase bg-slate-950 border border-slate-800 text-slate-400 px-3 py-1 rounded-md">
                  {project.category || 'Geral'}
                </span>
                {isActive && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-0.5 rounded-full font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ativo para Gravação
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-4">
                <span>Criado em: {new Date(project.createdAt).toLocaleDateString("pt-BR")}</span>
                <span>•</span>
                <span>Google Drive ID: <code className="text-slate-300 font-mono">{project.googleDriveFolderId}</code></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={`https://drive.google.com/drive/folders/${project.googleDriveFolderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-slate-400" />
              <span>Abrir no Drive</span>
            </a>

            <button
              onClick={handleApplyAndStartProject}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Acessar e Aplicar no Estúdio</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('script')}
          className={`pb-3 px-4 text-xs md:text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'script' 
              ? 'border-emerald-400 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileEdit className="w-4 h-4" />
          <span>Roteiro & Planejamento</span>
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`pb-3 px-4 text-xs md:text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'files' 
              ? 'border-emerald-400 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Folder className="w-4 h-4" />
          <span>Arquivos do Projeto ({projectFiles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-4 text-xs md:text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'settings' 
              ? 'border-emerald-400 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Edit2 className="w-4 h-4" />
          <span>Configurações</span>
        </button>
      </div>

      {/* TAB 1: ROTEIRO & PLANEJAMENTO (REAL-TIME INTERACTIVE MARKDOWN & SYNC) */}
      {activeTab === 'script' && (
        <div className="space-y-4">
          {/* Top Bar with Stats & Save */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <ListChecks className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-200">Roteiro & Checklist de Clipes</h3>
                  {scriptSyncStatus === 'pending' && <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">• Não salvo</span>}
                  {scriptSyncStatus === 'synced' && <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">• Sincronizado</span>}
                  {scriptSyncStatus === 'saving' && <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full animate-pulse">• Salvando...</span>}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sincronizado diretamente com <code className="text-slate-400 font-mono">roteiro.md</code> na pasta do projeto no Drive
                </p>
              </div>
            </div>

            {/* Checklist Stats Progress Bar */}
            {(() => {
              const stats = getChecklistStats(markdownScript);
              if (!stats) return null;
              return (
                <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2">
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-200">{stats.completed} de {stats.total} vídeos gravados</span>
                    <span className="text-[10px] text-slate-400 block">{stats.percentage}% concluído</span>
                  </div>
                  <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${stats.percentage}%` }} />
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center gap-2 self-end md:self-center">
              <button
                onClick={() => setIsEditingScript(!isEditingScript)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isEditingScript 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' 
                    : 'bg-slate-950 hover:bg-slate-800 text-emerald-400 border border-slate-800'
                }`}
              >
                {isEditingScript ? (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>Ver Renderizado</span>
                  </>
                ) : (
                  <>
                    <FileEdit className="w-4 h-4" />
                    <span>Editar Roteiro (Texto)</span>
                  </>
                )}
              </button>

              <button
                onClick={handleSaveScript}
                disabled={savingScript}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-500/10"
              >
                {savingScript ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Salvar no Drive</span>
              </button>
            </div>
          </div>

          {/* Quick Insert Templates Toolbar (Only when editing) */}
          {isEditingScript && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-500 font-medium whitespace-nowrap">Atalhos rápidos:</span>
              <button
                onClick={() => insertMarkdownTemplate("- [ ] Tópico Novo: Adicionar título do clipe")}
                className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1"
              >
                + Item Checklist
              </button>
              <button
                onClick={() => insertMarkdownTemplate("## 🎬 Novo Roteiro de Vídeo\n- **Gancho Inicial (0-5s):** ...\n- **Conteúdo Principal:** ...\n- **Chamada de Ação (CTA):** ...")}
                className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1"
              >
                + Seção de Roteiro
              </button>
              <button
                onClick={() => insertMarkdownTemplate("\n### 📍 Ponto Chave para Inserir na Edição:\n> Inserir elemento visual ou screenshot aqui.\n")}
                className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1"
              >
                + Dica de Edição
              </button>
            </div>
          )}

          {/* Main Single View */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 min-h-[520px]">
            {isEditingScript ? (
              <div className="flex flex-col h-full min-h-[480px]">
                <div className="flex items-center justify-between mb-2 text-xs text-slate-400 font-mono">
                  <span>Modo Editor de Texto (Pressione Enter para novo item de checklist)</span>
                  <button
                    onClick={() => setIsEditingScript(false)}
                    className="text-emerald-400 hover:underline cursor-pointer"
                  >
                    Concluir Edição & Visualizar →
                  </button>
                </div>
                <textarea
                  value={markdownScript}
                  onChange={handleTextChange}
                  onKeyDown={handleEditorKeyDown}
                  placeholder="Escreva o roteiro e planejamento do seu vídeo aqui em Markdown... Use - [ ] Tópico para criar checklists."
                  className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs md:text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none leading-relaxed min-h-[420px]"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Visualização Interativa (Clique nos itens para marcar/desmarcar vídeos concluídos)
                  </span>
                  <button
                    onClick={() => setIsEditingScript(true)}
                    className="text-xs text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar Texto
                  </button>
                </div>

                {renderFormattedScript()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ARQUIVOS DO PROJETO (GOOGLE DRIVE EXPLORER) */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => loadFiles(project.googleDriveFolderId)}
                disabled={loadingFiles}
                className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-emerald-400 ${loadingFiles ? 'animate-spin' : ''}`} />
                <span>Atualizar Lista</span>
              </button>
            </div>

            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUploadFile}
                multiple
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingFile}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isUploadingFile ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                ) : (
                  <Upload className="w-4 h-4 text-emerald-400" />
                )}
                <span>Importar Arquivo para o Drive</span>
              </button>
            </div>
          </div>

          {/* Files List */}
          {loadingFiles ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <span className="text-xs">Buscando arquivos na pasta do Google Drive...</span>
            </div>
          ) : projectFiles.length === 0 ? (
            <div className="py-16 text-center bg-slate-900/50 rounded-2xl border border-slate-800">
              <Folder className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">Pasta vazia no Google Drive</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Grave novos clipes no Estúdio ou importe vídeos e arquivos para armazená-los neste projeto.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {projectFiles.map(file => (
                <div 
                  key={file.id} 
                  className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-slate-700 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                      {getFileIcon(file.mimeType, file.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-slate-200 truncate group-hover:text-emerald-300 transition-colors">
                        {file.name}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>Modificado: {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString("pt-BR") : 'N/A'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(file.mimeType?.includes("video") || file.name?.endsWith(".webm") || file.name?.endsWith(".mp4")) && (
                      <button
                        onClick={() => handlePreviewVideo(file)}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-slate-800 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Assistir</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setFileToRename(file);
                        setNewFileName(file.name || '');
                      }}
                      className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-950 rounded-xl transition-colors cursor-pointer"
                      title="Renomear"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-950 rounded-xl transition-colors cursor-pointer"
                        title="Ver no Google Drive"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}

                    <button
                      onClick={() => setFileToDelete(file)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONFIGURAÇÕES DO PROJETO */}
      {activeTab === 'settings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 max-w-2xl">
          <h3 className="text-base font-semibold text-slate-200 font-display flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-emerald-400" />
            Editar Dados do Projeto
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome do Projeto</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Categoria</label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">ID da Pasta no Google Drive</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={project.googleDriveFolderId}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-slate-400"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(project.googleDriveFolderId);
                    showToast("ID copiado!", "info");
                  }}
                  className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-colors cursor-pointer"
                  title="Copiar ID"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              onClick={handleSaveProjectSettings}
              disabled={isSavingSettings || !editName.trim()}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Salvar Alterações</span>
            </button>
          </div>

          <hr className="border-slate-800 my-6" />

          {/* Danger Zone */}
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">Zona de Perigo</h4>
            <p className="text-xs text-slate-400">
              A exclusão removerá permanentemente este projeto e apagará a pasta correspondente no Google Drive.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir Projeto Definitivamente</span>
            </button>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      {previewVideoName && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md bg-slate-950/90 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2 truncate">
                <FileVideo className="w-5 h-5 text-emerald-400" />
                {previewVideoName}
              </h3>
              <button 
                onClick={closeVideoPreview}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingVideoPreview ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                <span className="text-xs">Baixando vídeo do Google Drive...</span>
              </div>
            ) : previewVideoUrl ? (
              <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
                <video 
                  src={previewVideoUrl} 
                  controls 
                  autoPlay 
                  className="max-h-[65vh] w-full object-contain"
                />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-950/80">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-fade-in">
            <h3 className="text-lg font-semibold text-slate-100 font-display flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-500" />
              Confirmar Exclusão
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir o projeto <strong className="text-slate-100">"{project.name}"</strong>? Esta ação excluirá a pasta no Drive e o registro no banco de dados.
            </p>
            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingProject}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-xs font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={isDeletingProject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20"
              >
                {isDeletingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete File Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-950/80">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-fade-in">
            <h3 className="text-lg font-semibold text-slate-100 font-display flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-500" />
              Excluir Arquivo
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir o arquivo <strong className="text-slate-100">"{fileToDelete.name}"</strong> do Google Drive?
            </p>
            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => setFileToDelete(null)}
                disabled={isDeletingFile}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-xs font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteFile}
                disabled={isDeletingFile}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isDeletingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir Arquivo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {fileToRename && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-950/80">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-fade-in">
            <h3 className="text-lg font-semibold text-slate-100 font-display flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-emerald-400" />
              Renomear Arquivo
            </h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Novo Nome do Arquivo</label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => setFileToRename(null)}
                disabled={isRenamingFile}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-xs font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleRenameFile}
                disabled={isRenamingFile || !newFileName.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                {isRenamingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : "Renomear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
