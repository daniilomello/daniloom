/**
 * Serviço e utilitários otimizados para integração com a API v3 do Google Drive.
 * Inclui boas práticas de resiliência (tentativas com backoff exponencial),
 * sanitização de buscas, upload multipart/related e tratamento robusto de erros.
 */

export interface DriveFileMetadata {
  id: string;
  name?: string;
  mimeType?: string;
  parents?: string[];
  webViewLink?: string;
  modifiedTime?: string;
  createdTime?: string;
  size?: string;
}

export interface DriveProjectClipData {
  id: string;
  name: string;
  duration: number;
  createdAt: string | Date;
  googleDriveFileId?: string;
  format?: "landscape" | "portrait" | "square";
}

export interface DriveProjectMetadata {
  updatedAt: string;
  exportConfig?: any;
  scenes?: any;
  settings?: any;
  clips: DriveProjectClipData[];
}

/**
 * Escapa caracteres especiais em consultas da API do Google Drive para evitar erros de sintaxe.
 */
export const escapeDriveQuery = (value: string): string => {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
};

/**
 * Erro lançado quando o token de acesso do Google Drive expira (HTTP 401).
 * Permite interceptação limpa e renovação com 1 clique pela interface.
 */
export class DriveAuthExpiredError extends Error {
  isDriveTokenExpired = true;
  statusCode = 401;
  constructor(
    message = "Sua autorização do Google Drive expirou. Clique em 'Renovar' no topo para restabelecer a conexão sem sair da sua conta.",
  ) {
    super(message);
    this.name = "DriveAuthExpiredError";
  }
}

type TokenRefreshCallback = () => Promise<string | null>;
let tokenRefreshHandler: TokenRefreshCallback | null = null;
let isRefreshingPromise: Promise<string | null> | null = null;

/**
 * Registra uma função para renovação do token quando o interceptor capturar HTTP 401.
 */
export const setDriveTokenRefreshHandler = (
  handler: TokenRefreshCallback | null,
) => {
  tokenRefreshHandler = handler;
};

/**
 * Utilitário de requisição com tentativas automáticas, backoff exponencial e interceptor de 401.
 */
export const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries = 3,
  delayMs = 1000,
): Promise<Response> => {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      // Interceptor de erro 401 (Token Expirado)
      if (response.status === 401) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("daniloom_drive_401_detected", {
              detail: { url, timestamp: Date.now() },
            }),
          );
        }

        // Se houver manipulador de renovação registrado, tenta renovar e repetir uma vez
        if (tokenRefreshHandler && attempt === 0) {
          try {
            if (!isRefreshingPromise) {
              isRefreshingPromise = tokenRefreshHandler().finally(() => {
                isRefreshingPromise = null;
              });
            }
            const freshToken = await isRefreshingPromise;
            if (freshToken) {
              const updatedHeaders = new Headers(options.headers || {});
              updatedHeaders.set("Authorization", `Bearer ${freshToken}`);
              options = { ...options, headers: updatedHeaders };
              continue; // Tenta novamente com o token renovado
            }
          } catch (refreshErr) {
            console.warn(
              "Falha no interceptor ao renovar token de 401:",
              refreshErr,
            );
          }
        }
        return response;
      }

      // Se for erro de cliente definitivo (e.g. 404), não tenta novamente
      if (response.status === 404) {
        return response;
      }

      // Se for 429 (Too Many Requests) ou erro 5xx do servidor Google, tenta novamente com backoff
      if (response.status === 429 || response.status >= 500) {
        const backoff = delayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      return response;
    } catch (err) {
      lastError = err;
      const backoff = delayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw (
    lastError ||
    new Error(
      "Falha na comunicação com o Google Drive após múltiplas tentativas.",
    )
  );
};

/**
 * Constrói o corpo multipart/related para upload eficiente de metadados + binário num único payload HTTP.
 */
