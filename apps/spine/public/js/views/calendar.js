// TwoNests-style week calendar — single week at a time, day cards stacked,
// events as compact chips. No FullCalendar dependency.
import { withFreshToken } from '../auth.js';
import { getCalendarId, getSheetId } from '../store.js';
import { getRows } from '../google-sheets.js';
import { listCalendars } from '../google-calendar.js';
import { icon } from '../icons.js';
import { confirmDialog, alertDialog } from '../dialog.js';
import { eventModal } from '../event-modal.js';

const API = 'https://www.googleapis.com/calendar/v3';
const VISIBILITY_KEY = 'spine.calendarVisibility';
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

let weekStart = startOfWeek(new Date());
let allCalendars = [];
let calendarColorMap = {};
let weekEvents = [];
let priorities = [];

export async function render(view) {
  weekStart = startOfWeek(new Date());
  view.innerHTML = `
    <div class="cal-week-header">
      <button class="cal-nav-btn" id="cal-prev" aria-label="Previous week">‹</button>
      <div class="cal-range" id="cal-range">Loading…</div>
      <button class="cal-nav-btn" id="cal-next" aria-label="Next week">›</button>
    </div>
    <div class="row" style="justify-content: center; margin-top: 4px; margin-bottom: 16px;">
      <button class="link" id="cal-today" style="background: none; border: none; cursor: pointer; font-size: 13px; padding: 4px 12px;">Today</button>
    </div>

    <div id="cal-priorities"></div>
    <div id="cal-content"><div class="spinner" style="margin: 40px auto;"></div></div>

    <details class="card" style="margin-top: 16px; padding: 0;" id="cal-toggles">
      <summary style="padding: 14px 18px; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center;">
        <span class="eyebrow" style="margin: 0;">Calendar visibility</span>
        <span class="muted">▾</span>
      </summary>
      <div id="cal-toggles-list" style="padding: 0 18px 16px;"></div>
    </details>
  `;

  document.getElementById('cal-prev').addEventListener('click', () => {
    weekStart = addDays(weekStart, -7);
    refresh();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    weekStart = addDays(weekStart, 7);
    refresh();
  });
  document.getElementById('cal-today').addEventListener('click', () => {
    weekStart = startOfWeek(new Date());
    refresh();
  });

  allCalendars = await listCalendars();
  calendarColorMap = Object.fromEntries(allCalendars.map(c => [c.id, c.backgroundColor || '#5b6e5a']));
  renderToggles();
  await loadPriorities();
  await refresh();
}

function getVisibility() {
  try { return JSON.parse(localStorage.getItem(VISIBILITY_KEY)) || {}; } catch { return {}; }
}
function setVisibility(v) { localStorage.setItem(VISIBILITY_KEY, JSON.stringify(v)); }

function renderToggles() {
  const visibility = getVisibility();
  document.getElementById('cal-toggles-list').innerHTML = allCalendars.map(c => {
    const on = visibility[c.id] !== false;
    return `
      <div class="toggle-row" data-cal="${escAttr(c.id)}">
        <div class="toggle-label">
          <span class="swatch" style="background: ${escAttr(c.backgroundColor || '#5b6e5a')}"></span>
          <span>${escHtml(c.summary)}</span>
        </div>
        <div class="switch ${on ? 'on' : ''}" data-cal="${escAttr(c.id)}"></div>
      </div>
    `;
  }).join('');
  document.querySelectorAll('#cal-toggles-list .switch').forEach(sw => {
    sw.addEventListener('click', () => {
      const calId = sw.dataset.cal;
      const v = getVisibility();
      v[calId] = !(v[calId] !== false);
      setVisibility(v);
      sw.classList.toggle('on', v[calId]);
      refresh();
    });
  });
}

async function loadPriorities() {
  try {
    const sheetId = getSheetId();
    const rows = await getRows(sheetId, 'Weekly Priorities');
    const monday = startOfWeek(new Date());
    const ms = isoDate(monday);
    priorities = rows.slice(1).filter(r => r[0] === ms);
    renderPrioritiesBar();
  } catch {}
}

