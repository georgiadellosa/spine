import { withFreshToken } from '../auth.js';
import { getCalendarId, getSheetId } from '../store.js';
import { getRows } from '../google-sheets.js';
import { icon } from '../icons.js';

const API = 'https://www.googleapis.com/calendar/v3';
const VISIBILITY_KEY = 'spine.calendarVisibility';

let fcInstance = null;
let allCalendars = [];

export async function render(view) {
  view.innerHTML = `
    <h1>Calendar</h1>
    <p class="subtitle">Drag a priority below onto a slot. Tap any time to add or edit.</p>

    <div id="this-weeks-priorities"></div>

    <div class="cal-toolbar" id="cal-toolbar">
      <button data-view="dayGridMonth">Month</button>
      <button data-view="timeGridWeek" class="active">Week</button>
      <button data-view="timeGridDay">Day</button>
    </div>

    <div id="cal-visibility"></div>

    <div id="calendar-loading" class="center" style="padding: 40px 0;"><div class="spinner"></div></div>
    <div id="calendar" class="card" style="display: none; padding: 12px;"></div>
  `;

  await waitForFullCalendar();
  await renderPrioritiesAsCards();
  allCalendars = await listCalendars();
  renderVisibilityToggles();

  document.getElementById('calendar-loading').style.display = 'none';
  document.getElementById('calendar').style.display = 'block';

  const visibility = getVisibility();

  fcInstance = new FullCalendar.Calendar(document.getElementById('calendar'), {
    initialView: 'timeGridWeek',
    height: 620,
    nowIndicator: true,
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    editable: true,
    droppable: true,
    slotMinTime: '07:00:00',
    slotMaxTime: '22:00:00',
    expandRows: true,
    eventSources: allCalendars.filter(c => visibility[c.id] !== false).map(makeSource),
    dateClick: async (info) => {
      const title = prompt('New event title?');
      if (!title) return;
      const start = info.date;
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      try {
        await createEvent(getCalendarId(), title, start, end);
        fcInstance.refetchEvents();
      } catch (err) { alert(`Couldn't create: ${err.message}`); }
    },
    eventClick: async (info) => {
      const calId = info.event.extendedProps.calendarId;
      const evId = info.event.id;
      const newTitle = prompt('Edit title (empty = delete, cancel = nothing):', info.event.title);
      if (newTitle === null) return;
      try {
        if (newTitle === '') {
          if (confirm('Delete this event?')) {
            await deleteEvent(calId, evId);
            fcInstance.refetchEvents();
          }
        } else {
          await updateEvent(calId, evId, { summary: newTitle });
          fcInstance.refetchEvents();
        }
      } catch (err) { alert(`Failed: ${err.message}`); }
    },
    eventDrop: async (info) => {
      const calId = info.event.extendedProps.calendarId;
      try {
        await updateEvent(calId, info.event.id, {
          start: { dateTime: info.event.start.toISOString() },
          end: { dateTime: info.event.end.toISOString() }
        });
      } catch (err) { info.revert(); alert(`Move failed: ${err.message}`); }
    },
    eventResize: async (info) => {
      const calId = info.event.extendedProps.calendarId;
      try {
        await updateEvent(calId, info.event.id, {
          start: { dateTime: info.event.start.toISOString() },
          end: { dateTime: info.event.end.toISOString() }
        });
      } catch { info.revert(); }
    },
    drop: async (info) => {
      const text = info.draggedEl.dataset.priority;
      if (!text) return;
      const start = info.date;
      const end = new Date(start.getTime() + 90 * 60 * 1000);
      const conflict = await hasConflict(start, end);
      if (conflict && !confirm(`That slot conflicts with "${conflict}". Schedule anyway?`)) return;
      try {
        await createEvent(getCalendarId(), text, start, end);
        fcInstance.refetchEvents();
      } catch (err) { alert(`Couldn't create block: ${err.message}`); }
    }
  });
  fcInstance.render();

  view.querySelectorAll('#cal-toolbar button').forEach(b => {
    b.addEventListener('click', () => {
      view.querySelectorAll('#cal-toolbar button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      fcInstance.changeView(b.dataset.view);
    });
  });
}

function makeSource(cal) {
  return {
    id: cal.id,
    events: async (info, success, fail) => {
      try {
        const events = await fetchEvents(cal.id, info.startStr, info.endStr);
        success(events.map(e => ({
          id: e.id,
          title: e.summary || '(no title)',
          start: e.start.dateTime || e.start.date,
          end: e.end?.dateTime || e.end?.date,
          allDay: !e.start.dateTime,
          color: cal.backgroundColor || '#5b6e5a',
          extendedProps: { calendarId: cal.id }
        })));
      } catch (err) { fail(err); }
    }
  };
}

function getVisibility() {
  try {
    return JSON.parse(localStorage.getItem(VISIBILITY_KEY)) || {};
  } catch { return {}; }
}
function setVisibility(v) {
  localStorage.setItem(VISIBILITY_KEY, JSON.stringify(v));
}

function renderVisibilityToggles() {
  const wrap = document.getElementById('cal-visibility');
  const visibility = getVisibility();
  wrap.innerHTML = `
    <div class="card" style="margin-bottom: 16px;">
      <div class="eyebrow mb-2">Calendars</div>
      ${allCalendars.map(c => {
        const on = visibility[c.id] !== false;
        return `
          <div class="toggle-row" data-cal="${c.id}">
            <div class="toggle-label">
              <span class="swatch" style="background: ${c.backgroundColor || '#5b6e5a'}"></span>
              <span>${escHtml(c.summary)}</span>
            </div>
            <div class="switch ${on ? 'on' : ''}" data-cal="${c.id}"></div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  wrap.querySelectorAll('.switch').forEach(sw => {
    sw.addEventListener('click', () => {
      const calId = sw.dataset.cal;
      const v = getVisibility();
      const newOn = !(v[calId] !== false);
      v[calId] = newOn;
      setVisibility(v);
      sw.classList.toggle('on', newOn);
      // Rebuild sources
      if (fcInstance) {
        fcInstance.removeAllEventSources();
        allCalendars.filter(c => v[c.id] !== false).forEach(c => fcInstance.addEventSource(makeSource(c)));
      }
    });
  });
}

async function hasConflict(start, end) {
  try {
    const visibility = getVisibility();
    const visibleCals = allCalendars.filter(c => visibility[c.id] !== false);
    for (const cal of visibleCals) {
      const events = await fetchEvents(cal.id, start.toISOString(), end.toISOString());
      const real = events.filter(e => e.start.dateTime); // skip all-day
      if (real.length > 0) return real[0].summary || '(busy)';
    }
  } catch {}
  return null;
}

async function waitForFullCalendar() {
  return new Promise(resolve => {
    const check = () => {
      if (window.FullCalendar) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

async function renderPrioritiesAsCards() {
  try {
    const sheetId = getSheetId();
    const rows = await getRows(sheetId, 'Weekly Priorities');
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const ms = monday.toISOString().slice(0, 10);
    const week = rows.slice(1).filter(r => r[0] === ms);
    const wrap = document.getElementById('this-weeks-priorities');
    if (week.length === 0) {
      wrap.innerHTML = `
        <div class="card warm" style="text-align: center;">
          <p style="margin: 0;">No priorities set for this week. <a href="#/sunday" class="link">Run Sunday Decision →</a></p>
        </div>`;
      return;
    }
    wrap.innerHTML = `
      <div class="eyebrow mb-2">This week — drag onto calendar</div>
      <div id="drag-zone" class="row mb-4" style="flex-wrap: wrap; gap: 8px;">
        ${week.map(r => `
          <div class="priority-drag" data-priority="${escAttr(r[2])}">
            <strong>${escHtml(r[1])}:</strong> ${escHtml(r[2])}
          </div>
        `).join('')}
      </div>
    `;
    if (window.FullCalendar?.Draggable) {
      new FullCalendar.Draggable(document.getElementById('drag-zone'), {
        itemSelector: '.priority-drag',
        eventData: (el) => ({ title: el.dataset.priority, duration: '01:30' })
      });
    }
  } catch (err) {
    console.warn(err);
  }
}

async function listCalendars() {
  return withFreshToken(async (token) => {
    const res = await fetch(`${API}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    return (data.items || []).filter(c => !c.hidden);
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

async function updateEvent(calId, evId, patch) {
  return withFreshToken(async (token) => {
    const res = await fetch(`${API}/calendars/${encodeURIComponent(calId)}/events/${evId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

async function deleteEvent(calId, evId) {
  return withFreshToken(async (token) => {
    const res = await fetch(`${API}/calendars/${encodeURIComponent(calId)}/events/${evId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok && res.status !== 410) throw new Error(await res.text());
  });
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
