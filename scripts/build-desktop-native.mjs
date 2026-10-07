import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
if (process.platform !== 'darwin') throw new Error('O helper de permissões é exclusivo do macOS.');
const root = new URL('../', import.meta.url).pathname;
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'daniloom-permissions-'));
try {
  const plist = path.join(temp, 'Info.plist');
  await fs.writeFile(plist, `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>dev.daniilo.daniloom.permissions</string><key>CFBundleName</key><string>Daniloom</string><key>NSAudioCaptureUsageDescription</key><string>O Daniloom grava o áudio dos aplicativos junto com a tela.</string><key>NSScreenCaptureUsageDescription</key><string>O Daniloom grava a tela ou janela que você selecionar.</string></dict></plist>`);
  execFileSync('xcrun', ['swiftc', '-O', '-target', 'arm64-apple-macos14.2', path.join(root, 'desktop/permissions-helper.swift'), '-o', path.join(root, 'assets/permissions-helper'), '-Xlinker', '-sectcreate', '-Xlinker', '__TEXT', '-Xlinker', '__info_plist', '-Xlinker', plist], { stdio: 'inherit' });
  execFileSync('codesign', ['--force', '--sign', '-', '--identifier', 'dev.daniilo.daniloom.permissions', path.join(root, 'assets/permissions-helper')], { stdio: 'inherit' });
} finally { await fs.rm(temp, { recursive: true, force: true }); }
console.log('Helper nativo de permissões compilado.');
