import { JWT } from 'google-auth-library';
import type { Meeting, RoomState, ScheduleProvider } from './types.js';
import { deriveState } from './types.js';

// Google Calendar API v3 provider. Auth: service account whose email has
// "Make changes to events" on the room's resource calendar (see FRED doc
// "Google Calendar API — Panel Backend Reference").

const MIN = 60_000;
const API = 'https://www.googleapis.com/calendar/v3';
/** Serve panel reads from cache this long to keep API quota trivial */
const CACHE_MS = 10_000;

interface GcalEvent {
  id: string;
  summary?: string;
  status?: string;
  visibility?: string;
  organizer?: { email?: string; displayName?: string };
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

function toMeeting(e: GcalEvent): Meeting | null {
  const start = e.start?.dateTime ?? e.start?.date;
  const end = e.end?.dateTime ?? e.end?.date;
  if (!start || !end || e.status === 'cancelled') return null;
  return {
    id: e.id,
    title: e.summary ?? 'Reserved',
    organizer: e.organizer?.displayName ?? e.organizer?.email ?? '',
    start: Date.parse(start),
    end: Date.parse(end),
    isPrivate: e.visibility === 'private' || e.visibility === 'confidential',
    checkedIn: e.extendedProperties?.private?.checkedIn === 'true'
  };
}

export function createGoogleProvider(keyFile: string, calendarId: string): ScheduleProvider {
  const client = new JWT({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/calendar.events']
  });
  const calPath = `${API}/calendars/${encodeURIComponent(calendarId)}`;

  let cache: { at: number; meetings: Meeting[] } | null = null;

  async function fetchMeetings(force = false): Promise<Meeting[]> {
    const now = Date.now();
    if (!force && cache && now - cache.at < CACHE_MS) return cache.meetings;
    const res = await client.request<{ items?: GcalEvent[] }>({
      url: `${calPath}/events`,
      params: {
        timeMin: new Date(now - 12 * 60 * MIN).toISOString(),
        timeMax: new Date(now + 24 * 60 * MIN).toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50'
      }
    });
    const meetings = (res.data.items ?? [])
      .map(toMeeting)
      .filter((m): m is Meeting => m !== null);
    cache = { at: now, meetings };
    return meetings;
  }

  async function currentMeeting(): Promise<Meeting | null> {
    const now = Date.now();
    const meetings = await fetchMeetings(true);
    return meetings.find((m) => m.start <= now && now < m.end) ?? null;
  }

  async function patchEvent(eventId: string, body: object): Promise<GcalEvent> {
    const res = await client.request<GcalEvent>({
      url: `${calPath}/events/${encodeURIComponent(eventId)}`,
      method: 'PATCH',
      data: body
    });
    cache = null;
    return res.data;
  }

  return {
    async getRoomState(now: number): Promise<RoomState> {
      return deriveState(await fetchMeetings(), now);
    },

    async reserveNow(minutes: number, title = 'Walk-up Reservation'): Promise<Meeting> {
      const now = Date.now();
      const meetings = await fetchMeetings(true);
      const state = deriveState(meetings, now);
      if (state.current) throw new Error('Room is already in use');
      const end = Math.min(now + minutes * MIN, state.next ? state.next.start : Infinity);
      if (end - now < 5 * MIN) throw new Error('Not enough time before the next meeting');
      const res = await client.request<GcalEvent>({
        url: `${calPath}/events`,
        method: 'POST',
        data: {
          summary: title,
          start: { dateTime: new Date(now).toISOString() },
          end: { dateTime: new Date(end).toISOString() },
          extendedProperties: { private: { checkedIn: 'true', source: 'scheduling-panel' } }
        }
      });
      cache = null;
      const meeting = toMeeting(res.data);
      if (!meeting) throw new Error('Google returned an unusable event');
      return meeting;
    },

    async endCurrent(): Promise<void> {
      const current = await currentMeeting();
      if (!current) throw new Error('No meeting in progress');
      await patchEvent(current.id, { end: { dateTime: new Date().toISOString() } });
    },

    async extendCurrent(minutes: number): Promise<Meeting> {
      const now = Date.now();
      const meetings = await fetchMeetings(true);
      const state = deriveState(meetings, now);
      if (!state.current) throw new Error('No meeting in progress');
      const proposed = state.current.end + minutes * MIN;
      if (state.next && proposed > state.next.start) {
        throw new Error('Extension collides with next meeting');
      }
      const patched = await patchEvent(state.current.id, {
        end: { dateTime: new Date(proposed).toISOString() }
      });
      const meeting = toMeeting(patched);
      if (!meeting) throw new Error('Google returned an unusable event');
      return meeting;
    },

    async checkIn(): Promise<void> {
      const current = await currentMeeting();
      if (!current) throw new Error('No meeting in progress');
      await patchEvent(current.id, {
        extendedProperties: { private: { checkedIn: 'true' } }
      });
    }
  };
}