export const createMultipartBody = (
  metadata: Record<string, any>,
  fileBlob: Blob,
  boundary = "314159265358979323846",
): Blob => {
  const delimiter = `--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const isVideo = metadata.mimeType && metadata.mimeType.startsWith("video/");
  const blobType = isVideo
    ? "video/webm"
    : fileBlob.type || "application/octet-stream";

  const headerPart =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    "\r\n" +
    delimiter +
    `Content-Type: ${blobType}\r\n\r\n`;

  return new Blob([headerPart, fileBlob, closeDelimiter], {
    type: `multipart/related; boundary=${boundary}`,
  });
};

/**
 * Localiza ou cria a pasta raiz 'daniloom' no Google Drive.
 */
export const getOrCreateParentdaniloomFolder = async (
  activeToken: string,
): Promise<string> => {
  if (!activeToken) {
    throw new Error(
      "Token de acesso do Google Drive não encontrado. Faça login novamente com a sua conta Google.",
    );
  }

  let searchErrText = "";
  try {
    const query = encodeURIComponent(
      `name='daniloom' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    const searchRes = await fetchWithRetry(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${activeToken}` } },
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    } else {
      searchErrText = await searchRes.text();
      if (searchRes.status === 401) {
        throw new DriveAuthExpiredError();
      }
    }
  } catch (err: any) {
    if (
      err.isDriveTokenExpired ||
      err.message?.includes("401") ||
      err.message?.includes("expirou") ||
      err.message?.includes("sessão")
    ) {
      throw err;
    }
    console.warn(
      "Busca pela pasta raiz daniloom falhou, tentando criar...",
      err,
    );
  }

  let createErrText = "";
  try {
    const createRes = await fetchWithRetry(
      "https://www.googleapis.com/drive/v3/files",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "daniloom",
          mimeType: "application/vnd.google-apps.folder",
        }),
      },
    );
    if (createRes.ok) {
      const createData = await createRes.json();
      return createData.id;
    }
    createErrText = await createRes.text();
    if (createRes.status === 401) {
      throw new DriveAuthExpiredError();
    }
  } catch (err: any) {
    if (
      err.isDriveTokenExpired ||
      err.message?.includes("401") ||
      err.message?.includes("expirou") ||
      err.message?.includes("sessão")
    ) {
      throw err;
    }
    console.error("Erro ao criar pasta raiz daniloom:", err);
  }

  throw new Error(
    `Não foi possível criar ou localizar a pasta raiz 'daniloom' no Google Drive. Detalhes: ${createErrText || searchErrText || "Verifique o acesso à conta."}`,
  );
};

/**
 * Cria ou recupera a pasta de projeto específica dentro da pasta raiz 'daniloom'.
 */
export const getOrCreateActiveProjectFolder = async (
  activeToken: string,
  existingFolderId?: string | null,
): Promise<string> => {
  if (existingFolderId) {
    try {
      const res = await fetchWithRetry(
        `https://www.googleapis.com/drive/v3/files/${existingFolderId}?fields=id`,
        {
          headers: { Authorization: `Bearer ${activeToken}` },
        },
      );
      if (res.ok) return existingFolderId;
    } catch (_) {}
  }

  const savedFolderId = localStorage.getItem("daniloom_gdrive_folder_id");
  if (savedFolderId) {
    try {
      const res = await fetchWithRetry(
        `https://www.googleapis.com/drive/v3/files/${savedFolderId}?fields=id`,
        {
          headers: { Authorization: `Bearer ${activeToken}` },
        },
      );
      if (res.ok) {
        return savedFolderId;
      }
    } catch (_) {}
  }

  const parentId = await getOrCreateParentdaniloomFolder(activeToken);

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const formattedDate = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const folderName = `Projeto - ${formattedDate}`;

  return await createGoogleDriveFolder(activeToken, folderName, parentId);
};

/**
 * Cria uma nova pasta no Google Drive sob um parentId.
 */
export const createGoogleDriveFolder = async (
  activeToken: string,
  folderName: string,
  parentId: string,
): Promise<string> => {
  const createRes = await fetchWithRetry(
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${activeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    },
  );
  if (!createRes.ok) {
    throw new Error(`Falha ao criar pasta "${folderName}" no Google Drive.`);
  }
  const createData = await createRes.json();
  return createData.id;
};

/**
 * Faz upload multipart de um arquivo (vídeo, json, txt) para o Google Drive.
 */