function renderPrioritiesBar() {
  const wrap = document.getElementById('cal-priorities');
  if (priorities.length === 0) {
    wrap.innerHTML = `<div class="card warm" style="padding: 12px 14px; text-align: center; margin-bottom: 16px;">
      <span style="font-size: 13px;">No priorities for this week. <a href="#/sunday" class="link">Run Sunday Decision →</a></span>
    </div>`;
    return;
  }
  wrap.innerHTML = `
    <div class="eyebrow mb-2">This week's priorities — tap a day to schedule</div>
    <div class="row mb-4" style="flex-wrap: wrap; gap: 8px;">
      ${priorities.map(r => `
        <div class="priority-pill" data-priority="${escAttr(r[2])}">
          <strong>${escHtml(r[1])}:</strong> ${escHtml(r[2])}
        </div>
      `).join('')}
    </div>
  `;
}

async function refresh() {
  const end = addDays(weekStart, 7);
  document.getElementById('cal-range').textContent = formatRange(weekStart, addDays(weekStart, 6));
  document.getElementById('cal-content').innerHTML = `<div class="spinner" style="margin: 40px auto;"></div>`;
  try {
    const visibility = getVisibility();
    const visible = allCalendars.filter(c => visibility[c.id] !== false);
    const eventsByCal = await Promise.all(visible.map(c =>
      fetchEvents(c.id, weekStart.toISOString(), end.toISOString()).then(events => ({ cal: c, events }))
    ));
    weekEvents = [];
    eventsByCal.forEach(({ cal, events }) => {
      events.forEach(e => weekEvents.push({ event: e, calendar: cal }));
    });
    renderWeek();
  } catch (err) {
    document.getElementById('cal-content').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function renderWeek() {
  const today = new Date(); today.setHours(0,0,0,0);
  const cards = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const dayEvents = weekEvents
      .filter(({ event }) => isOnDay(event, day))
      .sort((a, b) => eventStart(a.event) - eventStart(b.event));
    const isToday = day.getTime() === today.getTime();
    const isPast = day < today;

    cards.push(`
      <div class="day-card ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}" data-iso="${isoDate(day)}">
        <div class="day-card-header" data-add-day="${isoDate(day)}">
          <div>
            <div class="day-name">${DAY_NAMES[day.getDay()]}</div>
            <div class="day-date">${day.getDate()} ${day.toLocaleDateString(undefined, { month: 'short' })}</div>
          </div>
          <button class="day-add-btn" aria-label="Add event">+</button>
        </div>
        ${dayEvents.length === 0 ? `
          <div class="day-empty">Nothing scheduled</div>
        ` : `
          <div class="day-events">
            ${dayEvents.map(({ event, calendar }) => renderEventChip(event, calendar)).join('')}
          </div>
        `}
      </div>
    `);
  }
  document.getElementById('cal-content').innerHTML = cards.join('');

  // Day header → add event
  document.querySelectorAll('.day-card-header[data-add-day]').forEach(el => {
    el.addEventListener('click', () => addEventOnDay(el.dataset.addDay));
  });
  // Event chip → edit
  document.querySelectorAll('.event-chip[data-event-id]').forEach(el => {
    el.addEventListener('click', () => editEvent(el.dataset.calId, el.dataset.eventId));
  });

  // Make priority pills draggable to days (touch + mouse)
  setupDragDrop();
}

function renderEventChip(event, calendar) {
  const start = eventStart(event);
  const end = eventEnd(event);
  const allDay = !event.start.dateTime;
  const time = allDay
    ? 'All day'
    : `${formatTime(start)} – ${formatTime(end)}`;
  const color = calendar.backgroundColor || '#5b6e5a';
  return `
    <div class="event-chip" data-event-id="${escAttr(event.id)}" data-cal-id="${escAttr(calendar.id)}" style="--chip-color: ${escAttr(color)}">
      <div class="event-time">${time}</div>
      <div class="event-title">${escHtml(event.summary || '(no title)')}</div>
    </div>
  `;
}

async function addEventOnDay(isoDay) {
  const visibleCalIds = allCalendars.filter(c => getVisibility()[c.id] !== false).map(c => c.id);
  const writable = allCalendars.filter(c => visibleCalIds.includes(c.id));
  const start = new Date(`${isoDay}T09:00:00`);
  const end = new Date(`${isoDay}T10:00:00`);
  const result = await eventModal({
    defaultStart: start,
    defaultEnd: end,
    defaultCalendarId: getCalendarId() || writable[0]?.id,
    calendars: writable
  });
  if (!result) return;
  try {
    await createEvent(result.calendarId, result.title, result.start, result.end);
    await refresh();
  } catch (err) {
    await alertDialog({ title: 'Could not create event', message: err.message });
  }
}

async function editEvent(calId, eventId) {
  const entry = weekEvents.find(({ event, calendar }) => event.id === eventId && calendar.id === calId);
  if (!entry) return;
  const result = await eventModal({
    event: {
      title: entry.event.summary || '',
      start: eventStart(entry.event),
      end: eventEnd(entry.event),
      calendarId: calId
    },
    calendars: allCalendars
  });
  if (!result) return;
  try {
    if (result.delete) {
      const ok = await confirmDialog({ title: 'Delete this event?', confirmText: 'Delete', danger: true });
      if (!ok) return;
      await deleteEvent(calId, eventId);
    } else {
      // If calendar changed: delete and recreate (Google API doesn't support move)
      if (result.calendarId !== calId) {
        await createEvent(result.calendarId, result.title, result.start, result.end);
        await deleteEvent(calId, eventId);
      } else {
        await updateEvent(calId, eventId, {
          summary: result.title,
          start: { dateTime: result.start.toISOString() },
          end: { dateTime: result.end.toISOString() }
        });
      }
    }
    await refresh();
  } catch (err) {
    await alertDialog({ title: 'Failed', message: err.message });
  }
}

function setupDragDrop() {
  const pills = document.querySelectorAll('.priority-pill');
  const dayCards = document.querySelectorAll('.day-card');
  pills.forEach(pill => {
    pill.setAttribute('draggable', 'true');
    pill.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/priority', pill.dataset.priority);
      e.dataTransfer.effectAllowed = 'copy';
      pill.classList.add('dragging');
    });
    pill.addEventListener('dragend', () => pill.classList.remove('dragging'));
  });
  dayCards.forEach(card => {
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      card.classList.add('drop-target');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      card.classList.remove('drop-target');
      const text = e.dataTransfer.getData('text/priority');
      if (!text) return;
      const day = card.dataset.iso;
      const start = new Date(`${day}T09:00:00`);
      const end = new Date(start.getTime() + 90 * 60 * 1000);
      try {
        await createEvent(getCalendarId(), text, start, end);
        await refresh();
      } catch (err) {
        await alertDialog({ title: 'Could not schedule', message: err.message });
      }
    });
  });
}

