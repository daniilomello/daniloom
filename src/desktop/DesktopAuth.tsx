import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';
import { useAppTheme } from '../hooks/useAppTheme';

export function DesktopAuth() {
  useAppTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const params = new URLSearchParams(window.location.search);
  const state = params.get('state') || '';
  const port = params.get('port');
  const scope = params.get('scope');
  const valid = /^[a-f0-9]{64}$/.test(state) && port === '47831' && ['drive', 'youtube'].includes(scope || '');

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope(scope === 'youtube' ? 'https://www.googleapis.com/auth/youtube.upload' : 'https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) throw new Error('O Google não retornou a autorização. Tente novamente.');
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `http://127.0.0.1:${port}/desktop-auth/callback`;
      for (const [name, value] of Object.entries({ state, accessToken: credential.accessToken })) {
        const input = document.createElement('input');
        input.type = 'hidden'; input.name = name; input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível conectar.');
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-app text-fg flex items-center justify-center px-7">
      <div className="ds-glass rounded-2xl p-8 max-w-md w-full space-y-5">
        <Logo className="w-40 h-auto" />
        <h1 className="text-xl font-semibold">Conectar o Daniloom Desktop</h1>
        <p className="text-sm text-fg-muted">Autorize sua conta Google para acessar os mesmos projetos e vídeos no desktop e no navegador.</p>
        {valid ? <Button size="lg" disabled={busy} onClick={connect}>{busy ? 'Conectando…' : 'Conectar com Google'}</Button> : <p className="text-sm text-danger-fg">Abra esta conexão pelo botão de login do Daniloom Desktop.</p>}
        {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
        <p className="text-xs text-fg-muted">Mantenha o app desktop aberto durante a autorização.</p>
      </div>
    </main>
  );
}
