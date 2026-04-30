import { getRows, appendRow } from '../google-sheets.js';
import { getSheetId, getCalendarId } from '../store.js';
import { withFreshToken } from '../auth.js';
import { icon } from '../icons.js';

const CAL_API = 'https://www.googleapis.com/calendar/v3';
let state = { shipped: '', stuck: '', moves: '', mood: null, note: '' };

export async function render(view) {
  state = { shipped: '', stuck: '', moves: '', mood: null, note: '' };
  view.innerHTML = `
    <div class="eyebrow">Weekly Close</div>
    <h1>Reflect, don't beat yourself up.</h1>
    <p class="subtitle">What actually happened this week.</p>

    <div id="reality"><div class="card"><div class="spinner" style="margin: 20px auto;"></div></div></div>

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
      <label>Mood</label>
      <div class="capacity-row" id="mood">
        ${[1,2,3,4,5].map(n => `<button data-m="${n}">${n}</button>`).join('')}
      </div>
    </div>
    <div class="field">
      <label>One-line note <span class="faint">(optional)</span></label>
      <input type="text" id="note" />
    </div>

    <button class="btn" id="submit">Close the week ${icon('arrow', 18)}</button>
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

    const [priorities, checkins, wins] = await Promise.all([
      getRows(sheetId, 'Weekly Priorities'),
      getRows(sheetId, 'Daily Check-in'),
      getRows(sheetId, 'Wins')
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
    const weekWins = wins.slice(1).filter(r => r[0] && new Date(r[0]) >= monday);

    let calEvents = [];
    if (calId) {
      try { calEvents = await fetchSpineEvents(calId, monday, today); } catch {}
    }

    document.getElementById('reality').innerHTML = `
      <div class="card sage">
        <div class="eyebrow mb-3">This week's reality</div>
        <div class="row" style="gap: 16px; flex-wrap: wrap;">
          <div class="stat" style="flex: 1; padding: 8px; min-width: 80px;">
            <div class="number" style="font-size: 32px;">${weekCheckins.length}</div>
            <div class="label">check-ins</div>
          </div>
          <div class="stat" style="flex: 1; padding: 8px; min-width: 80px;">
            <div class="number" style="font-size: 32px; color: var(--terracotta);">${weekWins.length}</div>
            <div class="label">wins</div>
          </div>
          <div class="stat" style="flex: 1; padding: 8px; min-width: 80px;">
            <div class="number" style="font-size: 32px; color: var(--gold);">${calEvents.length}</div>
            <div class="label">blocks</div>
          </div>
        </div>
        <div class="mt-4">
          <div class="eyebrow mb-2">Priorities</div>
          ${week.length === 0 ? '<p class="muted" style="font-size: 14px;">None set</p>' :
            week.map(r => `<div style="font-size: 14px; margin: 4px 0;"><strong style="color: var(--sage-deep);">${escHtml(r[1])}:</strong> ${escHtml(r[2])}</div>`).join('')}
        </div>
        <div class="mt-4">
          <div class="eyebrow mb-2">Outcomes</div>
          <div class="row" style="gap: 8px; font-size: 13px;">
            <span class="chip">${moved} moved</span>
            <span class="chip gold">${some} some</span>
            <span class="chip warm">${no} no</span>
          </div>
        </div>
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
  btn.textContent = 'Saving…';
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
        <div class="celebrate-check">${icon('check', 40)}</div>
        <h1>Week closed.</h1>
        <p class="muted" style="max-width: 320px;">You showed up. That's the spine working.</p>
        <a href="#/sunday" class="link mt-4">Sunday Decision is up next →</a>
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
