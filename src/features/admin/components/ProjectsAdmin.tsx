import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Folder, Plus, Trash2, Edit2, Loader2, ArrowLeft, CheckCircle2,
  ChevronDown, LogOut, Home, ChevronRight, ExternalLink, RefreshCw,
  FileVideo, FileText, FileCode, File, Upload, Eye, X, Play, Download,
  Search, Tag, Sparkles, FolderSync, FolderOpen, Check, HardDrive
} from 'lucide-react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db, auth, getAccessToken, googleSignIn, logout } from '../../../firebase';
import { 
  getOrCreateParentdaniloomFolder, 
  createGoogleDriveFolder, 
  deleteGoogleDriveFile,
  listDriveFolderFiles,
  listParentDriveSubfolders,
  renameGoogleDriveFile,
  uploadFileToDrive,
  downloadDriveFileAsBlob,
  fetchDriveFolderSizes,
  formatBytes,
  DriveFileMetadata 
} from '../../../utils/drive';
import { Layout } from '../../../components/Layout';
import { showToast } from '../../../utils/toast';

export interface Project {
  id: string;
  name: string;
  category: string;
  googleDriveFolderId: string;
  createdAt: number;
}

export const ProjectsAdmin = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Create Project State
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectCategory, setNewProjectCategory] = useState("");

  // Syncing State
  const [isSyncing, setIsSyncing] = useState(false);

  // Edit Project State
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);

  // Drive Storage Sizes State
  const [projectSizes, setProjectSizes] = useState<Record<string, number>>({});
  const [totalDaniloomSize, setTotalDaniloomSize] = useState<number | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Expanded Project View State (In-App File Explorer)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectFiles, setProjectFiles] = useState<DriveFileMetadata[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  
  // File Action States
  const [fileToDelete, setFileToDelete] = useState<DriveFileMetadata | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  // File Rename State
  const [fileToRename, setFileToRename] = useState<DriveFileMetadata | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [isRenamingFile, setIsRenamingFile] = useState(false);

  // Video Preview State
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewVideoName, setPreviewVideoName] = useState<string | null>(null);
  const [loadingVideoPreview, setLoadingVideoPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth and header states
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isAdmin = () => user?.email === 'oi@daniilo.dev';

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((usr) => {
      setUser(usr);
      setAuthChecking(false);
      if (usr) {
        if (usr.email !== 'oi@daniilo.dev') {
          navigate('/');
        } else {
          loadProjects();
        }
      } else {
        navigate('/');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setUser(null);
      window.location.href = "/";
    } catch (err: any) {
      console.error(err);
    }
  };

  const calculateStorageSizes = async (targetProjects?: Project[]) => {
    const list = targetProjects || projects;
    if (!list || list.length === 0) {
      setTotalDaniloomSize(0);
      setProjectSizes({});
      return;
    }
    try {
      setLoadingStorage(true);
      const token = await getAccessToken();
      if (!token) return;

      const folderIds = list.map(p => p.googleDriveFolderId).filter(Boolean);
      const { projectSizes: sizes, totalDaniloomSize: total } = await fetchDriveFolderSizes(token, folderIds);
      
      setProjectSizes(sizes);
      setTotalDaniloomSize(total);
    } catch (err) {
      console.warn("Erro ao calcular armazenamento:", err);
    } finally {
      setLoadingStorage(false);
    }
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const projData: Project[] = [];
      snapshot.forEach((doc) => projData.push({ id: doc.id, ...doc.data() } as Project));
      setProjects(projData);

      // Sincroniza e calcula tamanhos das pastas do Drive em segundo plano
      calculateStorageSizes(projData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Sync Google Drive Subfolders into Firestore
  const handleSyncDriveFolders = async () => {
    try {
      setIsSyncing(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) throw new Error("Token do Google Drive não encontrado. Faça login novamente.");

      const subfolders = await listParentDriveSubfolders(token);
      const existingFolderIds = new Set(projects.map(p => p.googleDriveFolderId));

      let importedCount = 0;
      for (const folder of subfolders) {
        if (!existingFolderIds.has(folder.id)) {
          const newProj = {
            name: folder.name || "Projeto Sincronizado",
            category: "Drive",
            googleDriveFolderId: folder.id,
            createdAt: folder.createdTime ? new Date(folder.createdTime).getTime() : Date.now()
          };
          await addDoc(collection(db, "projects"), newProj);
          importedCount++;
        }
      }

      if (importedCount > 0) {
        showToast(`${importedCount} nova(s) pasta(s) importada(s) do Google Drive!`, "success");
        await loadProjects();
      } else {
        showToast("Todas as pastas do Google Drive já estão sincronizadas.", "info");
      }
    } catch (err: any) {
      console.error(err);
      setError("Erro ao sincronizar com Google Drive: " + err.message);
      showToast("Falha na sincronização com o Drive.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      setIsCreating(true);
      const token = await getAccessToken();
      if (!token) throw new Error("Google Drive Token não encontrado. Faça login novamente.");

      const parentId = await getOrCreateParentdaniloomFolder(token);
      const driveFolderId = await createGoogleDriveFolder(token, newProjectName, parentId);

      const newProj = {
        name: newProjectName,
        category: newProjectCategory || "Geral",
        googleDriveFolderId: driveFolderId,
        createdAt: Date.now()
      };

      await addDoc(collection(db, "projects"), newProj);
      
      setNewProjectName("");
      setNewProjectCategory("");
      showToast("Projeto criado com sucesso no Google Drive!", "success");
      await loadProjects();
    } catch (err: any) {
      setError("Erro ao criar projeto: " + err.message);
      showToast("Erro ao criar projeto.", "error");
    } finally {
      setIsCreating(false);
    }
  };

  // Update Project Name and Category in Firestore and Google Drive
  const handleSaveProjectEdit = async () => {
    if (!editingProject || !editName.trim()) return;
    try {
      setIsUpdatingProject(true);
      const token = await getAccessToken();

      // Rename folder in Drive if token available
      if (token && editingProject.googleDriveFolderId) {
        await renameGoogleDriveFile(token, editingProject.googleDriveFolderId, editName.trim());
      }

      // Update in Firestore
      await updateDoc(doc(db, "projects", editingProject.id), {
        name: editName.trim(),
        category: editCategory.trim() || "Geral"
      });

      showToast("Projeto atualizado!", "success");
      setEditingProject(null);
      await loadProjects();
    } catch (err: any) {
      console.error(err);
      showToast("Erro ao atualizar projeto: " + err.message, "error");
    } finally {
      setIsUpdatingProject(false);
    }
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      setIsDeleting(true);
      const token = await getAccessToken();
      if (token && projectToDelete.googleDriveFolderId) {
        await deleteGoogleDriveFile(token, projectToDelete.googleDriveFolderId);
      }
      await deleteDoc(doc(db, "projects", projectToDelete.id));
      
      if (localStorage.getItem("daniloom_active_project_id") === projectToDelete.id) {
        localStorage.removeItem("daniloom_active_project_id");
        localStorage.removeItem("daniloom_active_project_name");
        localStorage.removeItem("daniloom_gdrive_folder_id");
      }
      
      setProjects(projects.filter(p => p.id !== projectToDelete.id));
      if (selectedProject?.id === projectToDelete.id) {
        setSelectedProject(null);
      }
      setProjectToDelete(null);
      showToast("Projeto excluído com sucesso.", "success");
    } catch (err: any) {
      setError("Erro ao excluir: " + err.message);
      showToast("Erro ao excluir projeto.", "error");
    } finally {
      setIsDeleting(false);
    }
  };
  
  const activateProject = (project: Project) => {
    localStorage.setItem("daniloom_active_project_id", project.id);
    localStorage.setItem("daniloom_active_project_name", project.name);
    localStorage.setItem("daniloom_gdrive_folder_id", project.googleDriveFolderId);
    showToast(`Projeto "${project.name}" ativado para gravação!`, "success");
    navigate('/');
  };

  // Open Project File Browser (Expand Project)
  const openProjectExplorer = async (project: Project) => {
    setSelectedProject(project);
    setLoadingFiles(true);
    setProjectFiles([]);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Acesso ao Google Drive indisponível.");
      const files = await listDriveFolderFiles(token, project.googleDriveFolderId);
      setProjectFiles(files);
    } catch (err: any) {
      console.error("Erro ao carregar arquivos do projeto:", err);
      showToast("Erro ao listar arquivos do projeto no Drive.", "error");
    } finally {
      setLoadingFiles(false);
    }
  };

  // Refresh files inside current expanded project
  const refreshProjectFiles = async () => {
    if (!selectedProject) return;
    setLoadingFiles(true);
    try {
      const token = await getAccessToken();
      if (token) {
        const files = await listDriveFolderFiles(token, selectedProject.googleDriveFolderId);
        setProjectFiles(files);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFiles(false);
    }
  };

  // Delete file inside project
  const confirmDeleteFile = async () => {
    if (!fileToDelete || !selectedProject) return;
    try {
      setIsDeletingFile(true);
      const token = await getAccessToken();
      if (!token) throw new Error("Token não encontrado.");
      await deleteGoogleDriveFile(token, fileToDelete.id);
      showToast("Arquivo excluído do Google Drive.", "success");
      setFileToDelete(null);
      await refreshProjectFiles();
    } catch (err: any) {
      console.error(err);
      showToast("Erro ao excluir arquivo: " + err.message, "error");
    } finally {
      setIsDeletingFile(false);
    }
  };

  // Upload/Import file directly into project folder
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedProject) return;

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
            parents: [selectedProject.googleDriveFolderId],
            mimeType: file.type || "application/octet-stream"
          },
          file
        );
      }

      showToast("Arquivo(s) importado(s) com sucesso!", "success");
      await refreshProjectFiles();
    } catch (err: any) {
      console.error("Erro no upload:", err);
      showToast("Erro ao enviar arquivo para o Drive: " + err.message, "error");
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Rename File inside Drive Project
  const handleRenameFile = async () => {
    if (!fileToRename || !newFileName.trim()) return;
    try {
      setIsRenamingFile(true);
      const token = await getAccessToken();
      if (!token) throw new Error("Token não encontrado.");

      await renameGoogleDriveFile(token, fileToRename.id, newFileName.trim());
      showToast("Arquivo renomeado com sucesso!", "success");
      setFileToRename(null);
      setNewFileName("");
      await refreshProjectFiles();
    } catch (err: any) {
      console.error(err);
      showToast("Erro ao renomear arquivo: " + err.message, "error");
    } finally {
      setIsRenamingFile(false);
    }
  };

  // Play/Preview Video file inside app
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

  const activeProjectId = localStorage.getItem("daniloom_active_project_id");

  // Filter Categories
  const categories = Array.from(new Set(projects.map(p => p.category || "Geral")));
  
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <Layout
      user={user}
      authChecking={authChecking}
      isLoggingIn={isLoggingIn}
      isUserMenuOpen={isUserMenuOpen}
      onUserMenuToggle={() => setIsUserMenuOpen(!isUserMenuOpen)}
      onSignIn={handleSignIn}
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
        <span className="text-slate-300 font-semibold">Projetos</span>
      </nav>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <Folder className="text-emerald-400 w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight font-display">Gestão de Projetos</h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Crie, explore arquivos, renomeie e sincronize pastas do Google Drive de forma centralizada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Storage Summary Card */}
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 shadow-sm">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <HardDrive className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Drive (daniloom)</span>
                <button
                  onClick={() => calculateStorageSizes()}
                  disabled={loadingStorage}
                  className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer"
                  title="Recalcular tamanho total do armazenamento"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingStorage ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              </div>
              <div className="text-sm font-bold text-slate-100 font-mono">
                {loadingStorage ? (
                  <span className="text-xs text-slate-500 font-sans flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" /> Calculando...
                  </span>
                ) : totalDaniloomSize !== null ? (
                  formatBytes(totalDaniloomSize)
                ) : (
                  "0 MB"
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleSyncDriveFolders}
            disabled={isSyncing}
            className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            title="Buscar e importar subpastas criadas diretamente na pasta daniloom do Google Drive"
          >
            <FolderSync className={`w-4 h-4 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? "Sincronizando..." : "Sincronizar com Drive"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl mb-8 text-sm">
          {error}
        </div>
      )}

      {/* Form: Novo Projeto */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 mb-8 backdrop-blur-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          Criar Novo Projeto
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-6">
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Nome do Projeto</label>
            <input 
              type="text" 
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Ex: Lançamento Curso React"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Categoria</label>
            <input 
              type="text" 
              value={newProjectCategory}
              onChange={(e) => setNewProjectCategory(e.target.value)}
              placeholder="Ex: Aulas, Estudo, Cliente X"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div className="md:col-span-2">
            <button 
              onClick={handleCreateProject}
              disabled={isCreating || !newProjectName.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Criar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar projeto por nome ou categoria..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" /> Categoria:
          </span>
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              selectedCategory === "all" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Todas ({projects.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategory === cat ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-12 text-center">
          <Folder className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">Nenhum projeto encontrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Crie um novo projeto acima ou clique em "Sincronizar com Drive" para importar pastas existentes da pasta daniloom.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => (
            <div 
              key={project.id} 
              className={`bg-slate-900 border transition-all ${
                activeProjectId === project.id ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.08)]' : 'border-slate-800 hover:border-slate-700'
              } rounded-2xl p-5 flex flex-col group`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${activeProjectId === project.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-950 text-slate-400'}`}>
                    <Folder className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider bg-slate-950 px-2.5 py-1 rounded-md text-slate-400 border border-slate-800/80">
                    {project.category || "Geral"}
                  </span>
                </div>
                {activeProjectId === project.id && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Ativo
                  </span>
                )}
              </div>

              <h3 className="text-base font-semibold text-slate-100 mb-1 truncate group-hover:text-emerald-300 transition-colors" title={project.name}>
                {project.name}
              </h3>
              
              <div className="text-xs text-slate-500 mb-5 flex items-center justify-between">
                <span>Criado em: {new Date(project.createdAt).toLocaleDateString("pt-BR")}</span>
                <div 
                  className="flex items-center gap-1.5 bg-slate-950 border border-slate-800/80 px-2.5 py-1 rounded-lg font-mono text-[11px] text-slate-300 shadow-inner"
                  title="Tamanho dos arquivos armazenados na pasta deste projeto no Google Drive"
                >
                  <HardDrive className="w-3 h-3 text-emerald-400" />
                  <span>
                    {loadingStorage ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-emerald-400" />
                    ) : projectSizes[project.googleDriveFolderId] !== undefined ? (
                      formatBytes(projectSizes[project.googleDriveFolderId])
                    ) : (
                      "0 MB"
                    )}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-auto space-y-2">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Acessar Projeto</span>
                  </button>

                  <button 
                    onClick={() => activateProject(project)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      activeProjectId === project.id 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold' 
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                    title="Definir como projeto ativo para gravação no Estúdio"
                  >
                    {activeProjectId === project.id ? 'Ativo' : 'Ativar no Estúdio'}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-800/60">
                  <button 
                    onClick={() => {
                      setEditingProject(project);
                      setEditName(project.name);
                      setEditCategory(project.category);
                    }}
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                    title="Editar nome e categoria"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <a 
                    href={`https://drive.google.com/drive/folders/${project.googleDriveFolderId}`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-1.5 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-400 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                    title="Abrir no Google Drive"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button 
                    onClick={() => setProjectToDelete(project)} 
                    className="p-1.5 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 rounded-lg transition-colors cursor-pointer"
                    title="Excluir projeto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expanded Project View Drawer/Modal (In-App File Explorer) */}
      {selectedProject && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 backdrop-blur-md bg-slate-950/80 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <FolderOpen className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-100 font-display">{selectedProject.name}</h2>
                    <span className="text-[10px] font-mono uppercase bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-400">
                      {selectedProject.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Arquivos salvos diretamente na pasta do Google Drive deste projeto
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => activateProject(selectedProject)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Iniciar no Estúdio</span>
                </button>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Toolbar */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshProjectFiles}
                  disabled={loadingFiles}
                  className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Atualizar lista de arquivos"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loadingFiles ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>

                <a 
                  href={`https://drive.google.com/drive/folders/${selectedProject.googleDriveFolderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir no Drive</span>
                </a>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
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
                  <span>Importar Arquivo</span>
                </button>
              </div>
            </div>

            {/* File List */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingFiles ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <span className="text-xs">Carregando arquivos do Google Drive...</span>
                </div>
              ) : projectFiles.length === 0 ? (
                <div className="py-12 text-center bg-slate-950/50 rounded-2xl border border-slate-800/80">
                  <File className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-300">Nenhum arquivo nesta pasta</p>
                  <p className="text-xs text-slate-500 mt-1">Use o botão "Importar Arquivo" acima ou grave clipes no Estúdio para esta pasta.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projectFiles.map(file => (
                    <div 
                      key={file.id} 
                      className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                          {getFileIcon(file.mimeType, file.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium text-slate-200 truncate group-hover:text-emerald-300 transition-colors">
                            {file.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                            <span>{formatFileSize(file.size)}</span>
                            <span>•</span>
                            <span>{file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString("pt-BR") : 'Data N/A'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {(file.mimeType?.includes("video") || file.name?.endsWith(".webm") || file.name?.endsWith(".mp4")) && (
                          <button
                            onClick={() => handlePreviewVideo(file)}
                            className="p-2 bg-slate-900 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-slate-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                            title="Assistir vídeo no app"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Assistir</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setFileToRename(file);
                            setNewFileName(file.name || "");
                          }}
                          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                          title="Renomear arquivo"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                            title="Ver no Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          onClick={() => setFileToDelete(file)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Excluir arquivo do Drive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-950/80">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-fade-in">
            <h3 className="text-lg font-semibold text-slate-100 font-display flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-emerald-400" />
              Editar Projeto
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Nome do Projeto</label>
                <input 
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Categoria</label>
                <input 
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => setEditingProject(null)}
                disabled={isUpdatingProject}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-xs font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProjectEdit}
                disabled={isUpdatingProject || !editName.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                {isUpdatingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-950/80">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-fade-in">
            <h3 className="text-lg font-semibold text-slate-100 font-display flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-500" />
              Excluir Projeto
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir o projeto <strong className="text-slate-100">"{projectToDelete.name}"</strong>? Isso removerá o registro e apagará a pasta do Google Drive correspondente. Esta ação é irreversível.
            </p>
            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => setProjectToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-xs font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteProject}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <span>Confirmar Exclusão</span>
                )}
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
              Excluir Arquivo do Drive
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
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20"
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
