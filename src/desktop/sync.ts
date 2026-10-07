import { doc, getDoc } from 'firebase/firestore';
import { auth, db, getAccessToken, isGoogleTokenExpired } from '../firebase';
import { getConfigFromDB, saveConfigToDB } from '../utils/projectDB';
import { fetchWithRetry } from '../utils/drive';
import { uploadResumable, DriveUploadResult } from './resumableUpload';
import type { Clip } from '../types';

const inFlight = new Map<string, Promise<DriveUploadResult>>();
export function syncDesktopClip(clip: Clip, projectId: string): Promise<DriveUploadResult> {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error('Entre na sua conta Google para enviar a gravação.'));
  if (!projectId) return Promise.reject(new Error('Ative um projeto antes de enviar a gravação.'));
  const key = `${uid}:${projectId}:${clip.id}`;
  if (inFlight.has(key)) return inFlight.get(key)!;
  const upload = (async () => {
    const token = await getAccessToken();
    if (!token || isGoogleTokenExpired()) throw new Error('Renove sua conexão com o Google Drive para enviar a gravação.');
    const project = await getDoc(doc(db, 'projects', projectId));
    const folderId = project.data()?.googleDriveFolderId;
    if (!project.exists() || typeof folderId !== 'string' || !/^[\w-]+$/.test(folderId)) throw new Error('Projeto indisponível. Selecione um projeto válido.');
    const storageKey = `desktop_sync:${key}`;
    const saved = await getConfigFromDB(storageKey);
    if (saved?.file?.id) return saved.file;
    const clipKey = clip.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const query = `'${folderId}' in parents and trashed = false and appProperties has { key='daniloomClipId' and value='${clipKey}' }`;
    const search = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)`, { headers: { Authorization: `Bearer ${token}` } });
    if (!search.ok) throw new Error('Não foi possível verificar as gravações no Google Drive.');
    const existing = (await search.json()).files?.[0];
    if (existing) { await saveConfigToDB(storageKey, { file: existing }); return existing; }
    const mime = clip.blob.type.split(';')[0] || 'video/webm';
    const file = await uploadResumable({
      blob: clip.blob, token,
      metadata: { name: `${clip.name}.${mime === 'video/mp4' ? 'mp4' : 'webm'}`, mimeType: mime, parents: [folderId], appProperties: { daniloomClipId: clipKey, source: 'desktop' } },
      sessionUrl: saved?.sessionUrl,
      saveSession: (sessionUrl) => saveConfigToDB(storageKey, { sessionUrl }),
      onProgress: (percent) => window.dispatchEvent(new CustomEvent('daniloom:sync-progress', { detail: { clipId: clip.id, percent } })),
    });
    await saveConfigToDB(storageKey, { file });
    return file;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, upload);
  return upload;
}
