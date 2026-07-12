// Domain types for the scheduling panel. Providers (mock today, Google
// Calendar later) all speak in these shapes so the UI never changes when
// the backend does.

export interface Meeting {
  id: string;
  title: string;
  organizer: string;
  /** Epoch ms */
  start: number;
  /** Epoch ms */
  end: number;
  isPrivate: boolean;
  checkedIn: boolean;
}

export type RoomStatus = 'available' | 'reserved' | 'checkin-pending';

export interface RoomState {
  status: RoomStatus;
  current: Meeting | null;
  next: Meeting | null;
  /** Today's remaining meetings, sorted by start, including current */
  today: Meeting[];
}

export interface ScheduleProvider {
  /** Snapshot of room state as of `now` */
  getRoomState(now: number): Promise<RoomState>;
  /** Ad-hoc booking starting now. Rejects if it would overlap. */
  reserveNow(minutes: number, title?: string): Promise<Meeting>;
  /** End the current meeting early */
  endCurrent(): Promise<void>;
  /** Extend the current meeting. Rejects if it would overlap the next. */
  extendCurrent(minutes: number): Promise<Meeting>;
  /** Confirm occupancy for the current meeting */
  checkIn(): Promise<void>;
  /** Notify on any data change so the UI can re-pull state */
  onChange(cb: () => void): () => void;
}
