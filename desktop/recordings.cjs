const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');

class RecordingStore {
  constructor(directory) {
    this.directory = directory;
    this.sessions = new Map();
  }

  async organizeLegacy() {
    await fs.mkdir(this.directory, { recursive: true });
    for (const entry of await fs.readdir(this.directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^Daniloom-.*\.(mp4|webm)$/.test(entry.name)) continue;
      const destination = path.join(this.directory, 'Gravações anteriores');
      await fs.mkdir(destination, { recursive: true });
      // Linking first prevents overwriting an existing recording with the same name.
      try {
        await fs.link(path.join(this.directory, entry.name), path.join(destination, entry.name));
        await fs.unlink(path.join(this.directory, entry.name));
      } catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
  }

  async projectDirectory(project) {
    await fs.mkdir(this.directory, { recursive: true });
    if (!project || typeof project.id !== 'string' || !project.id.trim()) {
      return path.join(this.directory, 'Sem projeto');
    }
    const suffix = '--' + createHash('sha256').update(project.id).digest('hex').slice(0, 20);
    const existing = (await fs.readdir(this.directory, { withFileTypes: true })).find(entry => entry.isDirectory() && entry.name.endsWith(suffix));
    if (existing) return path.join(this.directory, existing.name);
    let name = (typeof project.name === 'string' ? project.name : 'Projeto').normalize('NFKC').replace(/[\/\\:*?"<>|\x00-\x1f\x7f]/g, '-').replace(/^[.\s]+|[.\s]+$/g, '') || 'Projeto';
    while (Buffer.byteLength(name, 'utf8') > 160) name = Array.from(name).slice(0, -1).join('');
    return path.join(this.directory, name + suffix);
  }

  async begin(mimeType, project) {
    if (this.sessions.size) throw new Error('Uma gravação já está em andamento.');
    const directory = await this.projectDirectory(project);
    await fs.mkdir(directory, { recursive: true });
    const id = randomUUID();
    const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const name = `Daniloom-${new Date().toISOString().replace(/[:.]/g, '-')}-${id.slice(0, 8)}`;
    const partial = path.join(directory, `${name}.partial.${extension}`);
    const final = path.join(directory, `${name}.${extension}`);
    const file = await fs.open(partial, 'wx');
    this.sessions.set(id, { file, partial, final, queue: Promise.resolve(), size: 0 });
    return id;
  }

  append(id, bytes) {
    const session = this.sessions.get(id);
    if (!session) throw new Error('Gravação desconhecida.');
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength > 64 * 1024 * 1024) {
      throw new Error('Bloco de gravação inválido.');
    }
    session.queue = session.queue.then(async () => {
      const buffer = Buffer.from(bytes);
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesWritten } = await session.file.write(buffer, offset, buffer.length - offset);
        if (!bytesWritten) throw new Error('Não foi possível escrever a gravação.');
        offset += bytesWritten;
      }
      session.size += buffer.length;
      await session.file.datasync();
    });
    return session.queue;
  }

  async finish(id, discard = false) {
    const session = this.sessions.get(id);
    if (!session) throw new Error('Gravação desconhecida.');
    try {
      await session.queue;
      await session.file.close();
      if (discard || !session.size) {
        await fs.unlink(session.partial);
        return null;
      }
      await fs.rename(session.partial, session.final);
      return session.final;
    } finally {
      await session.file.close().catch(() => {});
      this.sessions.delete(id);
    }
  }

  async close() {
    await Promise.allSettled([...this.sessions.values()].map(async (session) => {
      await session.queue.catch(() => {});
      await session.file.close();
    }));
    this.sessions.clear();
  }
}
module.exports = { RecordingStore };
