import type { Meeting, RoomState, ScheduleProvider } from './types';

// In-memory provider that seeds a plausible business day around "now" so the
// panel demos every state: a meeting in progress, a gap, and upcoming blocks.

const MIN = 60_000;
let seq = 0;
const id = () => `mock-${++seq}`;

function seedDay(now: number): Meeting[] {
  return [
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
    },
    {
      id: id(),
      title: 'Private Appointment',
      organizer: 'HR',
      start: now + 150 * MIN,
      end: now + 180 * MIN,
      isPrivate: true,
      checkedIn: false
    }
  ];
}

export function createMockProvider(): ScheduleProvider {
  let meetings = seedDay(Date.now());
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((cb) => cb());

  const sorted = () => [...meetings].sort((a, b) => a.start - b.start);
  const currentAt = (now: number) =>
    sorted().find((m) => m.start <= now && now < m.end) ?? null;
  const nextAt = (now: number) => sorted().find((m) => m.start > now) ?? null;

  return {
    async getRoomState(now: number): Promise<RoomState> {
      const current = currentAt(now);
      const next = nextAt(now);
      let status: RoomState['status'] = 'available';
      if (current) {
        status = current.checkedIn ? 'reserved' : 'checkin-pending';
      }
      return {
        status,
        current,
        next,
        today: sorted().filter((m) => m.end > now)
      };
    },

    async reserveNow(minutes: number, title = 'Walk-up Reservation'): Promise<Meeting> {
      const now = Date.now();
      if (currentAt(now)) throw new Error('Room is already in use');
      const next = nextAt(now);
      const end = Math.min(now + minutes * MIN, next ? next.start : Infinity);
      if (end - now < 5 * MIN) throw new Error('Not enough time before the next meeting');
      const meeting: Meeting = {
        id: id(),
        title,
        organizer: 'Panel',
        start: now,
        end,
        isPrivate: false,
        checkedIn: true
      };
      meetings.push(meeting);
      notify();
      return meeting;
    },

    async endCurrent(): Promise<void> {
      const now = Date.now();
      const current = currentAt(now);
      if (!current) throw new Error('No meeting in progress');
      current.end = now;
      notify();
    },

    async extendCurrent(minutes: number): Promise<Meeting> {
      const now = Date.now();
      const current = currentAt(now);
      if (!current) throw new Error('No meeting in progress');
      const next = nextAt(now);
      const proposed = current.end + minutes * MIN;
      if (next && proposed > next.start) throw new Error('Extension collides with next meeting');
      current.end = proposed;
      notify();
      return current;
    },

    async checkIn(): Promise<void> {
      const current = currentAt(Date.now());
      if (!current) throw new Error('No meeting in progress');
      current.checkedIn = true;
      notify();
    },

    onChange(cb: () => void): () => void {
      listeners.add(cb);
      return () => listeners.delete(cb);
    }
  };
}