export const uploadFileToDrive = async (
  activeToken: string,
  metadata: { name: string; mimeType?: string; parents?: string[] },
  blob: Blob,
): Promise<{ id: string; name: string; webViewLink?: string }> => {
  const boundary = "314159265358979323846";
  const multipartBody = createMultipartBody(metadata, blob, boundary);

  const uploadRes = await fetchWithRetry(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${activeToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    },
  );

  if (!uploadRes.ok) {
    if (uploadRes.status === 401) {
      throw new DriveAuthExpiredError();
    }
    const errText = await uploadRes.text();
    throw new Error(
      `Falha no envio do arquivo "${metadata.name}" ao Google Drive: ` +
        errText,
    );
  }

  return await uploadRes.json();
};

/**
 * Atualiza o conteúdo binário/mídia de um arquivo existente no Google Drive.
 */
export const updateFileMediaContent = async (
  activeToken: string,
  fileId: string,
  blob: Blob,
  contentType = "application/json",
): Promise<boolean> => {
  const updateRes = await fetchWithRetry(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${activeToken}`,
        "Content-Type": contentType,
      },
      body: blob,
    },
  );
  if (updateRes.status === 401) {
    throw new DriveAuthExpiredError();
  }
  return updateRes.ok;
};

/**
 * Exclui um arquivo do Google Drive por ID.
 */
export const deleteGoogleDriveFile = async (
  activeToken: string,
  fileId: string,
): Promise<boolean> => {
  try {
    const deleteRes = await fetchWithRetry(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${activeToken}` },
      },
    );
    return deleteRes.ok;
  } catch (e) {
    return false;
  }
};

/**
 * Configura permissão pública de leitura para um arquivo no Drive e retorna o link de visualização web.
 */
export const setDriveFilePublicPermission = async (
  activeToken: string,
  fileId: string,
): Promise<string | null> => {
  try {
    await fetchWithRetry(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone",
        }),
      },
    );
  } catch (permErr) {
    console.warn(
      "Não foi possível ajustar permissão pública do arquivo:",
      permErr,
    );
  }

  try {
    const metaRes = await fetchWithRetry(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,webViewLink`,
      {
        headers: { Authorization: `Bearer ${activeToken}` },
      },
    );

    if (metaRes.ok) {
      const finalMetadata = await metaRes.json();
      return (
        finalMetadata.webViewLink ||
        `https://drive.google.com/file/d/${fileId}/view`
      );
    }
  } catch (_) {}

  return `https://drive.google.com/file/d/${fileId}/view`;
};

/**
 * Baixa o conteúdo de um arquivo do Drive como Blob.
 */
export const downloadDriveFileAsBlob = async (
  activeToken: string,
  fileId: string,
): Promise<Blob> => {
  const fileRes = await fetchWithRetry(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${activeToken}` },
    },
  );
  if (!fileRes.ok) {
    if (fileRes.status === 401) {
      throw new DriveAuthExpiredError();
    }
    throw new Error(`Erro ao baixar o arquivo ID ${fileId} do Google Drive.`);
  }
  return await fileRes.blob();
};

/**
 * Baixa o conteúdo de um arquivo JSON do Drive.
 */
export const downloadDriveFileAsJson = async <T>(
  activeToken: string,
  fileId: string,
): Promise<T> => {
  const projectRes = await fetchWithRetry(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${activeToken}` },
    },
  );
  if (!projectRes.ok) {
    if (projectRes.status === 401) {
      throw new DriveAuthExpiredError();
    }
    throw new Error("Falha ao carregar arquivo JSON do Google Drive.");
  }
  return await projectRes.json();
};

/**
 * Baixa o conteúdo de um arquivo do Drive como texto.
 */
