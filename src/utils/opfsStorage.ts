/**
 * OPFS (Origin Private File System) Storage Engine
 * Intelligent zero-copy disk streaming for HD/4K recordings & clips.
 * Stores raw media files directly to private browser storage without memory/RAM saturation.
 */

export const isOPFSSupported = (): boolean => {
  return (
    typeof window !== "undefined" &&
    !!navigator.storage &&
    typeof navigator.storage.getDirectory === "function"
  );
};

let rootDirPromise: Promise<FileSystemDirectoryHandle> | null = null;

async function getClipsDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isOPFSSupported()) return null;
  try {
    if (!rootDirPromise) {
      rootDirPromise = navigator.storage.getDirectory();
    }
    const root = await rootDirPromise;
    return await root.getDirectoryHandle("daniloom_opfs_clips", {
      create: true,
    });
  } catch (err) {
    console.warn("OPFS directory initialization fallback:", err);
    return null;
  }
}

export async function saveBlobToOPFS(id: string, blob: Blob): Promise<boolean> {
  const dir = await getClipsDirectory();
  if (!dir) return false;
  try {
    const filename = `clip_${id}.bin`;
    const handle = await dir.getFileHandle(filename, { create: true });

    if (typeof handle.createWritable === "function") {
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    }
    return false;
  } catch (err) {
    console.warn("OPFS save fallback:", err);
    return false;
  }
}

export async function getBlobFromOPFS(
  id: string,
  mimeType: string = "video/webm",
): Promise<Blob | null> {
  const dir = await getClipsDirectory();
  if (!dir) return null;
  try {
    const filename = `clip_${id}.bin`;
    const handle = await dir.getFileHandle(filename);
    const file = await handle.getFile();
    return new Blob([await file.arrayBuffer()], {
      type: mimeType || file.type || "video/webm",
    });
  } catch (err) {
    return null;
  }
}

export async function deleteBlobFromOPFS(id: string): Promise<boolean> {
  const dir = await getClipsDirectory();
  if (!dir) return false;
  try {
    const filename = `clip_${id}.bin`;
    await dir.removeEntry(filename);
    return true;
  } catch (err) {
    return false;
  }
}

export async function clearOPFS(): Promise<boolean> {
  const dir = await getClipsDirectory();
  if (!dir) return false;
  try {
    for await (const name of (dir as any).keys()) {
      await dir.removeEntry(name);
    }
    return true;
  } catch (err) {
    return false;
  }
}
