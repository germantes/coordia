import { afterEach, expect, it, vi } from 'vitest';
import { Session, SessionExpired } from '../src/session.js';

function token(sid: string, revision: number) {
  return `header.${btoa(JSON.stringify({ sid, revision }))}.signature`;
}

function openSession(initial: string) {
  const data = new Map([['coordia.accessToken', initial]]);
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  const session = Session.restore();
  if (!session) throw new Error('Missing test session');
  return session;
}

afterEach(() => vi.unstubAllGlobals());

it('renews concurrent protected requests with one refresh and retries with the new token', async () => {
  const original = token('session-a', 1);
  const renewed = token('session-a', 2);
  const session = openSession(original);
  let refreshes = 0;
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    if (url.endsWith('/refresh')) {
      refreshes++;
      expect(init.credentials).toBe('include');
      return Response.json({ accessToken: renewed });
    }
    const bearer = new Headers(init.headers).get('Authorization');
    return new Response(null, { status: bearer === `Bearer ${renewed}` ? 200 : 401 });
  });

  const responses = await Promise.all([session.request('/one', {}), session.request('/two', {})]);
  expect(responses.map((response) => response.status)).toEqual([200, 200]);
  expect(refreshes).toBe(1);
  expect(sessionStorage.getItem('coordia.accessToken')).toBe(renewed);
});

it('never retries a request as an account signed in from another tab', async () => {
  const session = openSession(token('session-a', 1));
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(new URL(url).pathname);
    return url.endsWith('/refresh') ? Response.json({ accessToken: token('session-b', 1) })
      : new Response(null, { status: 401 });
  });

  await expect(session.request('/reports', {})).rejects.toBeInstanceOf(SessionExpired);
  expect(calls).toEqual(['/reports', '/api/auth/refresh']);
});

it('clears the local credential even when the server cannot confirm logout', async () => {
  const session = openSession(token('session-a', 1));
  vi.stubGlobal('fetch', async () => Response.json({ error: 'Servicio no disponible' }, { status: 503 }));
  await expect(session.logout()).rejects.toThrow('Servicio no disponible');
  expect(sessionStorage.getItem('coordia.accessToken')).toBeNull();
  await expect(session.request('/reports', {})).rejects.toBeInstanceOf(SessionExpired);
});
