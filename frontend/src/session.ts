export const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const storageKey = 'coordia.accessToken';
const expired = 'La sesión ha caducado. Vuelve a iniciar sesión.';

async function errorMessage(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body === 'object' && body !== null) {
    if ('fields' in body && typeof body.fields === 'object' && body.fields !== null) {
      const fields = Object.values(body.fields).filter((value) => typeof value === 'string');
      if (fields.length) return fields.join(' ');
    }
    if ('error' in body && typeof body.error === 'string') return body.error;
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}

export async function accountRequest(path: 'login' | 'register', data: FormData) {
  const response = await fetch(`${apiBase}/api/auth/${path}`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(data)),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response;
}

async function readToken(response: Response) {
  const body: unknown = await response.json();
  if (body && typeof body === 'object' && 'accessToken' in body && typeof body.accessToken === 'string' && body.accessToken) {
    return body.accessToken;
  }
  throw new Error('El servidor no ha devuelto la sesión.');
}

// A refresh cookie is shared across tabs. Only accept a renewed token for this session.
function sessionId(token: string) {
  try {
    const payload: unknown = JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')));
    return payload && typeof payload === 'object' && 'sid' in payload && typeof payload.sid === 'string' ? payload.sid : null;
  } catch {
    return null;
  }
}

export class Session {
  private refreshRequest?: Promise<string>;
  private closed = false;

  private constructor(private token: string) {}

  static restore() {
    const token = sessionStorage.getItem(storageKey);
    return token ? new Session(token) : null;
  }

  static async login(data: FormData) {
    const token = await readToken(await accountRequest('login', data));
    sessionStorage.setItem(storageKey, token);
    return new Session(token);
  }

  private async renew() {
    const response = await fetch(`${apiBase}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (response.status === 401) throw new SessionExpired(expired);
    if (!response.ok) throw new Error(await errorMessage(response));
    const next = await readToken(response);
    const sid = sessionId(this.token);
    if (this.closed || !sid || sessionId(next) !== sid) throw new SessionExpired(expired);
    sessionStorage.setItem(storageKey, next);
    this.token = next;
    return next;
  }

  async request(path: string, init: RequestInit) {
    if (this.closed) throw new SessionExpired(expired);
    const send = (token: string) => {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return fetch(`${apiBase}${path}`, { ...init, headers });
    };
    const first = this.token;
    const response = await send(first);
    if (response.status !== 401) return response;
    if (this.closed) throw new SessionExpired(expired);
    if (this.token === first) {
      this.refreshRequest ??= this.renew().finally(() => { this.refreshRequest = undefined; });
      await this.refreshRequest;
    }
    if (this.closed) throw new SessionExpired(expired);
    const retry = await send(this.token);
    if (retry.status === 401) throw new SessionExpired(expired);
    return retry;
  }

  async logout() {
    try {
      const response = await this.request('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error(await errorMessage(response));
    } finally {
      this.clear();
    }
  }

  clear() {
    this.closed = true;
    if (sessionStorage.getItem(storageKey) === this.token) sessionStorage.removeItem(storageKey);
  }
}

export class SessionExpired extends Error {}
