import { readable, writable, get } from 'svelte/store';
import type { RoomState, ScheduleProvider } from '../data/types';
import { createMockProvider } from '../data/mockProvider';
import { createHttpProvider } from '../data/httpProvider';

// Schedule state pipeline: provider → roomState store → UI. The provider is
// chosen at startup from public/config.json:
//   "schedule": { "source": "mock" | "http", "backendUrl": "" }
// backendUrl "" with source "http" = same-origin (backend serves this app).

let provider: ScheduleProvider = createMockProvider();

export const roomState = writable<RoomState>({
  status: 'available',
  current: null,
  next: null,
  today: []
});

export const lastError = writable<string | null>(null);
export const dataSource = writable<'mock' | 'http'>('mock');

export const clock = readable(Date.now(), (set) => {
  const t = setInterval(() => set(Date.now()), 1000);
  return () => clearInterval(t);
});

async function refresh(): Promise<void> {
  try {
    roomState.set(await provider.getRoomState(Date.now()));
  } catch (err) {
    lastError.set(err instanceof Error ? err.message : String(err));
  }
}

export function initSchedule(): void {
  void (async () => {
    try {
      const res = await fetch('./config.json');
      const cfg = await res.json();
      if (cfg?.schedule?.source === 'http') {
        provider = createHttpProvider(cfg.schedule.backendUrl ?? '');
        dataSource.set('http');
      }
    } catch {
      // No/invalid config.json — stay on the mock provider.
    }
    await refresh();
    provider.onChange(refresh);
    // Meetings start/end on time boundaries even with no user interaction.
    setInterval(refresh, 15_000);
  })();
}

async function run(action: () => Promise<unknown>): Promise<void> {
  lastError.set(null);
  try {
    await action();
    await refresh();
  } catch (err) {
    lastError.set(err instanceof Error ? err.message : String(err));
  }
}

export const reserveNow = (minutes: number) => run(() => provider.reserveNow(minutes));
export const endCurrent = () => run(() => provider.endCurrent());
export const extendCurrent = (minutes: number) => run(() => provider.extendCurrent(minutes));
export const checkIn = () => run(() => provider.checkIn());

export function isBusy(): boolean {
  return get(roomState).current !== null;
}
