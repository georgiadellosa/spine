import { appendRow, getRows } from '../google-sheets.js';
import { getTodayBusyMinutes, createPriorityBlock } from '../google-calendar.js';
import { shrinkPriority } from '../api.js';
import { getSheetId, getCalendarId, setLastCheckin } from '../store.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

let state = { capacity: null, dayType: null, priority: '', freeTime: null, feels: '', staleDays: 0 };

export async function render(view) {
  state = { capacity: null, dayType: null, priority: '', freeTime: null, feels: '', staleDays: 0 };
  const today = new Date();
  const greeting = greetingFor(today);

  view.innerHTML = `
    <div class="eyebrow">${formatToday(today)}</div>
    <h1>${greeting}</h1>
    <p class="subtitle">A few seconds. Then you're done.</p>

    <div class="field">
      <label>Capacity right now</label>
      <div class="capacity-row" id="capacity">
        ${[1,2,3,4,5].map(n => `<button data-cap="${n}">${n}</button>`).join('')}
      </div>
      <div class="help">1 = shutdown · 5 = high</div>
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
      <input type="text" id="priority" placeholder="The one thing that would move the week" autocomplete="off" />
      <div id="suggested" class="help"></div>
    </div>

    <div class="field">
      <label>Free time today</label>
      <div id="free-time" class="muted">Reading your calendar…</div>
    </div>

    <div class="field">
      <label>What would today feel good as? <span class="faint">(optional)</span></label>
      <input type="text" id="feels" placeholder="quiet · focused · slow · gentle" autocomplete="off" />
    </div>

    <button class="btn" id="submit" disabled>
      Lock it in
      ${icon('arrow', 18)}
    </button>
    <div id="msg"></div>

    <div class="row mt-5" style="justify-content: center; gap: 16px;">
      <a href="#/sunday" class="link" style="font-size: 14px;">No priorities yet?</a>
      <span class="faint">·</span>
      <a href="#/evening" class="link" style="font-size: 14px;">Evening close</a>
    </div>
  `;

  await suggestPriority();

  getTodayBusyMinutes().then(mins => {
    state.freeTime = Math.round(mins);
    document.getElementById('free-time').textContent =
      `${state.freeTime} minutes of unbusy time between 8am and 6pm`;
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
      sug.textContent = 'Thinking smaller…';
      try {
        const result = await shrinkPriority(state.priority, state.capacity);
        sug.innerHTML = `<span class="chip warm" style="margin-top: 8px;">Smaller: ${escHtml(result.smaller_version)}</span>`;
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
    const [priorities, checkins] = await Promise.all([
      getRows(sheetId, 'Weekly Priorities'),
      getRows(sheetId, 'Daily Check-in')
    ]);
    if (priorities.length < 2) {
      document.getElementById('suggested').innerHTML =
        `<a href="#/sunday" class="link">No priorities set this week — run Sunday Decision</a>`;
      return;
    }
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const mondayStr = monday.toISOString().slice(0, 10);
    const weekRows = priorities.slice(1).filter(r => r[0] === mondayStr);
    if (weekRows.length === 0) {
      document.getElementById('suggested').innerHTML =
        `<a href="#/sunday" class="link">No priorities set this week — run Sunday Decision</a>`;
      return;
    }
    const domains = ['PhD', 'LLW', 'Family'];
    const dow = today.getDay();
    const domain = domains[dow % 3];
    const match = weekRows.find(r => r[1] === domain);
    const choice = match || weekRows[0];

    // Auto-rollover detection: priority unmoved 3 days running?
    const recentCheckins = checkins.slice(1).filter(r => r[4] === choice[2]).slice(-3);
    const allNo = recentCheckins.length >= 3 && recentCheckins.every(r => r[6] === 'No');
    state.staleDays = allNo ? recentCheckins.length : 0;

    if (choice && choice[2]) {
      document.getElementById('priority').value = choice[2];
      state.priority = choice[2];
      let suggestedHtml = `<span class="chip">From this week's ${escHtml(choice[1])} priority</span>`;
      if (allNo) {
        suggestedHtml += `<div class="info mt-3">This priority hasn't moved in ${recentCheckins.length} days. Consider a smaller version, or <a href="#/sunday" class="link">re-decide on Sunday</a>.</div>`;
      }
      document.getElementById('suggested').innerHTML = suggestedHtml;
      updateSubmit();
    }
  } catch (err) {
    console.warn('Could not load priorities', err);
  }
}

function updateSubmit() {
  const ok = state.capacity && state.dayType && state.priority;
  document.getElementById('submit').disabled = !ok;
}

async function submit(view) {
  const btn = document.getElementById('submit');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  const msg = document.getElementById('msg');
  try {
    const sheetId = getSheetId();
    const calId = getCalendarId();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    await appendRow(sheetId, 'Daily Check-in', [
      today, state.dayType, state.capacity, '', state.priority,
      state.freeTime || '', '', '', '', now
    ]);
    await appendRow(sheetId, 'Capacity Log', [
      today, state.capacity, '', '', state.dayType, state.feels || ''
    ]);

    if (calId && state.priority) {
      const duration = state.capacity <= 2 ? 30 : state.capacity <= 3 ? 60 : 90;
      try { await createPriorityBlock(calId, state.priority, duration); } catch {}
    }

    setLastCheckin(today);
    view.innerHTML = `
      <div class="center-screen">
        <div class="celebrate-check">${icon('check', 40)}</div>
        <h1>Locked in.</h1>
        <div class="priority-card" style="max-width: 360px;">
          <div class="domain">Today</div>
          <div class="text">${escHtml(state.priority)}</div>
        </div>
        <p class="muted">See you tonight for the close.</p>
        <button class="btn btn-ghost" onclick="location.hash='#/calendar'" style="max-width: 280px;">
          ${icon('calendar', 18)} See it on your calendar
        </button>
      </div>
    `;
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = 'Lock it in';
    msg.innerHTML = `<div class="error">Couldn't save: ${err.message}</div>`;
  }
}

function greetingFor(d) {
  const h = d.getHours();
  if (h < 12) return 'Good morning.';
  if (h < 17) return 'Afternoon check-in.';
  return 'Late check-in — still counts.';
}
function formatToday(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