async function fetchEvents(calId, timeMin, timeMax) {
  return withFreshToken(async (token) => {
    const url = `${API}/calendars/${encodeURIComponent(calId)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  });
}
async function createEvent(calId, title, start, end) {
  return withFreshToken(async (token) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch(`${API}/calendars/${encodeURIComponent(calId)}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: title,
        start: { dateTime: start.toISOString(), timeZone: tz },
        end: { dateTime: end.toISOString(), timeZone: tz }
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}
async function updateEvent(calId, eventId, patch) {
  return withFreshToken(async (token) => {
    const res = await fetch(`${API}/calendars/${encodeURIComponent(calId)}/events/${eventId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}
async function deleteEvent(calId, eventId) {
  return withFreshToken(async (token) => {
    const res = await fetch(`${API}/calendars/${encodeURIComponent(calId)}/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok && res.status !== 410) throw new Error(await res.text());
  });
}

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = (day + 6) % 7; // monday-start
  x.setDate(x.getDate() - diff);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function isoDate(d) { return d.toISOString().slice(0, 10); }
function eventStart(e) { return new Date(e.start.dateTime || e.start.date); }
function eventEnd(e) { return new Date(e.end?.dateTime || e.end?.date); }
function isOnDay(event, day) {
  const start = eventStart(event);
  const end = eventEnd(event);
  const dayEnd = addDays(day, 1);
  return start < dayEnd && end > day;
}
function formatTime(d) {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function formatRange(start, end) {
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString(undefined, { day: 'numeric', month: sameMonth ? undefined : 'short' });
  const endStr = end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: end.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
  return `${startStr} – ${endStr}`;
}
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
