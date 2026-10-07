export interface YouTubeUploadParams {
  title: string;
  description: string;
  privacyStatus?: "public" | "unlisted" | "private";
  publishAt?: string; // RFC 3339 format, e.g. 2026-10-08T15:00:00Z
  blob: Blob;
  accessToken: string;
  onProgress?: (progress: number) => void;
}

// Upload custom thumbnail to YouTube video
export const uploadThumbnailToYouTube = async ({
  videoId,
  thumbnailBlob,
  accessToken,
}: {
  videoId: string;
  thumbnailBlob: Blob;
  accessToken: string;
}): Promise<boolean> => {
  const mimeType = thumbnailBlob.type || "image/jpeg";
  const res = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": mimeType,
      },
      body: thumbnailBlob,
    },
  );

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.warn("YouTube thumbnail upload failed:", res.status, errorBody);
    throw new Error(
      "Não foi possível aplicar a miniatura personalizada. Verifique se o seu canal possui a verificação de número de telefone ativada no YouTube Studio.",
    );
  }
  return true;
};

// Helper: Create multipart/related request body with raw binary data
const createMultipartBody = (
  metadata: any,
  fileBlob: Blob,
  boundary: string,
): Blob => {
  const delimiter = `--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const blobType = fileBlob.type || "video/mp4";

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

export const uploadVideoToYouTube = async ({
  title,
  description,
  privacyStatus = "unlisted",
  publishAt,
  blob,
  accessToken,
  onProgress,
}: YouTubeUploadParams): Promise<{ id: string; url: string }> => {
  const metadata: any = {
    snippet: {
      title,
      description,
      categoryId: "22",
    },
    status: {
      privacyStatus: publishAt ? "private" : privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  };

  if (publishAt) {
    metadata.status.publishAt = publishAt;
  }

  // Attempt 1: Resumable Upload
  try {
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": blob.type || "video/mp4",
          "X-Upload-Content-Length": String(blob.size),
        },
        body: JSON.stringify(metadata),
      },
    );

    const uploadUrl =
      initRes.headers.get("Location") ||
      initRes.headers.get("location") ||
      initRes.headers.get("x-goog-upload-url");

    if (initRes.ok && uploadUrl) {
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", blob.type || "video/mp4");

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              onProgress(e.loaded / e.total);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resData = JSON.parse(xhr.responseText);
              const videoId = resData.id;
              resolve({
                id: videoId,
                url: `https://www.youtube.com/watch?v=${videoId}`,
              });
            } catch (e) {
              reject(new Error("Erro ao interpretar resposta do YouTube."));
            }
          } else {
            reject(
              new Error(
                `Erro ao enviar arquivo para o YouTube (${xhr.status}): ${xhr.statusText || xhr.responseText}`,
              ),
            );
          }
        };

        xhr.onerror = () =>
          reject(new Error("Erro de rede durante o envio para o YouTube."));
        xhr.send(blob);
      });
    }
  } catch (resumableErr) {
    console.warn("Resumable upload initialization skipped or failed, trying multipart fallback:", resumableErr);
  }

  // Attempt 2: Direct Multipart Upload (Guaranteed fallback with progress)
  const boundary = `daniloom_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const multipartBody = createMultipartBody(metadata, blob, boundary);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
      true,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader(
      "Content-Type",
      `multipart/related; boundary=${boundary}`,
    );

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded / e.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resData = JSON.parse(xhr.responseText);
          const videoId = resData.id;
          resolve({
            id: videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
          });
        } catch (e) {
          reject(new Error("Erro ao interpretar resposta da API do YouTube."));
        }
      } else {
        let msg = `Erro ao enviar arquivo (${xhr.status}): ${xhr.statusText}`;
        try {
          const errObj = JSON.parse(xhr.responseText);
          if (errObj?.error?.message) {
            msg = errObj.error.message;
          }
        } catch (e) {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () =>
      reject(new Error("Erro de conexão ao enviar vídeo para o YouTube."));
    xhr.send(multipartBody);
  });
};
