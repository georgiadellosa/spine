import { getRows, appendRow } from '../google-sheets.js';
import { getSheetId, getCalendarId } from '../store.js';
import { withFreshToken } from '../auth.js';

const CAL_API = 'https://www.googleapis.com/calendar/v3';
let state = { shipped: '', stuck: '', moves: '', mood: null, note: '' };

export async function render(view) {
  state = { shipped: '', stuck: '', moves: '', mood: null, note: '' };
  view.innerHTML = `
    <h1>Friday Close</h1>
    <p class="muted">Reflect, don't beat yourself up.</p>
    <div id="reality"><div class="spinner"></div></div>

    <div class="field">
      <label>What shipped</label>
      <textarea id="shipped" placeholder="What moved this week"></textarea>
    </div>
    <div class="field">
      <label>What got stuck</label>
      <textarea id="stuck" placeholder="What didn't move and why"></textarea>
    </div>
    <div class="field">
      <label>What moves to next week</label>
      <textarea id="moves" placeholder="Carryovers"></textarea>
    </div>
    <div class="field">
      <label>Mood (1–5)</label>
      <div class="capacity-row" id="mood">
        ${[1,2,3,4,5].map(n => `<button data-m="${n}">${n}</button>`).join('')}
      </div>
    </div>
    <div class="field">
      <label>One-line note (optional)</label>
      <input type="text" id="note" />
    </div>

    <button class="btn" id="submit">Close the week</button>
    <div id="msg"></div>
  `;

  await loadReality();

  document.getElementById('mood').addEventListener('click', e => {
    const btn = e.target.closest('button[data-m]');
    if (!btn) return;
    state.mood = parseInt(btn.dataset.m);
    document.querySelectorAll('#mood button').forEach(b =>
      b.classList.toggle('selected', b.dataset.m === btn.dataset.m));
  });
  ['shipped', 'stuck', 'moves', 'note'].forEach(f => {
    document.getElementById(f).addEventListener('input', e => state[f] = e.target.value.trim());
  });
  document.getElementById('submit').addEventListener('click', () => submit(view));
}

async function loadReality() {
  try {
    const sheetId = getSheetId();
    const calId = getCalendarId();
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const ms = monday.toISOString().slice(0, 10);

    const [priorities, checkins] = await Promise.all([
      getRows(sheetId, 'Weekly Priorities'),
      getRows(sheetId, 'Daily Check-in')
    ]);
    const week = priorities.slice(1).filter(r => r[0] === ms);
    const weekCheckins = checkins.slice(1).filter(r => {
      if (!r[0]) return false;
      const d = new Date(r[0]);
      return d >= monday && d <= today;
    });
    const moved = weekCheckins.filter(r => r[6] === 'Moved').length;
    const some = weekCheckins.filter(r => r[6] === 'Some').length;
    const no = weekCheckins.filter(r => r[6] === 'No').length;

    let calEvents = [];
    if (calId) {
      try {
        calEvents = await fetchSpineEvents(calId, monday, today);
      } catch {}
    }

    document.getElementById('reality').innerHTML = `
      <div class="card">
        <h2 style="margin-top: 0;">This week's reality</h2>
        <p style="margin-bottom: 8px;"><strong>Priorities:</strong></p>
        <ul style="margin: 0 0 12px 20px; color: var(--ink-soft);">
          ${week.map(r => `<li><strong>${escHtml(r[1])}:</strong> ${escHtml(r[2])}</li>`).join('') || '<li>None set</li>'}
        </ul>
        <p style="margin: 4px 0;"><strong>Check-ins:</strong> ${weekCheckins.length} this week</p>
        <p style="margin: 4px 0;"><strong>Outcomes:</strong> ${moved} moved · ${some} some · ${no} no</p>
        <p style="margin: 4px 0;"><strong>Spine calendar blocks:</strong> ${calEvents.length}</p>
      </div>
    `;
  } catch (err) {
    document.getElementById('reality').innerHTML = `<div class="error">Couldn't load week reality: ${err.message}</div>`;
  }
}

async function fetchSpineEvents(calId, start, end) {
  return withFreshToken(async (token) => {
    const url = `${CAL_API}/calendars/${encodeURIComponent(calId)}/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    const ritualNames = ['Daily Check-in', 'Sunday Decision', 'Friday Close'];
    return (data.items || []).filter(e => !ritualNames.includes(e.summary));
  });
}

async function submit(view) {
  const btn = document.getElementById('submit');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    const sheetId = getSheetId();
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + ((0 - today.getDay() + 7) % 7));
    const ws = sunday.toISOString().slice(0, 10);
    await appendRow(sheetId, 'Weekly Close', [
      ws, state.shipped, state.stuck, state.moves, state.mood || '', state.note, new Date().toISOString()
    ]);
    view.innerHTML = `
      <div class="center-screen">
        <h1>Week closed.</h1>
        <p>You showed up. That's the spine working.</p>
      </div>
    `;
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Close the week';
    document.getElementById('msg').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
