// Server-side mirror of the panel's ScheduleProvider contract
// (scheduling-panel/src/lib/data/types.ts). Keep the two in sync.

export interface Meeting {
  id: string;
  title: string;
  organizer: string;
  start: number;
  end: number;
  isPrivate: boolean;
  checkedIn: boolean;
}

export type RoomStatus = 'available' | 'reserved' | 'checkin-pending';

export interface RoomState {
  status: RoomStatus;
  current: Meeting | null;
  next: Meeting | null;
  today: Meeting[];
}

export interface ScheduleProvider {
  getRoomState(now: number): Promise<RoomState>;
  reserveNow(minutes: number, title?: string): Promise<Meeting>;
  endCurrent(): Promise<void>;
  extendCurrent(minutes: number): Promise<Meeting>;
  checkIn(): Promise<void>;
}

export function deriveState(meetings: Meeting[], now: number): RoomState {
  const sorted = [...meetings].sort((a, b) => a.start - b.start);
  const current = sorted.find((m) => m.start <= now && now < m.end) ?? null;
  const next = sorted.find((m) => m.start > now) ?? null;
  let status: RoomStatus = 'available';
  if (current) status = current.checkedIn ? 'reserved' : 'checkin-pending';
  return { status, current, next, today: sorted.filter((m) => m.end > now) };
}
