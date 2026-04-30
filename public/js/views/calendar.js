import { withFreshToken } from '../auth.js';
import { getCalendarId, getSheetId } from '../store.js';
import { getRows } from '../google-sheets.js';

const API = 'https://www.googleapis.com/calendar/v3';

export async function render(view) {
  view.innerHTML = `
    <h1>Calendar</h1>
    <div id="cal-toolbar" style="display: flex; gap: 8px; margin-bottom: 12px;">
      <button class="btn btn-ghost" data-view="dayGridMonth" style="height: 40px; padding: 0 16px;">Month</button>
      <button class="btn btn-ghost" data-view="timeGridWeek" style="height: 40px; padding: 0 16px;">Week</button>
      <button class="btn btn-ghost" data-view="timeGridDay" style="height: 40px; padding: 0 16px;">Day</button>
    </div>
    <div id="this-weeks-priorities"></div>
    <div id="calendar-loading"><div class="spinner"></div></div>
    <div id="calendar" style="background: var(--bg-elev); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px; display: none;"></div>
    <p class="muted" style="font-size: 13px; margin-top: 12px;">
      Drag a priority above onto a time slot to schedule it. Tap an empty slot to add an event. Tap an event to edit or delete.
    </p>
  `;

  await waitForFullCalendar();
  await renderPrioritiesAsCards();
  const calendars = await listCalendars();

  document.getElementById('calendar-loading').style.display = 'none';
  document.getElementById('calendar').style.display = 'block';

  const fc = new FullCalendar.Calendar(document.getElementById('calendar'), {
    initialView: 'timeGridWeek',
    height: 600,
    nowIndicator: true,
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    editable: true,
    droppable: true,
    slotMinTime: '07:00:00',
    slotMaxTime: '22:00:00',
    eventSources: calendars.map(cal => ({
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
    })),
    dateClick: async (info) => {
      const title = prompt('New event title?');
      if (!title) return;
      const start = info.date;
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      try {
        await createEvent(getCalendarId(), title, start, end);
        fc.refetchEvents();
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
            fc.refetchEvents();
          }
        } else {
          await updateEvent(calId, evId, { summary: newTitle });
          fc.refetchEvents();
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
      } catch (err) {
        info.revert();
        alert(`Move failed: ${err.message}`);
      }
    },
    eventResize: async (info) => {
      const calId = info.event.extendedProps.calendarId;
      try {
        await updateEvent(calId, info.event.id, {
          start: { dateTime: info.event.start.toISOString() },
          end: { dateTime: info.event.end.toISOString() }
        });
      } catch (err) {
        info.revert();
      }
    },
    drop: async (info) => {
      const text = info.draggedEl.dataset.priority;
      if (!text) return;
      const start = info.date;
      const end = new Date(start.getTime() + 90 * 60 * 1000);
      try {
        await createEvent(getCalendarId(), text, start, end);
        fc.refetchEvents();
      } catch (err) { alert(`Couldn't create block: ${err.message}`); }
    }
  });
  fc.render();

  view.querySelectorAll('button[data-view]').forEach(b => {
    b.addEventListener('click', () => fc.changeView(b.dataset.view));
  });
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
      wrap.innerHTML = `<p class="muted" style="margin-bottom: 16px;">No priorities for this week yet — <a href="#/sunday" style="color: var(--accent);">run Sunday Decision</a>.</p>`;
      return;
    }
    wrap.innerHTML = `
      <p class="muted" style="margin-bottom: 8px;">This week's priorities (drag onto calendar):</p>
      <div id="drag-zone" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
        ${week.map(r => `
          <div class="priority-drag" data-priority="${escAttr(r[2])}"
               style="padding: 10px 14px; background: var(--accent-soft); border-radius: 999px; font-size: 14px; cursor: grab; user-select: none;">
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
    const spineId = getCalendarId();
    return (data.items || []).filter(c => c.selected !== false || c.id === spineId);
  });
}

async function fetchEvents(calId, timeMin, timeMax) {
  return withFreshToken(async (token) => {
    const url = `${API}/calendars/${encodeURIComponent(calId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`;
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
