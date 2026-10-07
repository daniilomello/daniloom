export interface DriveUploadResult { id: string; name: string; webViewLink?: string }
const CHUNK_SIZE = 8 * 1024 * 1024;

export async function uploadResumable({ blob, token, metadata, sessionUrl, saveSession, onProgress, request = fetch }: {
  blob: Blob; token: string; metadata: Record<string, unknown>; sessionUrl?: string;
  saveSession: (url: string | null) => Promise<void>;
  onProgress?: (percent: number) => void;
  request?: typeof fetch;
}): Promise<DriveUploadResult> {
  if (!blob.size) throw new Error('A gravação está vazia.');
  const mime = blob.type.split(';')[0] || 'video/webm';
  const headers = { Authorization: `Bearer ${token}` };
  const check = (response: Response) => {
    if (response.status === 401) throw new Error('Renove a conexão com o Google Drive e tente novamente.');
    if (!response.ok && response.status !== 308) throw new Error(`Envio ao Google Drive interrompido (${response.status}). A gravação permanece no computador.`);
  };
  const offsetFrom = (response: Response) => {
    const range = response.headers.get('Range');
    if (!range) return 0;
    const match = /^bytes=0-(\d+)$/.exec(range);
    const offset = match ? Number(match[1]) + 1 : NaN;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > blob.size) throw new Error('Resposta de upload inválida.');
    return offset;
  };
  const probe = (url: string) => request(url, { method: 'PUT', headers: { ...headers, 'Content-Range': `bytes */${blob.size}` }, body: new Blob(), signal: AbortSignal.timeout(60000) });
  let offset = 0;
  if (sessionUrl) {
    const parsed = new URL(sessionUrl);
    if (parsed.origin !== 'https://www.googleapis.com' || !parsed.pathname.startsWith('/upload/drive/')) throw new Error('Sessão de upload inválida.');
    const status = await probe(sessionUrl);
    if (status.ok) { await saveSession(null); return status.json(); }
    if ([404, 410].includes(status.status)) sessionUrl = undefined;
    else { check(status); offset = offsetFrom(status); }
  }
  if (!sessionUrl) {
    const start = await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink', {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(blob.size) },
      body: JSON.stringify(metadata), signal: AbortSignal.timeout(60000),
    });
    check(start);
    sessionUrl = start.headers.get('Location') || undefined;
    if (!sessionUrl) throw new Error('O Google Drive não retornou uma sessão de upload.');
    const parsed = new URL(sessionUrl);
    if (parsed.origin !== 'https://www.googleapis.com' || !parsed.pathname.startsWith('/upload/drive/')) throw new Error('Sessão de upload inválida.');
    await saveSession(sessionUrl);
  }
  let failures = 0;
  while (offset < blob.size) {
    const end = Math.min(offset + CHUNK_SIZE, blob.size);
    let response: Response;
    try {
      response = await request(sessionUrl, {
        method: 'PUT', headers: { ...headers, 'Content-Type': mime, 'Content-Range': `bytes ${offset}-${end - 1}/${blob.size}` },
        body: blob.slice(offset, end), signal: AbortSignal.timeout(120000),
      });
      if (response.status === 429 || response.status >= 500) throw new Error('Conexão temporariamente indisponível.');
    } catch (error) {
      if (++failures > 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * failures));
      response = await probe(sessionUrl);
    }
    check(response);
    if (response.ok) {
      const result = await response.json();
      await saveSession(null);
      onProgress?.(100);
      return result;
    }
    const next = offsetFrom(response);
    if (next <= offset) {
      if (++failures > 3) throw new Error('O envio não avançou. Tente novamente; o vídeo está salvo localmente.');
    } else failures = 0;
    offset = next;
    onProgress?.(Math.floor(offset / blob.size * 100));
  }
  const completed = await probe(sessionUrl);
  check(completed);
  if (!completed.ok) throw new Error('O Google Drive ainda não confirmou o vídeo. Tente novamente.');
  const result = await completed.json();
  await saveSession(null);
  onProgress?.(100);
  return result;
}
