import type { Meeting, RoomState, ScheduleProvider } from './types.js';
import { deriveState } from './types.js';

// In-memory provider mirroring the panel's mock: lets the full panel → backend
// path run before Google credentials exist.

const MIN = 60_000;
let seq = 0;
const id = () => `mem-${++seq}`;

export function createMemoryProvider(): ScheduleProvider {
  const now = Date.now();
  const meetings: Meeting[] = [
    {
      id: id(),
      title: 'Design Sync',
      organizer: 'Jordan A.',
      start: now - 20 * MIN,
      end: now + 25 * MIN,
      isPrivate: false,
      checkedIn: true
    },
    {
      id: id(),
      title: 'Vendor Demo — AV Refresh',
      organizer: 'Sam Ortiz',
      start: now + 55 * MIN,
      end: now + 115 * MIN,
      isPrivate: false,
      checkedIn: false
    }
  ];

  const currentAt = (t: number) => meetings.find((m) => m.start <= t && t < m.end) ?? null;
  const nextAt = (t: number) =>
    [...meetings].sort((a, b) => a.start - b.start).find((m) => m.start > t) ?? null;

  return {
    async getRoomState(t: number): Promise<RoomState> {
      return deriveState(meetings, t);
    },

    async reserveNow(minutes: number, title = 'Walk-up Reservation'): Promise<Meeting> {
      const t = Date.now();
      if (currentAt(t)) throw new Error('Room is already in use');
      const next = nextAt(t);
      const end = Math.min(t + minutes * MIN, next ? next.start : Infinity);
      if (end - t < 5 * MIN) throw new Error('Not enough time before the next meeting');
      const meeting: Meeting = {
        id: id(),
        title,
        organizer: 'Panel',
        start: t,
        end,
        isPrivate: false,
        checkedIn: true
      };
      meetings.push(meeting);
      return meeting;
    },

    async endCurrent(): Promise<void> {
      const current = currentAt(Date.now());
      if (!current) throw new Error('No meeting in progress');
      current.end = Date.now();
    },

    async extendCurrent(minutes: number): Promise<Meeting> {
      const t = Date.now();
      const current = currentAt(t);
      if (!current) throw new Error('No meeting in progress');
      const next = nextAt(t);
      const proposed = current.end + minutes * MIN;
      if (next && proposed > next.start) throw new Error('Extension collides with next meeting');
      current.end = proposed;
      return current;
    },

    async checkIn(): Promise<void> {
      const current = currentAt(Date.now());
      if (!current) throw new Error('No meeting in progress');
      current.checkedIn = true;
    }
  };
}
