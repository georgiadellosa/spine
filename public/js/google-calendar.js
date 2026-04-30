import { withFreshToken } from './auth.js';

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
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const nextMonday = nextDayOfWeek(today, 1);
    const nextSunday = nextDayOfWeek(today, 0);
    const nextFriday = nextDayOfWeek(today, 5);
    const events = [
      {
        summary: 'Daily Check-in',
        description: 'Morning ritual: capacity + priority + free time',
        start: { dateTime: setTime(nextMonday, 7, 0).toISOString(), timeZone: tz },
        end: { dateTime: setTime(nextMonday, 7, 5).toISOString(), timeZone: tz },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR']
      },
      {
        summary: 'Sunday Decision',
        description: 'Brain dump → triage → pick three priorities for the week',
        start: { dateTime: setTime(nextSunday, 19, 0).toISOString(), timeZone: tz },
        end: { dateTime: setTime(nextSunday, 19, 30).toISOString(), timeZone: tz },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SU']
      },
      {
        summary: 'Friday Close',
        description: 'Weekly close: shipped, stuck, moves',
        start: { dateTime: setTime(nextFriday, 17, 0).toISOString(), timeZone: tz },
        end: { dateTime: setTime(nextFriday, 17, 20).toISOString(), timeZone: tz },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=FR']
      }
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

function setTime(date, h, m) {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function nextDayOfWeek(from, dow) {
  const d = new Date(from);
  const diff = (dow - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}
