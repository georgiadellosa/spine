import { appendRow, getRows } from '../google-sheets.js';
import { getTodayBusyMinutes, createPriorityBlock } from '../google-calendar.js';
import { shrinkPriority } from '../api.js';
import { getSheetId, getCalendarId, setLastCheckin } from '../store.js';

let state = {
  capacity: null,
  dayType: null,
  priority: '',
  freeTime: null,
  feels: ''
};

export async function render(view) {
  state = { capacity: null, dayType: null, priority: '', freeTime: null, feels: '' };

  view.innerHTML = `
    <h1>Morning</h1>
    <p class="muted">${formatToday()}</p>

    <div class="field">
      <label>Capacity right now</label>
      <div class="capacity-row" id="capacity">
        ${[1,2,3,4,5].map(n => `<button data-cap="${n}">${n}</button>`).join('')}
      </div>
      <p class="muted" style="font-size: 13px; margin-top: 6px;">1 = shutdown · 5 = high</p>
    </div>

    <div class="field">
      <label>Today is</label>
      <div class="day-type-row" id="day-type">
        <button data-type="Solo Day">Solo</button>
        <button data-type="Kid Day">Kid</button>
        <button data-type="Handover Day">Handover</button>
      </div>
    </div>

    <div class="field">
      <label>Today's one priority</label>
      <input type="text" id="priority" placeholder="The one thing that would move the week" />
      <div id="suggested" class="muted" style="margin-top: 8px; font-size: 14px;"></div>
    </div>

    <div class="field">
      <label>Free time today</label>
      <div id="free-time" class="muted">Calculating...</div>
    </div>

    <div class="field">
      <label>What would today feel good as? (optional)</label>
      <input type="text" id="feels" placeholder="e.g. quiet, focused, slow" />
    </div>

    <button class="btn" id="submit" disabled>Lock it in</button>
    <div id="msg"></div>
  `;

  await suggestPriority();

  getTodayBusyMinutes().then(mins => {
    state.freeTime = Math.round(mins);
    document.getElementById('free-time').textContent =
      `~${state.freeTime} minutes of unbusy time between 8am–6pm`;
  }).catch(() => {
    document.getElementById('free-time').textContent = 'Could not pull from calendar';
  });

  document.getElementById('capacity').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-cap]');
    if (!btn) return;
    state.capacity = parseInt(btn.dataset.cap);
    document.querySelectorAll('#capacity button').forEach(b =>
      b.classList.toggle('selected', b.dataset.cap === btn.dataset.cap));
    updateSubmit();
    if (state.capacity <= 2 && state.priority) {
      const sug = document.getElementById('suggested');
      sug.textContent = 'Thinking smaller...';
      try {
        const result = await shrinkPriority(state.priority, state.capacity);
        sug.textContent = `Smaller version: ${result.smaller_version}`;
      } catch {
        sug.textContent = '';
      }
    }
  });

  document.getElementById('day-type').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-type]');
    if (!btn) return;
    state.dayType = btn.dataset.type;
    document.querySelectorAll('#day-type button').forEach(b =>
      b.classList.toggle('selected', b.dataset.type === btn.dataset.type));
    updateSubmit();
  });

  document.getElementById('priority').addEventListener('input', (e) => {
    state.priority = e.target.value.trim();
    updateSubmit();
  });

  document.getElementById('feels').addEventListener('input', (e) => {
    state.feels = e.target.value.trim();
  });

  document.getElementById('submit').addEventListener('click', () => submit(view));
}

async function suggestPriority() {
  try {
    const sheetId = getSheetId();
    const rows = await getRows(sheetId, 'Weekly Priorities');
    if (rows.length < 2) return;
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const mondayStr = monday.toISOString().slice(0, 10);
    const weekRows = rows.slice(1).filter(r => r[0] === mondayStr);
    if (weekRows.length === 0) return;
    const domains = ['PhD', 'LLW', 'Family'];
    const dow = today.getDay();
    const domain = domains[dow % 3];
    const match = weekRows.find(r => r[1] === domain);
    const choice = match || weekRows[0];
    if (choice && choice[2]) {
      document.getElementById('priority').value = choice[2];
      state.priority = choice[2];
      document.getElementById('suggested').textContent = `From this week's ${choice[1]} priority`;
      updateSubmit();
    }
  } catch (err) {
    console.warn('Could not load week priorities', err);
  }
}

function updateSubmit() {
  const ok = state.capacity && state.dayType && state.priority;
  document.getElementById('submit').disabled = !ok;
}

async function submit(view) {
  const btn = document.getElementById('submit');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  const msg = document.getElementById('msg');
  try {
    const sheetId = getSheetId();
    const calId = getCalendarId();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    await appendRow(sheetId, 'Daily Check-in', [
      today,
      state.dayType,
      state.capacity,
      '',
      state.priority,
      state.freeTime || '',
      '',
      '',
      '',
      now
    ]);

    await appendRow(sheetId, 'Capacity Log', [
      today,
      state.capacity,
      '',
      '',
      state.dayType,
      state.feels || ''
    ]);

    if (calId && state.priority) {
      const duration = state.capacity <= 2 ? 30 : state.capacity <= 3 ? 60 : 90;
      try {
        await createPriorityBlock(calId, state.priority, duration);
      } catch (err) {
        console.warn('Calendar block failed', err);
      }
    }

    setLastCheckin(today);
    view.innerHTML = `
      <div class="center-screen">
        <h1>Locked in.</h1>
        <p style="font-size: 18px; color: var(--ink);">${state.priority}</p>
        <p class="muted">See you tonight for the close.</p>
      </div>
    `;
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = 'Lock it in';
    msg.innerHTML = `<div class="error">Couldn't save: ${err.message}</div>`;
  }
}

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric'
  });
}