export const downloadDriveFileAsText = async (
  activeToken: string,
  fileId: string,
): Promise<string> => {
  const res = await fetchWithRetry(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${activeToken}` },
    },
  );
  if (!res.ok) {
    if (res.status === 401) {
      throw new DriveAuthExpiredError();
    }
    throw new Error(
      `Erro ao carregar o arquivo de texto ID ${fileId} do Google Drive.`,
    );
  }
  return await res.text();
};

/**
 * Busca o roteiro em Markdown ou TXT dentro de uma pasta de projeto no Drive.
 */
export const fetchProjectScriptFromDrive = async (
  activeToken: string,
  folderId: string,
): Promise<{ text: string; fileId: string | null; fileName: string }> => {
  const escapedFolderId = escapeDriveQuery(folderId);
  const query = encodeURIComponent(
    `(name='roteiro.md' or name='roteiro.txt') and '${escapedFolderId}' in parents and trashed=false`,
  );

  const searchRes = await fetchWithRetry(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${activeToken}` } },
  );

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      const file = data.files[0];
      const text = await downloadDriveFileAsText(activeToken, file.id);
      return { text, fileId: file.id, fileName: file.name };
    }
  }

  return { text: "", fileId: null, fileName: "roteiro.md" };
};

/**
 * Salva ou atualiza o arquivo roteiro.md na pasta do projeto no Google Drive.
 */
export const saveProjectMarkdownScript = async (
  activeToken: string,
  folderId: string,
  markdownText: string,
): Promise<string> => {
  const scriptBlob = new Blob([markdownText], {
    type: "text/markdown; charset=utf-8",
  });
  const escapedFolderId = escapeDriveQuery(folderId);
  const query = encodeURIComponent(
    `(name='roteiro.md' or name='roteiro.txt') and '${escapedFolderId}' in parents and trashed=false`,
  );

  let fileId: string | null = null;
  const searchRes = await fetchWithRetry(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${activeToken}` } },
  );

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      fileId = data.files[0].id;
    }
  }

  if (fileId) {
    await updateFileMediaContent(
      activeToken,
      fileId,
      scriptBlob,
      "text/markdown; charset=utf-8",
    );
    return fileId;
  } else {
    const newFile = await uploadFileToDrive(
      activeToken,
      { name: "roteiro.md", parents: [folderId], mimeType: "text/markdown" },
      scriptBlob,
    );
    return newFile.id;
  }
};

/**
 * Salva ou atualiza o arquivo roteiro.txt no Google Drive (tanto na pasta 'daniloom' quanto na pasta do projeto).
 */
export const saveScriptToDrive = async (
  activeToken: string,
  text: string,
  parentFolderId: string,
  projectFolderId?: string,
): Promise<void> => {
  const scriptBlob = new Blob([text], { type: "text/plain; charset=utf-8" });

  const syncToFolder = async (folderId: string) => {
    let scriptFileId: string | null = null;
    const escapedFolderId = escapeDriveQuery(folderId);
    const query = encodeURIComponent(
      `name='roteiro.txt' and '${escapedFolderId}' in parents and trashed=false`,
    );

    const searchRes = await fetchWithRetry(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${activeToken}` } },
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        scriptFileId = data.files[0].id;
      }
    }

    if (scriptFileId) {
      await updateFileMediaContent(
        activeToken,
        scriptFileId,
        scriptBlob,
        "text/plain; charset=utf-8",
      );
    } else {
      await uploadFileToDrive(
        activeToken,
        { name: "roteiro.txt", parents: [folderId], mimeType: "text/plain" },
        scriptBlob,
      );
    }
  };

  try {
    await syncToFolder(parentFolderId);
    if (projectFolderId && projectFolderId !== parentFolderId) {
      await syncToFolder(projectFolderId);
    }
  } catch (err) {
    console.warn("Falha secundária ao sincronizar roteiro.txt:", err);
  }
};

/**
 * Lista todos os arquivos existentes dentro de uma pasta do Google Drive.
 */
