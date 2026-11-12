import React, { type FormEvent, useState } from 'react';
import { accountRequest, Session } from './session.js';

interface AccountProps {
  session: Session | null;
  notice: string;
  onChange: (session: Session | null, notice: string) => void;
}

export default function Account({ session, notice, onChange }: AccountProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const register = mode === 'register';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      if (register) {
        await accountRequest('register', data);
        form.reset();
        setMode('login');
        onChange(null, 'Cuenta creada. Ya puedes iniciar sesión.');
      } else {
        const next = await Session.login(data);
        setEmail('');
        onChange(next, 'Has iniciado sesión.');
      }
    } catch (cause) {
      setError(cause instanceof TypeError ? 'No se pudo conectar con el servidor.' :
        cause instanceof Error ? cause.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      await session.logout();
      onChange(null, 'Has cerrado la sesión.');
    } catch {
      onChange(null, 'Se ha cerrado la sesión en esta pestaña. El servidor no ha confirmado el cierre.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="report-form account" aria-labelledby="account-heading">
      <h2 id="account-heading">{session ? 'Tu sesión' : register ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
      {notice && !error && <p role="status">{notice}</p>}
      {session ? (
        <button className="location-button" disabled={busy} onClick={logout}>Cerrar sesión</button>
      ) : (
        <form key={mode} onSubmit={submit}>
          {register && <div className="field"><label htmlFor="account-name">Nombre</label>
            <input id="account-name" name="displayName" autoComplete="name" required /></div>}
          <div className="field"><label htmlFor="account-email">Correo electrónico</label>
            <input id="account-email" name="email" type="email" autoComplete="username" maxLength={254}
              value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <div className="field"><label htmlFor="account-password">Contraseña</label>
            <input id="account-password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'}
              required aria-describedby={register ? 'password-help' : undefined} />
            {register && <p id="password-help" className="field-help">Entre 12 y 128 caracteres.</p>}</div>
          {register && <div className="field"><label htmlFor="account-confirm">Confirmar contraseña</label>
            <input id="account-confirm" name="confirmPassword" type="password" autoComplete="new-password" required /></div>}
          {error && <p className="error-banner" role="alert">{error}</p>}
          <div className="account-actions">
            <button className="submit-button" disabled={busy}>{register ? 'Crear cuenta' : 'Iniciar sesión'}</button>
            <button className="location-button" type="button" disabled={busy} onClick={() => {
              setMode(register ? 'login' : 'register');
              setError('');
              onChange(null, '');
            }}>{register ? 'Ya tengo cuenta' : 'Crear una cuenta'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
