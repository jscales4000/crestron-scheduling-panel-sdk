import type { Meeting, RoomState, ScheduleProvider } from './types';

// Talks to scheduling-backend, which implements the same ScheduleProvider
// contract server-side (memory or Google Calendar). Base URL comes from
// public/config.json — empty string means same-origin (the backend serves
// this app's dist/ in production).

const POLL_MS = 10_000;

export function createHttpProvider(baseUrl: string): ScheduleProvider {
  const base = baseUrl.replace(/\/$/, '');

  async function call<T>(path: string, body?: object): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `Backend error ${res.status}`);
    return data as T;
  }

  return {
    getRoomState: () => call<RoomState>('/api/state'),
    reserveNow: (minutes, title) => call<Meeting>('/api/reserve', { minutes, title }),
    endCurrent: () => call<void>('/api/end', {}),
    extendCurrent: (minutes) => call<Meeting>('/api/extend', { minutes }),
    checkIn: () => call<void>('/api/checkin', {}),
    onChange(cb: () => void): () => void {
      const t = setInterval(cb, POLL_MS);
      return () => clearInterval(t);
    }
  };
}