export const listDriveFolderFiles = async (
  activeToken: string,
  folderId: string,
): Promise<DriveFileMetadata[]> => {
  const escapedFolderId = escapeDriveQuery(folderId);
  const q = encodeURIComponent(
    `'${escapedFolderId}' in parents and trashed=false`,
  );
  const fields = encodeURIComponent(
    "files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, thumbnailLink)",
  );

  const res = await fetchWithRetry(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=100&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${activeToken}` } },
  );

  if (!res.ok) {
    if (res.status === 401) {
      throw new DriveAuthExpiredError();
    }
    const errText = await res.text();
    throw new Error(
      "Erro ao listar arquivos da pasta do Google Drive: " + errText,
    );
  }

  const data = await res.json();
  return data.files || [];
};

/**
 * Lista todas as subpastas existentes dentro da pasta raiz 'daniloom'.
 */
export const listParentDriveSubfolders = async (
  activeToken: string,
): Promise<DriveFileMetadata[]> => {
  const parentId = await getOrCreateParentdaniloomFolder(activeToken);
  const escapedParentId = escapeDriveQuery(parentId);
  const q = encodeURIComponent(
    `'${escapedParentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const fields = encodeURIComponent(
    "files(id, name, createdTime, modifiedTime, webViewLink)",
  );

  const res = await fetchWithRetry(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=100&orderBy=name`,
    { headers: { Authorization: `Bearer ${activeToken}` } },
  );

  if (!res.ok) {
    if (res.status === 401) {
      throw new DriveAuthExpiredError();
    }
    const errText = await res.text();
    throw new Error("Erro ao listar subpastas do Google Drive: " + errText);
  }

  const data = await res.json();
  return data.files || [];
};

/**
 * Renomeia um arquivo ou pasta no Google Drive.
 */
export const renameGoogleDriveFile = async (
  activeToken: string,
  fileId: string,
  newName: string,
): Promise<boolean> => {
  const res = await fetchWithRetry(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${activeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    },
  );
  return res.ok;
};

/**
 * Helper para formatar bytes em KB, MB ou GB.
 */
export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return "0 MB";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i === 0) return `${bytes} B`;
  return `${(bytes / Math.pow(k, i)).toFixed(i >= 3 ? 2 : 1)} ${sizes[i]}`;
};

/**
 * Calcula o tamanho ocupado por cada pasta de projeto e o tamanho total da pasta daniloom no Google Drive.
 */
export const fetchDriveFolderSizes = async (
  activeToken: string,
  projectFolderIds: string[],
): Promise<{
  projectSizes: Record<string, number>;
  totalDaniloomSize: number;
}> => {
  const parentId = await getOrCreateParentdaniloomFolder(activeToken);
  const projectSizes: Record<string, number> = {};
  let totalDaniloomSize = 0;

  // Busca o tamanho dos arquivos contidos em cada pasta de projeto
  await Promise.all(
    projectFolderIds.map(async (folderId) => {
      try {
        const escapedId = escapeDriveQuery(folderId);
        const q = encodeURIComponent(
          `'${escapedId}' in parents and trashed=false`,
        );
        const res = await fetchWithRetry(
          `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,size,mimeType)&pageSize=1000`,
          { headers: { Authorization: `Bearer ${activeToken}` } },
        );
        if (res.ok) {
          const data = await res.json();
          const files = data.files || [];
          const folderTotal = files.reduce(
            (acc: number, f: any) => acc + (parseInt(f.size || "0", 10) || 0),
            0,
          );
          projectSizes[folderId] = folderTotal;
        } else {
          projectSizes[folderId] = 0;
        }
      } catch (err) {
        console.warn(`Erro ao calcular tamanho da pasta ${folderId}:`, err);
        projectSizes[folderId] = 0;
      }
    }),
  );

  // Também busca arquivos colocados diretamente na raiz 'daniloom' (ex: roteiros soltos)
  try {
    const escapedParentId = escapeDriveQuery(parentId);
    const q = encodeURIComponent(
      `'${escapedParentId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
    );
    const res = await fetchWithRetry(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,size)&pageSize=1000`,
      { headers: { Authorization: `Bearer ${activeToken}` } },
    );
    if (res.ok) {
      const data = await res.json();
      const files = data.files || [];
      const rootFilesTotal = files.reduce(
        (acc: number, f: any) => acc + (parseInt(f.size || "0", 10) || 0),
        0,
      );
      totalDaniloomSize += rootFilesTotal;
    }
  } catch (err) {
    console.warn("Erro ao obter tamanho de arquivos na raiz daniloom:", err);
  }

  // Somatório final das pastas dos projetos
  Object.values(projectSizes).forEach((size) => {
    totalDaniloomSize += size;
  });

  return { projectSizes, totalDaniloomSize };
};
