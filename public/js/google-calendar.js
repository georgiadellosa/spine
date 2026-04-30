import { withFreshToken } from './auth.js';
import { getRitualTimes } from './store.js';

const API = 'https://www.googleapis.com/calendar/v3';

export async function createSpineCalendar() {
  return withFreshToken(async (token) => {
    const res = await fetch(`${API}/calendars`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: 'Spine',
        description: 'Spine app rituals and priority blocks',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    });
    if (!res.ok) throw new Error(`Calendar: ${await res.text()}`);
    const cal = await res.json();
    await fetch(`${API}/users/me/calendarList/${cal.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ colorId: '10' })
    }).catch(() => {});
    return cal.id;
  });
}

export async function createRecurringRituals(calendarId) {
  return withFreshToken(async (token) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const times = getRitualTimes();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const events = [
      ritualEvent('Daily Check-in', 'Morning ritual: capacity + priority + free time', nextDayOfWeek(today, 1), times.daily, 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', tz),
      ritualEvent('Sunday Decision', 'Brain dump → triage → pick three priorities for the week', nextDayOfWeek(today, 0), times.sunday, 'RRULE:FREQ=WEEKLY;BYDAY=SU', tz),
      ritualEvent('Friday Close', 'Weekly close: shipped, stuck, moves', nextDayOfWeek(today, 5), times.friday, 'RRULE:FREQ=WEEKLY;BYDAY=FR', tz)
    ];
    for (const ev of events) {
      const res = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(ev)
      });
      if (!res.ok) console.error(`Ritual ${ev.summary}: ${await res.text()}`);
    }
  });
}

function ritualEvent(summary, description, day, times, rrule, tz) {
  const start = new Date(day); start.setHours(times.hour, times.min, 0, 0);
  const end = new Date(start.getTime() + times.duration * 60 * 1000);
  return {
    summary, description,
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    recurrence: [rrule]
  };
}

export async function findRitualEventIds(calendarId) {
  return withFreshToken(async (token) => {
    const today = new Date();
    const fortnightAgo = new Date(today); fortnightAgo.setDate(today.getDate() - 14);
    const fortnightAhead = new Date(today); fortnightAhead.setDate(today.getDate() + 14);
    const url = `${API}/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${fortnightAgo.toISOString()}&timeMax=${fortnightAhead.toISOString()}&singleEvents=false&maxResults=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return {};
    const data = await res.json();
    const map = {};
    for (const e of data.items || []) {
      if (!e.recurrence) continue;
      if (e.summary === 'Daily Check-in') map.daily = e.id;
      else if (e.summary === 'Sunday Decision') map.sunday = e.id;
      else if (e.summary === 'Friday Close') map.friday = e.id;
    }
    return map;
  });
}

export async function deleteRitualEvents(calendarId, ids) {
  return withFreshToken(async (token) => {
    for (const id of Object.values(ids)) {
      if (!id) continue;
      await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  });
}

export async function rebuildRituals(calendarId) {
  const existing = await findRitualEventIds(calendarId);
  await deleteRitualEvents(calendarId, existing);
  await createRecurringRituals(calendarId);
}

export async function createPriorityBlock(calendarId, title, durationMins = 90) {
  return withFreshToken(async (token) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    if (start < new Date()) {
      start.setDate(start.getDate() + 1);
      start.setHours(9, 0, 0, 0);
    }
    const end = new Date(start.getTime() + durationMins * 60 * 1000);
    const res = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: title,
        start: { dateTime: start.toISOString(), timeZone: tz },
        end: { dateTime: end.toISOString(), timeZone: tz },
        colorId: '2'
      })
    });
    if (!res.ok) throw new Error(`Priority block: ${await res.text()}`);
    return res.json();
  });
}

export async function getTodayBusyMinutes(calendarIds = ['primary']) {
  return withFreshToken(async (token) => {
    const today = new Date(); today.setHours(8, 0, 0, 0);
    const eod = new Date(); eod.setHours(18, 0, 0, 0);
    const res = await fetch(`${API}/freeBusy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: today.toISOString(),
        timeMax: eod.toISOString(),
        items: calendarIds.map(id => ({ id }))
      })
    });
    if (!res.ok) return 600;
    const data = await res.json();
    let busy = 0;
    Object.values(data.calendars || {}).forEach(cal => {
      (cal.busy || []).forEach(b => {
        busy += (new Date(b.end) - new Date(b.start)) / 60000;
      });
    });
    const totalWindow = (eod - today) / 60000;
    return Math.max(0, totalWindow - busy);
  });
}

export async function getEventsForDate(calendarId, date) {
  return withFreshToken(async (token) => {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    const url = `${API}/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  });
}

export async function listCalendars() {
  return withFreshToken(async (token) => {
    const res = await fetch(`${API}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).filter(c => !c.hidden);
  });
}

function nextDayOfWeek(from, dow) {
  const d = new Date(from);
  const diff = (dow - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}
