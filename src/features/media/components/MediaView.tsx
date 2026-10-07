import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Film, 
  Folder, 
  Play, 
  Trash2, 
  Download, 
  ExternalLink, 
  LayoutGrid, 
  List, 
  Search, 
  RefreshCw, 
  CheckSquare, 
  Square, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  ChevronDown, 
  Home, 
  Loader2, 
  AlertCircle, 
  HardDrive, 
  Check, 
  CheckCheck, 
  Video, 
  Filter, 
  FileVideo,
  Edit2
} from 'lucide-react';
import { collection, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db, auth, getAccessToken, googleSignIn, logout } from '../../../firebase';
import { 
  listDriveFolderFiles, 
  deleteGoogleDriveFile, 
  downloadDriveFileAsBlob, 
  renameGoogleDriveFile,
  formatBytes,
  DriveFileMetadata 
} from '../../../utils/drive';
import { getClipsFromDB, deleteClipFromDB, updateClipNameInDB } from '../../../utils/projectDB';
import { Layout } from '../../../components/Layout';
import { CustomPlayer } from '../../../components/CustomPlayer';
import { showToast } from '../../../utils/toast';
import { Clip, MediaClipItem, ProjectGroup } from '../../../types';

export const MediaView: React.FC = () => {
  const navigate = useNavigate();

  // Auth & User State
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isAdmin = () => user?.email === 'oi@daniilo.dev';

  // Core Data States
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View Options: 'cards' (Grid) or 'list'
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  // Selection & Multi-select State
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());

  // Player / Watching State
  const [activeClip, setActiveClip] = useState<MediaClipItem | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<MediaClipItem[]>([]);
  const [playingBlobUrl, setPlayingBlobUrl] = useState<string | null>(null);
  const [loadingPlayingVideo, setLoadingPlayingVideo] = useState(false);
  const [blobCache, setBlobCache] = useState<Record<string, string>>({});

  // Rename Clip State
  const [clipToRename, setClipToRename] = useState<MediaClipItem | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Deletion Confirmation Dialog States
  const [clipToDelete, setClipToDelete] = useState<MediaClipItem | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<ProjectGroup | null>(null);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((usr) => {
      setUser(usr);
      setAuthChecking(false);
      if (usr) {
        loadAllMedia();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Focus rename input when modal opens
  useEffect(() => {
    if (clipToRename && renameInputRef.current) {
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 50);
    }
  }, [clipToRename]);

  // Clean up Object URLs when unmounting or changing cache
  useEffect(() => {
    return () => {
      Object.values(blobCache).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      });
      if (playingBlobUrl) {
        try {
          URL.revokeObjectURL(playingBlobUrl);
        } catch (_) {}
      }
    };
  }, []);

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        loadAllMedia();
      }
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao realizar login com o Google Drive.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setUser(null);
      window.location.href = '/';
    } catch (err: any) {
      console.error(err);
    }
  };

  // Main Data Loader: Fetch projects from Firestore + files from Google Drive + Local DB clips
  const loadAllMedia = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();

      // 1. Fetch all Firestore projects
      let rawProjects: Array<{ id: string; name: string; category: string; googleDriveFolderId: string; createdAt: number }> = [];
      try {
        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const projSnap = await getDocs(q);
        projSnap.forEach((d) => {
          rawProjects.push({ id: d.id, ...d.data() } as any);
        });
      } catch (firestoreErr) {
        console.warn('Erro ao consultar Firestore projects:', firestoreErr);
      }

      // 2. Fetch local clips from IndexedDB/OPFS
      let localClips: Clip[] = [];
      try {
        localClips = await getClipsFromDB();
      } catch (err) {
        console.warn('Erro ao carregar clipes locais:', err);
      }

      // 3. For each project, fetch its video files from Google Drive
      const groups: ProjectGroup[] = [];

      for (const proj of rawProjects) {
        let driveFiles: DriveFileMetadata[] = [];
        if (token && proj.googleDriveFolderId) {
          try {
            const allFiles = await listDriveFolderFiles(token, proj.googleDriveFolderId);
            // Filter video files
            driveFiles = allFiles.filter((f) => {
              const mime = f.mimeType || '';
              const name = f.name?.toLowerCase() || '';
              return (
                mime.startsWith('video/') ||
                name.endsWith('.webm') ||
                name.endsWith('.mp4') ||
                name.endsWith('.mov') ||
                name.endsWith('.mkv')
              );
            });
          } catch (driveErr) {
            console.warn(`Erro ao carregar arquivos do projeto ${proj.name}:`, driveErr);
          }
        }

        const projectClips: MediaClipItem[] = driveFiles.map((df) => ({
          id: df.id,
          name: df.name || 'Gravação sem título',
          size: df.size,
          mimeType: df.mimeType,
          modifiedTime: df.modifiedTime,
          createdTime: df.createdTime,
          webViewLink: df.webViewLink,
          thumbnailLink: (df as any).thumbnailLink,
          driveFileId: df.id,
          projectId: proj.id,
          projectName: proj.name,
          projectCategory: proj.category,
          googleDriveFolderId: proj.googleDriveFolderId,
          isLocalOnly: false,
        }));

        const totalSize = driveFiles.reduce((acc, f) => acc + (parseInt(f.size || '0', 10) || 0), 0);

        groups.push({
          id: proj.id,
          name: proj.name,
          category: proj.category || 'Geral',
          googleDriveFolderId: proj.googleDriveFolderId,
          createdAt: proj.createdAt,
          clips: projectClips,
          totalSize,
        });
      }

      // 4. If there are local clips stored in Studio
      if (localClips.length > 0) {
        const localItems: MediaClipItem[] = localClips.map((c) => ({
          id: `local_${c.id}`,
          name: c.name || 'Gravação do Estúdio (Local)',
          size: c.blob ? c.blob.size : 0,
          mimeType: c.blob ? c.blob.type : 'video/webm',
          createdTime: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
          localBlob: c.blob,
          localUrl: c.url,
          duration: c.duration,
          format: c.format,
          projectId: 'local_studio',
          projectName: 'Gravações Recentes do Estúdio',
          projectCategory: 'Local',
          isLocalOnly: true,
        }));

        const localSize = localClips.reduce((acc, c) => acc + (c.blob ? c.blob.size : 0), 0);

        groups.unshift({
          id: 'local_studio',
          name: 'Gravações Recentes do Estúdio',
          category: 'Estúdio Local',
          googleDriveFolderId: '',
          createdAt: Date.now(),
          clips: localItems,
          totalSize: localSize,
        });
      }

      setProjectGroups(groups);
    } catch (err: any) {
      console.error('Erro ao carregar mídia:', err);
      setError(err.message || 'Erro ao carregar gravações.');
      showToast('Erro ao carregar gravações.', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAllMedia();
  };

  // Play a Clip in CustomPlayer
  const handlePlayClip = async (clip: MediaClipItem, playlist?: MediaClipItem[]) => {
    setActiveClip(clip);
    if (playlist) {
      setActivePlaylist(playlist);
    } else {
      const group = projectGroups.find((g) => g.id === clip.projectId);
      setActivePlaylist(group ? group.clips : [clip]);
    }

    if (clip.localBlob) {
      if (!clip.localUrl) {
        const url = URL.createObjectURL(clip.localBlob);
        setPlayingBlobUrl(url);
      } else {
        setPlayingBlobUrl(clip.localUrl);
      }
      setLoadingPlayingVideo(false);
      return;
    }

    if (blobCache[clip.id]) {
      setPlayingBlobUrl(blobCache[clip.id]);
      setLoadingPlayingVideo(false);
      return;
    }

    try {
      setLoadingPlayingVideo(true);
      setPlayingBlobUrl(null);
      const token = await getAccessToken();
      if (!token) throw new Error('Acesso ao Google Drive indisponível.');

      const blob = await downloadDriveFileAsBlob(token, clip.id);
      const objectUrl = URL.createObjectURL(blob);

      setBlobCache((prev) => ({ ...prev, [clip.id]: objectUrl }));
      setPlayingBlobUrl(objectUrl);
    } catch (err: any) {
      console.error('Erro ao carregar vídeo para assistir:', err);
      showToast('Erro ao baixar vídeo para reprodução.', 'error');
    } finally {
      setLoadingPlayingVideo(false);
    }
  };

  const handleNextClip = () => {
    if (!activeClip || activePlaylist.length <= 1) return;
    const currentIndex = activePlaylist.findIndex((c) => c.id === activeClip.id);
    if (currentIndex >= 0 && currentIndex < activePlaylist.length - 1) {
      handlePlayClip(activePlaylist[currentIndex + 1], activePlaylist);
    }
  };

  const handlePrevClip = () => {
    if (!activeClip || activePlaylist.length <= 1) return;
    const currentIndex = activePlaylist.findIndex((c) => c.id === activeClip.id);
    if (currentIndex > 0) {
      handlePlayClip(activePlaylist[currentIndex - 1], activePlaylist);
    }
  };

  const closePlayer = () => {
    setActiveClip(null);
    setPlayingBlobUrl(null);
    setLoadingPlayingVideo(false);
  };

  // Toggle Selection of a single clip
  const toggleSelectClip = (clipId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedClipIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  // Toggle selection for all clips in a specific project
  const toggleSelectProjectClips = (project: ProjectGroup) => {
    const projectClipIds = project.clips.map((c) => c.id);
    const allSelected = projectClipIds.every((id) => selectedClipIds.has(id));

    setSelectedClipIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        projectClipIds.forEach((id) => next.delete(id));
      } else {
        projectClipIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // Select all clips currently filtered
  const selectAllFilteredClips = () => {
    const allIds = new Set<string>();
    filteredGroups.forEach((g) => {
      g.clips.forEach((c) => allIds.add(c.id));
    });
    setSelectedClipIds(allIds);
  };

  // Deselect all
  const clearSelection = () => {
    setSelectedClipIds(new Set());
  };

  // Open Rename Modal for a clip
  const handleStartRename = (clip: MediaClipItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setClipToRename(clip);
    setRenameInput(clip.name);
  };

  // Confirm Rename Operation (Sync with Drive and Local DB)
  const confirmRenameClip = async () => {
    if (!clipToRename || !renameInput.trim()) return;
    const newName = renameInput.trim();

    if (newName === clipToRename.name) {
      setClipToRename(null);
      return;
    }

    try {
      setIsRenaming(true);

      // If stored on Google Drive, rename via Google Drive API
      if (clipToRename.driveFileId && !clipToRename.isLocalOnly) {
        const token = await getAccessToken();
        if (!token) throw new Error('Acesso ao Google Drive indisponível.');
        const success = await renameGoogleDriveFile(token, clipToRename.driveFileId, newName);
        if (!success) {
          throw new Error('Falha ao renomear o arquivo no Google Drive.');
        }
      }

      // If local, rename in indexedDB
      if (clipToRename.isLocalOnly) {
        const rawLocalId = clipToRename.id.replace('local_', '');
        await updateClipNameInDB(rawLocalId, newName);
      }

      // Update state in projectGroups
      setProjectGroups((prev) =>
        prev.map((g) => {
          if (g.id === clipToRename.projectId) {
            return {
              ...g,
              clips: g.clips.map((c) => (c.id === clipToRename.id ? { ...c, name: newName } : c)),
            };
          }
          return g;
        })
      );

      // If active clip in player is this one, update its name
      if (activeClip?.id === clipToRename.id) {
        setActiveClip((prev) => (prev ? { ...prev, name: newName } : null));
      }
      if (activePlaylist.length > 0) {
        setActivePlaylist((prev) =>
          prev.map((c) => (c.id === clipToRename.id ? { ...c, name: newName } : c))
        );
      }

      showToast(`Gravação renomeada para "${newName}" com sucesso!`, 'success');
      setClipToRename(null);
    } catch (err: any) {
      console.error('Erro ao renomear gravação:', err);
      showToast('Erro ao renomear: ' + (err.message || 'Tente novamente.'), 'error');
    } finally {
      setIsRenaming(false);
    }
  };

  // Single Clip Deletion (Drive and Local DB)
  const confirmDeleteSingleClip = async () => {
    if (!clipToDelete) return;
    try {
      setIsDeletingSingle(true);

      // If on Drive, delete from Drive
      if (clipToDelete.driveFileId && !clipToDelete.isLocalOnly) {
        const token = await getAccessToken();
        if (token) {
          await deleteGoogleDriveFile(token, clipToDelete.driveFileId);
        }
      }

      // If local, delete from local DB
      if (clipToDelete.isLocalOnly) {
        const rawLocalId = clipToDelete.id.replace('local_', '');
        await deleteClipFromDB(rawLocalId);
      }

      // Clean blob cache
      if (blobCache[clipToDelete.id]) {
        try {
          URL.revokeObjectURL(blobCache[clipToDelete.id]);
        } catch (_) {}
        setBlobCache((prev) => {
          const next = { ...prev };
          delete next[clipToDelete.id];
          return next;
        });
      }

      // If actively playing this clip, close player
      if (activeClip?.id === clipToDelete.id) {
        closePlayer();
      }

      // Update state
      setProjectGroups((prev) =>
        prev.map((g) => {
          if (g.id === clipToDelete.projectId) {
            const updatedClips = g.clips.filter((c) => c.id !== clipToDelete.id);
            const deletedSize = typeof clipToDelete.size === 'string' ? parseInt(clipToDelete.size, 10) || 0 : clipToDelete.size || 0;
            return {
              ...g,
              clips: updatedClips,
              totalSize: Math.max(0, g.totalSize - deletedSize),
            };
          }
          return g;
        })
      );

      // Remove from selection if present
      setSelectedClipIds((prev) => {
        const next = new Set(prev);
        next.delete(clipToDelete.id);
        return next;
      });

      showToast(`Clipe "${clipToDelete.name}" excluído com sucesso.`, 'success');
      setClipToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir clipe:', err);
      showToast('Erro ao excluir clipe do Drive: ' + err.message, 'error');
    } finally {
      setIsDeletingSingle(false);
    }
  };

  // Batch Deletion of Selected Clips (Drive and Local DB)
  const confirmBatchDelete = async () => {
    if (selectedClipIds.size === 0) return;
    try {
      setIsBatchDeleting(true);
      const token = await getAccessToken();
      const allClipsMap = new Map<string, MediaClipItem>();
      projectGroups.forEach((g) => {
        g.clips.forEach((c) => allClipsMap.set(c.id, c));
      });

      const selectedClips = Array.from(selectedClipIds)
        .map((id) => allClipsMap.get(id))
        .filter(Boolean) as MediaClipItem[];

      let deletedCount = 0;

      for (const clip of selectedClips) {
        try {
          if (clip.driveFileId && !clip.isLocalOnly && token) {
            await deleteGoogleDriveFile(token, clip.driveFileId);
          } else if (clip.isLocalOnly) {
            const rawLocalId = clip.id.replace('local_', '');
            await deleteClipFromDB(rawLocalId);
          }
          if (blobCache[clip.id]) {
            try {
              URL.revokeObjectURL(blobCache[clip.id]);
            } catch (_) {}
          }
          deletedCount++;
        } catch (err) {
          console.warn(`Erro ao excluir clipe ${clip.name}:`, err);
        }
      }

      // Close player if playing one of deleted
      if (activeClip && selectedClipIds.has(activeClip.id)) {
        closePlayer();
      }

      // Update groups
      setProjectGroups((prev) =>
        prev.map((g) => {
          const remainingClips = g.clips.filter((c) => !selectedClipIds.has(c.id));
          const newTotalSize = remainingClips.reduce(
            (acc, c) => acc + (typeof c.size === 'string' ? parseInt(c.size, 10) || 0 : c.size || 0),
            0
          );
          return {
            ...g,
            clips: remainingClips,
            totalSize: newTotalSize,
          };
        })
      );

      showToast(`${deletedCount} clipe(s) excluído(s) com sucesso.`, 'success');
      setSelectedClipIds(new Set());
      setShowBatchDeleteModal(false);
    } catch (err: any) {
      console.error('Erro na exclusão em lote:', err);
      showToast('Erro ao excluir clipes: ' + err.message, 'error');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // Delete Entire Project (Firestore + Drive folder)
  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      setIsDeletingProject(true);
      const token = await getAccessToken();

      // Delete Google Drive folder if exists
      if (token && projectToDelete.googleDriveFolderId) {
        await deleteGoogleDriveFile(token, projectToDelete.googleDriveFolderId);
      }

      // Delete Firestore doc if not local
      if (projectToDelete.id !== 'local_studio') {
        try {
          await deleteDoc(doc(db, 'projects', projectToDelete.id));
        } catch (fErr) {
          console.warn('Erro ao deletar projeto no Firestore:', fErr);
        }
      }

      // Clean local storage if it was active
      if (localStorage.getItem('daniloom_active_project_id') === projectToDelete.id) {
        localStorage.removeItem('daniloom_active_project_id');
        localStorage.removeItem('daniloom_active_project_name');
        localStorage.removeItem('daniloom_gdrive_folder_id');
      }

      // Update state
      setProjectGroups((prev) => prev.filter((g) => g.id !== projectToDelete.id));

      // Remove any selected clips from this project
      const removedClipIds = new Set(projectToDelete.clips.map((c) => c.id));
      setSelectedClipIds((prev) => {
        const next = new Set(prev);
        removedClipIds.forEach((id) => next.delete(id));
        return next;
      });

      if (activeClip && removedClipIds.has(activeClip.id)) {
        closePlayer();
      }

      showToast(`Projeto "${projectToDelete.name}" e todas as suas gravações foram excluídos do Drive.`, 'success');
      setProjectToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir projeto:', err);
      showToast('Erro ao excluir projeto: ' + err.message, 'error');
    } finally {
      setIsDeletingProject(false);
    }
  };

  // Download clip file helper
  const handleDownloadClip = async (clip: MediaClipItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (clip.localBlob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(clip.localBlob);
        let safeName = clip.name.replace(/\.(webm|mp4|mov|mkv)$/i, '');
        a.download = `${safeName}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Download iniciado.', 'success');
        return;
      }

      const token = await getAccessToken();
      if (!token) throw new Error('Acesso ao Google Drive indisponível.');

      showToast('Preparando download do Drive...', 'info');
      const blob = await downloadDriveFileAsBlob(token, clip.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      let driveName = clip.name.replace(/\.(webm|mp4|mov|mkv)$/i, '');
      a.download = `${driveName}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('Download concluído!', 'success');
    } catch (err: any) {
      console.error('Erro no download:', err);
      showToast('Erro ao baixar vídeo: ' + err.message, 'error');
    }
  };

  // Toggle Collapse project section
  const toggleCollapse = (projId: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projId]: !prev[projId],
    }));
  };

  // Total summary statistics
  const totalStats = useMemo(() => {
    let totalClipsCount = 0;
    let totalBytesSize = 0;
    projectGroups.forEach((g) => {
      totalClipsCount += g.clips.length;
      totalBytesSize += g.totalSize;
    });
    return {
      projectsCount: projectGroups.filter((g) => g.id !== 'local_studio').length,
      clipsCount: totalClipsCount,
      totalSizeFormatted: formatBytes(totalBytesSize),
    };
  }, [projectGroups]);

  // Filtered project groups based on search & project selector
  const filteredGroups = useMemo(() => {
    return projectGroups
      .filter((g) => selectedProjectId === 'all' || g.id === selectedProjectId)
      .map((g) => {
        if (!searchQuery.trim()) return g;
        const q = searchQuery.toLowerCase();
        const matchesProject = g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q);
        if (matchesProject) return g;
        const filteredClips = g.clips.filter((c) => c.name.toLowerCase().includes(q));
        return {
          ...g,
          clips: filteredClips,
        };
      })
      .filter((g) => g.clips.length > 0 || (selectedProjectId === g.id && !searchQuery.trim()));
  }, [projectGroups, searchQuery, selectedProjectId]);

  // State: Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        <span className="text-xs font-medium">Carregando gravações e projetos do Google Drive...</span>
      </div>
    );
  }

  // State: Not Authenticated with Google Drive
  if (!authChecking && !user) {
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
        containerClassName="max-w-7xl mx-auto p-4 sm:p-6 md:p-8"
      >
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center max-w-md w-full shadow-2xl backdrop-blur-md">
            <div className="w-16 h-16 rounded-3xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-5 shadow-inner">
              <Film className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-100 font-display tracking-tight">Biblioteca de Mídia</h2>
            <p className="text-xs text-slate-400 mt-2.5 mb-6 leading-relaxed">
              A área de Mídia e Gravações é exclusiva para usuários conectados com o Google Drive para armazenar, assistir e sincronizar vídeos em tempo real.
            </p>
            <button
              onClick={handleSignIn}
              disabled={isLoggingIn}
              className="w-full py-3 px-5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-2xl text-xs font-semibold transition-all inline-flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-sky-500/20"
            >
              {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              <span>Conectar com Google Drive</span>
            </button>
          </div>
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
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
      isAdmin={isAdmin()}
      containerClassName="max-w-7xl mx-auto p-4 sm:p-6 md:p-8"
    >
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 mb-5 font-medium">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 hover:text-slate-300 transition-colors cursor-pointer"
          title="Ir para a tela inicial do Estúdio"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Início</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
        <span className="text-slate-300 font-semibold">Mídia</span>
      </nav>

      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-xl">
              <Film className="text-sky-400 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight font-display">Mídia & Gravações</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Acesse, assista, renomeie e gerencie todos os clipes e vídeos gravados, agrupados por projeto e sincronizados com o Google Drive.
              </p>
            </div>
          </div>
        </div>

        {/* Header Stats & Quick Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Storage & Counts Widget */}
          <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Folder className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-200">{totalStats.projectsCount}</span>
              <span className="hidden sm:inline">projetos</span>
            </div>
            <span className="text-slate-700">•</span>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Video className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-semibold text-slate-200">{totalStats.clipsCount}</span>
              <span className="hidden sm:inline">vídeos</span>
            </div>
            <span className="text-slate-700">•</span>
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300" title="Tamanho total no Drive">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>{totalStats.totalSizeFormatted}</span>
            </div>
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Atualizar lista de gravações do Google Drive"
          >
            <RefreshCw className={`w-4 h-4 text-sky-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl mb-6 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Minimalist Filter & View Switcher Bar */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 backdrop-blur-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar clipe ou projeto..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Project Selector Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-7 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500/50 cursor-pointer appearance-none"
              title="Filtrar por projeto"
            >
              <option value="all">Todos os Projetos ({projectGroups.length})</option>
              {projectGroups.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.clips.length})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 pointer-events-none" />
          </div>

          {/* View Mode Toggle: Cards vs List (Icon-only with Tooltip) */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-sky-500/20 text-sky-400 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
              }`}
              title="Visualização em Grade / Capas de Vídeo"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-sky-500/20 text-sky-400 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
              }`}
              title="Visualização em Lista Compacta"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Multi-Select Action Bar (Shows when items are selected) */}
      {selectedClipIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-sky-500/40 rounded-2xl px-5 py-3 shadow-2xl backdrop-blur-md flex items-center gap-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-xs font-bold text-sky-400 font-mono">
              {selectedClipIds.size}
            </div>
            <span className="text-xs font-semibold text-slate-200">
              {selectedClipIds.size === 1 ? '1 clipe selecionado' : `${selectedClipIds.size} clipes selecionados`}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Select all filtered */}
          <button
            onClick={selectAllFilteredClips}
            className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
            title="Selecionar todos os clipes visíveis"
          >
            <CheckSquare className="w-4 h-4" />
          </button>

          {/* Clear selection */}
          <button
            onClick={clearSelection}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Desmarcar seleção"
          >
            <Square className="w-4 h-4" />
          </button>

          {/* Batch delete */}
          <button
            onClick={() => setShowBatchDeleteModal(true)}
            className="p-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 rounded-xl transition-colors cursor-pointer"
            title="Excluir clipes selecionados do Google Drive"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={clearSelection}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
            title="Fechar barra de seleção"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Groups / Recordings Content */}
      {filteredGroups.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-12 text-center my-6">
          <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200 font-display">Nenhuma gravação encontrada</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto mb-5">
            {searchQuery
              ? 'Nenhum vídeo corresponde à sua pesquisa. Tente buscar por outro termo.'
              : 'Grave novos vídeos no Estúdio ou envie arquivos para a pasta do projeto no Google Drive.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10"
            title="Ir para o Estúdio de Gravação"
          >
            <Video className="w-4 h-4" />
            <span>Gravar no Estúdio</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6 pb-20">
          {filteredGroups.map((group) => {
            const isCollapsed = collapsedProjects[group.id] || false;
            const projectClipIds = group.clips.map((c) => c.id);
            const allProjectSelected =
              projectClipIds.length > 0 && projectClipIds.every((id) => selectedClipIds.has(id));
            const someProjectSelected =
              projectClipIds.some((id) => selectedClipIds.has(id)) && !allProjectSelected;

            return (
              <section
                key={group.id}
                className="bg-slate-900/60 border border-slate-800/90 rounded-3xl p-5 md:p-6 transition-all hover:border-slate-800"
              >
                {/* Project Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/70">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleCollapse(group.id)}
                      className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      title={isCollapsed ? 'Expandir gravações do projeto' : 'Recolher gravações do projeto'}
                    >
                      {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>

                    <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400">
                      <Folder className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-slate-100 font-display tracking-tight">
                          {group.name}
                        </h2>
                        <span className="text-[10px] font-mono uppercase bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-400">
                          {group.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{group.clips.length} {group.clips.length === 1 ? 'vídeo' : 'vídeos'}</span>
                        <span>•</span>
                        <span>{formatBytes(group.totalSize)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Project Action Icon Buttons with Tooltips */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    {/* Watch All Clips in Project */}
                    {group.clips.length > 0 && (
                      <button
                        onClick={() => handlePlayClip(group.clips[0], group.clips)}
                        className="p-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-xl transition-colors cursor-pointer"
                        title="Assistir todos os clipes deste projeto em sequência"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    )}

                    {/* Select/Deselect All in Project */}
                    {group.clips.length > 0 && (
                      <button
                        onClick={() => toggleSelectProjectClips(group)}
                        className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                          allProjectSelected
                            ? 'bg-sky-500/20 text-sky-400 border-sky-500/30 font-semibold'
                            : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
                        }`}
                        title={
                          allProjectSelected
                            ? 'Desmarcar todos os vídeos deste projeto'
                            : 'Selecionar todos os vídeos deste projeto'
                        }
                      >
                        {allProjectSelected ? (
                          <CheckCheck className="w-4 h-4 text-sky-400" />
                        ) : someProjectSelected ? (
                          <CheckSquare className="w-4 h-4 text-sky-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    {/* Open Project in Google Drive */}
                    {group.googleDriveFolderId && (
                      <a
                        href={`https://drive.google.com/drive/folders/${group.googleDriveFolderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-800 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                        title="Abrir pasta deste projeto no Google Drive"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}

                    {/* Delete Entire Project */}
                    {group.id !== 'local_studio' && (
                      <button
                        onClick={() => setProjectToDelete(group)}
                        className="p-2 bg-slate-950 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-slate-800 rounded-xl transition-colors cursor-pointer"
                        title="Excluir projeto e todos os seus vídeos do Drive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Project Clips Content */}
                {!isCollapsed && (
                  <div className="pt-4">
                    {group.clips.length === 0 ? (
                      <div className="py-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800/60">
                        <FileVideo className="w-8 h-8 text-slate-600 mx-auto mb-1.5" />
                        <p className="text-xs font-medium text-slate-400">Nenhum clipe gravado para este projeto ainda.</p>
                      </div>
                    ) : viewMode === 'cards' ? (
                      /* CARDS / GRID VIEW */
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {group.clips.map((clip) => {
                          const isSelected = selectedClipIds.has(clip.id);
                          return (
                            <div
                              key={clip.id}
                              className={`group relative bg-slate-950 border rounded-2xl overflow-hidden flex flex-col transition-all duration-200 ${
                                isSelected
                                  ? 'border-sky-500/60 shadow-[0_0_15px_rgba(14,165,233,0.15)] ring-1 ring-sky-500/50'
                                  : 'border-slate-800/80 hover:border-slate-700 hover:shadow-lg'
                              }`}
                            >
                              {/* Thumbnail / Video Preview Area */}
                              <div
                                onClick={() => handlePlayClip(clip, group.clips)}
                                className="relative aspect-video bg-slate-900 flex items-center justify-center cursor-pointer overflow-hidden group/thumb"
                              >
                                {clip.thumbnailLink ? (
                                  <img
                                    src={clip.thumbnailLink}
                                    alt={clip.name}
                                    className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : clip.localUrl ? (
                                  <video
                                    src={clip.localUrl}
                                    preload="metadata"
                                    className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300 pointer-events-none"
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 text-slate-500 group-hover/thumb:text-sky-400 transition-colors">
                                    <FileVideo className="w-10 h-10 mb-1 opacity-70" />
                                    <span className="text-[10px] font-mono text-slate-500">Vídeo</span>
                                  </div>
                                )}

                                {/* Hover Play Overlay */}
                                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                  <div className="w-10 h-10 rounded-full bg-sky-500/90 text-white flex items-center justify-center shadow-xl transform scale-90 group-hover/thumb:scale-100 transition-transform">
                                    <Play className="w-4 h-4 fill-current ml-0.5" />
                                  </div>
                                </div>

                                {/* Multi-select Checkbox (Top Left) */}
                                <button
                                  type="button"
                                  onClick={(e) => toggleSelectClip(clip.id, e)}
                                  className={`absolute top-2.5 left-2.5 p-1.5 rounded-lg backdrop-blur-md transition-all cursor-pointer z-10 ${
                                    isSelected
                                      ? 'bg-sky-500 text-white shadow-md'
                                      : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-700/60 opacity-80 hover:opacity-100'
                                  }`}
                                  title={isSelected ? 'Desmarcar clipe' : 'Selecionar clipe para ações em lote'}
                                >
                                  {isSelected ? <Check className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                </button>

                                {/* Size & Date Badge (Bottom Right) */}
                                <div className="absolute bottom-2 right-2 flex items-center gap-1 pointer-events-none">
                                  {clip.size && (
                                    <span className="bg-slate-950/80 backdrop-blur-xs text-slate-300 font-mono text-[9px] px-1.5 py-0.5 rounded border border-slate-800">
                                      {formatBytes(typeof clip.size === 'string' ? parseInt(clip.size, 10) : clip.size)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Card Meta & Action Footer */}
                              <div className="p-3.5 flex flex-col flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <h3
                                    onClick={() => handlePlayClip(clip, group.clips)}
                                    className="text-xs font-semibold text-slate-200 truncate cursor-pointer hover:text-sky-300 transition-colors flex-1"
                                    title={clip.name}
                                  >
                                    {clip.name}
                                  </h3>
                                  <button
                                    onClick={(e) => handleStartRename(clip, e)}
                                    className="p-1 text-slate-500 hover:text-sky-400 hover:bg-slate-900 rounded-md transition-colors cursor-pointer shrink-0"
                                    title="Renomear gravação"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="text-[10px] text-slate-500 mt-1 mb-3 flex items-center justify-between">
                                  <span>
                                    {clip.modifiedTime
                                      ? new Date(clip.modifiedTime).toLocaleDateString('pt-BR')
                                      : clip.createdTime
                                      ? new Date(clip.createdTime).toLocaleDateString('pt-BR')
                                      : 'Data N/A'}
                                  </span>
                                  {clip.isLocalOnly && (
                                    <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono text-[9px]">
                                      Local
                                    </span>
                                  )}
                                </div>

                                {/* Minimalist Icon Action Buttons (with tooltips) */}
                                <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-800/70">
                                  <button
                                    onClick={() => handlePlayClip(clip, group.clips)}
                                    className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                                    title="Assistir vídeo"
                                  >
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                  </button>

                                  <button
                                    onClick={(e) => handleStartRename(clip, e)}
                                    className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                                    title="Renomear gravação"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={(e) => handleDownloadClip(clip, e)}
                                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                                    title="Baixar vídeo"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>

                                  {clip.webViewLink && (
                                    <a
                                      href={clip.webViewLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-900 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                                      title="Ver no Google Drive"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setClipToDelete(clip);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Excluir clipe do Drive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* LIST VIEW */
                      <div className="space-y-2">
                        {group.clips.map((clip) => {
                          const isSelected = selectedClipIds.has(clip.id);
                          return (
                            <div
                              key={clip.id}
                              className={`p-3 bg-slate-950 border rounded-2xl flex items-center justify-between gap-3 transition-all ${
                                isSelected
                                  ? 'border-sky-500/60 bg-sky-500/5 ring-1 ring-sky-500/40'
                                  : 'border-slate-800/80 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {/* Select checkbox */}
                                <button
                                  type="button"
                                  onClick={(e) => toggleSelectClip(clip.id, e)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-sky-500 text-white'
                                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                                  }`}
                                  title={isSelected ? 'Desmarcar clipe' : 'Selecionar clipe'}
                                >
                                  {isSelected ? <Check className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                </button>

                                {/* Play icon / Quick play */}
                                <button
                                  onClick={() => handlePlayClip(clip, group.clips)}
                                  className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-sky-400 hover:border-sky-500/40 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                  title="Assistir vídeo"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                </button>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span
                                      onClick={() => handlePlayClip(clip, group.clips)}
                                      className="text-xs font-semibold text-slate-200 truncate cursor-pointer hover:text-sky-400 transition-colors"
                                      title={clip.name}
                                    >
                                      {clip.name}
                                    </span>
                                    {clip.isLocalOnly && (
                                      <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono text-[9px]">
                                        Local
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                                    <span>
                                      {clip.modifiedTime
                                        ? new Date(clip.modifiedTime).toLocaleDateString('pt-BR')
                                        : clip.createdTime
                                        ? new Date(clip.createdTime).toLocaleDateString('pt-BR')
                                        : 'Data N/A'}
                                    </span>
                                    <span>•</span>
                                    <span className="font-mono">
                                      {formatBytes(typeof clip.size === 'string' ? parseInt(clip.size, 10) : clip.size || 0)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* List Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handlePlayClip(clip, group.clips)}
                                  className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                                  title="Assistir clipe"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                </button>

                                <button
                                  onClick={(e) => handleStartRename(clip, e)}
                                  className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                                  title="Renomear clipe"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={(e) => handleDownloadClip(clip, e)}
                                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                                  title="Baixar vídeo"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>

                                {clip.webViewLink && (
                                  <a
                                    href={clip.webViewLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-900 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                                    title="Abrir no Google Drive"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setClipToDelete(clip);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Excluir clipe do Drive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* FULLSCREEN / DEDICATED CUSTOM PLAYER MODAL */}
      {activeClip && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex flex-col justify-between animate-fade-in">
          {/* Top Bar of Modal Player */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/80 z-20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-xl">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 truncate max-w-md">{activeClip.name}</h3>
                <p className="text-[11px] text-slate-500 flex items-center gap-2">
                  <span className="text-emerald-400">{activeClip.projectName}</span>
                  <span>•</span>
                  <span>{activeClip.projectCategory}</span>
                </p>
              </div>
            </div>

            {/* Top Right Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStartRename(activeClip)}
                className="p-2 text-slate-400 hover:text-sky-400 hover:bg-slate-900 border border-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Renomear gravação"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={(e) => handleDownloadClip(activeClip, e)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Baixar vídeo"
              >
                <Download className="w-4 h-4" />
              </button>

              {activeClip.webViewLink && (
                <a
                  href={activeClip.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-900 border border-slate-800 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                  title="Abrir no Google Drive"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              <button
                onClick={closePlayer}
                className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Fechar reprodutor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Video Stage Area */}
          <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-4 sm:p-6 overflow-hidden gap-6">
            {/* Player Container */}
            <div className="flex-1 w-full max-w-5xl h-full flex flex-col items-center justify-center">
              {loadingPlayingVideo ? (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
                  <span className="text-xs">Baixando vídeo do Google Drive para reprodução contínua...</span>
                </div>
              ) : playingBlobUrl ? (
                <div className="w-full h-full max-h-[70vh] flex items-center justify-center">
                  <CustomPlayer
                    src={playingBlobUrl}
                    downloadName={activeClip.name}
                    theme="emerald"
                  />
                </div>
              ) : (
                <div className="text-center text-slate-500">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-400" />
                  <p className="text-xs">Não foi possível carregar a gravação.</p>
                </div>
              )}
            </div>

            {/* Playlist Drawer on Side for Project */}
            {activePlaylist.length > 1 && (
              <div className="w-full lg:w-80 h-auto lg:h-[70vh] bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                  <h4 className="text-xs font-bold text-slate-200">
                    Playlist do Projeto ({activePlaylist.length})
                  </h4>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handlePrevClip}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                      title="Vídeo anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleNextClip}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                      title="Próximo vídeo"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Playlist Clips List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {activePlaylist.map((plClip, idx) => {
                    const isCurrent = plClip.id === activeClip.id;
                    return (
                      <div
                        key={plClip.id}
                        onClick={() => handlePlayClip(plClip, activePlaylist)}
                        className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                          isCurrent
                            ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-xs'
                            : 'bg-slate-950/70 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono shrink-0 ${
                            isCurrent ? 'bg-sky-500 text-white' : 'bg-slate-900 text-slate-500'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{plClip.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {formatBytes(typeof plClip.size === 'string' ? parseInt(plClip.size, 10) : plClip.size || 0)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RENAME CLIP MODAL */}
      {clipToRename && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-xl">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Renomear Gravação</h3>
                  <p className="text-[11px] text-slate-400">Sincroniza automaticamente com o Google Drive</p>
                </div>
              </div>
              <button
                onClick={() => setClipToRename(null)}
                className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Nome do Arquivo</label>
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmRenameClip();
                    if (e.key === 'Escape') setClipToRename(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                  placeholder="Nome do clipe..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setClipToRename(null)}
                  disabled={isRenaming}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmRenameClip}
                  disabled={isRenaming || !renameInput.trim()}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-sky-500/10"
                >
                  {isRenaming && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar Nome</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE CLIP DELETE CONFIRMATION MODAL */}
      {clipToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Excluir Gravação?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Você tem certeza que deseja excluir o clipe <strong className="text-slate-200 font-semibold">"{clipToDelete.name}"</strong>? Esta ação é definitiva e apagará o arquivo do seu Google Drive.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setClipToDelete(null)}
                disabled={isDeletingSingle}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteSingleClip}
                disabled={isDeletingSingle}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-500/10"
              >
                {isDeletingSingle && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Excluir do Drive</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH CLIPS DELETE CONFIRMATION MODAL */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Excluir Clipes Selecionados?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Você está prestes a excluir permanentemente <strong className="text-slate-200 font-semibold">{selectedClipIds.size} gravações selecionadas</strong> do Google Drive. Deseja continuar?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBatchDeleteModal(false)}
                disabled={isBatchDeleting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmBatchDelete}
                disabled={isBatchDeleting}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-500/10"
              >
                {isBatchDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Excluir {selectedClipIds.size} Clipes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROJECT DELETE CONFIRMATION MODAL */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <Folder className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Excluir Projeto e Gravações?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Tem certeza que deseja excluir o projeto <strong className="text-slate-200 font-semibold">"{projectToDelete.name}"</strong>? Esta ação excluirá a pasta do projeto no Google Drive e todos os seus vídeos gravados permanentemente.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setProjectToDelete(null)}
                disabled={isDeletingProject}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteProject}
                disabled={isDeletingProject}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-500/10"
              >
                {isDeletingProject && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Excluir Projeto do Drive</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
