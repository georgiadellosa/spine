import { signOut } from '../auth.js';
import { clearAll, getSheetId, getDriveFolderId, getCalendarId, getCustodyCalendarId, setCustodyCalendarId, getRitualTimes, setRitualTimes } from '../store.js';
import { navigate } from '../router.js';
import { appendRow } from '../google-sheets.js';
import { ingestPaste } from '../api.js';
import { listCalendars, rebuildRituals } from '../google-calendar.js';
import { icon } from '../icons.js';

export async function render(view) {
  const ritualTimes = getRitualTimes();
  view.innerHTML = `
    <h1>More</h1>
    <p class="subtitle">Rituals, your data, and the master plan.</p>

    <div class="card">
      <div class="eyebrow mb-3">Rituals</div>
      ${linkRow('sunday', 'refresh', 'Sunday Decision', 'Brain dump → triage → pick three')}
      ${linkRow('friday', 'check', 'Friday Close', 'Reflect on the week')}
      ${linkRow('quarterly', 'layers', 'Quarterly Spine', '17-month roadmap')}
      ${linkRow('patterns', 'sparkle', 'Patterns', 'What the data is showing')}
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Your data</div>
      ${linkRow('inbox', 'paste', 'Inbox & Pending', 'Captures, delayed items, awaiting send')}
      ${linkRow('parking', 'leaf', 'Parking Lot', 'Dormant projects')}
      ${linkRow('brain-dumps', 'paste', 'Brain dump history', 'Past dumps, chronological')}
      ${linkRow('data', 'layers', 'All data — browse & edit', 'Add, edit, delete any row in any tab')}
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Custody calendar</div>
      <p class="muted" style="font-size: 13px; margin-bottom: 12px;">
        Pick the calendar where kid-days, handovers, or school events live. Morning will auto-suggest your day type from it.
      </p>
      <select id="custody-pick">
        <option value="">— none / manual selection —</option>
      </select>
      <div id="custody-status" class="help mt-2"></div>
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Ritual times</div>
      <p class="muted" style="font-size: 13px; margin-bottom: 12px;">
        When the recurring events appear in your calendar. Changes here rebuild the calendar entries.
      </p>
      <div class="field">
        <label>Daily Check-in (Mon–Fri)</label>
        <input type="time" id="time-daily" value="${formatTime(ritualTimes.daily)}" />
      </div>
      <div class="field">
        <label>Sunday Decision (Sundays)</label>
        <input type="time" id="time-sunday" value="${formatTime(ritualTimes.sunday)}" />
      </div>
      <div class="field">
        <label>Friday Close (Fridays)</label>
        <input type="time" id="time-friday" value="${formatTime(ritualTimes.friday)}" />
      </div>
      <button class="btn btn-ghost" id="apply-times">Apply ritual times</button>
      <div id="times-status" class="help mt-2"></div>
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Paste from Claude</div>
      <p class="muted" style="font-size: 13px; margin-bottom: 12px;">
        Paste a Claude conversation or any structured text. The AI parses it into items added to your inbox for triage.
      </p>
      <textarea id="paste-text" placeholder="Paste a brain dump, plan, or list from Claude..."></textarea>
      <button class="btn btn-ghost mt-3" id="paste-btn">${icon('paste', 16)} Ingest into inbox</button>
      <div id="paste-msg"></div>
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Open in Google</div>
      <div class="stack-2">
        <a href="https://docs.google.com/spreadsheets/d/${getSheetId()}" target="_blank" class="link" style="display: flex; align-items: center; gap: 8px; padding: 8px 0;">
          ${icon('open', 14)} Spine spreadsheet
        </a>
        <a href="https://drive.google.com/drive/folders/${getDriveFolderId()}" target="_blank" class="link" style="display: flex; align-items: center; gap: 8px; padding: 8px 0;">
          ${icon('open', 14)} Spine Drive folder
        </a>
        <a href="https://calendar.google.com/calendar/u/0/r" target="_blank" class="link" style="display: flex; align-items: center; gap: 8px; padding: 8px 0;">
          ${icon('open', 14)} Google Calendar
        </a>
      </div>
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Stop / Start / Keep</div>
      <p class="muted" style="font-size: 13px; margin-bottom: 12px;">From the master plan. Reviewed Friday.</p>
      <p style="font-weight: 600; margin: 12px 0 6px; color: var(--terracotta); font-size: 13px; letter-spacing: 0.05em;">STOP</p>
      <ul style="margin: 0 0 16px 20px; font-size: 14px; color: var(--ink-soft); line-height: 1.6;">
        <li>Starting new app projects</li>
        <li>Designing four products simultaneously</li>
        <li>Holding deadlines in your head — they live in Spine</li>
        <li>Building skills/plugins faster than you use them</li>
        <li>ConnectWell decisions in isolation</li>
      </ul>
      <p style="font-weight: 600; margin: 12px 0 6px; color: var(--gold); font-size: 13px; letter-spacing: 0.05em;">START</p>
      <ul style="margin: 0 0 16px 20px; font-size: 14px; color: var(--ink-soft); line-height: 1.6;">
        <li>Friday close, 20 min</li>
        <li>Sunday decision, 30 min</li>
        <li>Quarterly "what dies" review</li>
        <li>Using the ND scheduler on yourself daily</li>
        <li>One commercial finish line for G-HAMR</li>
      </ul>
      <p style="font-weight: 600; margin: 12px 0 6px; color: var(--sage); font-size: 13px; letter-spacing: 0.05em;">KEEP</p>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: var(--ink-soft); line-height: 1.6;">
        <li>PhD as the spine</li>
        <li>ConnectWell engagement</li>
        <li>Co-regulation-first parenting</li>
        <li>georgia-context + skills layer</li>
        <li>R + lavaan as analytical home</li>
      </ul>
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Spine connection</div>
      <p class="muted" style="font-size: 13px; margin-bottom: 12px;">
        Connect this browser to a different Spine — useful for switching between accounts.
      </p>
      <button class="btn btn-ghost" id="reconnect">${icon('refresh', 16)} Connect different Spine</button>
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Account</div>
      <button class="btn btn-ghost" id="signout">${icon('signOut', 16)} Sign out</button>
      <p class="faint mt-3" style="line-height: 1.5;">
        Sign-out doesn't delete anything. Your data stays in your Google account.
      </p>
    </div>
  `;

  // Populate custody calendar dropdown
  listCalendars().then(calendars => {
    const select = document.getElementById('custody-pick');
    const current = getCustodyCalendarId();
    select.innerHTML = `
      <option value="">— none / manual selection —</option>
      ${calendars.map(c => `
        <option value="${escAttr(c.id)}" ${c.id === current ? 'selected' : ''}>
          ${escHtml(c.summary)}
        </option>
      `).join('')}
    `;
    select.addEventListener('change', () => {
      setCustodyCalendarId(select.value);
      const status = document.getElementById('custody-status');
      status.innerHTML = `<span style="color: var(--sage);">${icon('check', 12)} Saved.</span>`;
      setTimeout(() => { status.textContent = ''; }, 2000);
    });
  }).catch(() => {
    document.getElementById('custody-status').innerHTML = `<span class="error">Couldn't load calendars</span>`;
  });

  // Apply ritual times
  document.getElementById('apply-times').addEventListener('click', async () => {
    const status = document.getElementById('times-status');
    const btn = document.getElementById('apply-times');
    const newTimes = {
      daily: parseTime(document.getElementById('time-daily').value, 5),
      sunday: parseTime(document.getElementById('time-sunday').value, 30),
      friday: parseTime(document.getElementById('time-friday').value, 20)
    };
    setRitualTimes(newTimes);
    btn.disabled = true;
    btn.textContent = 'Rebuilding…';
    status.textContent = 'Deleting old recurring events and creating new ones…';
    try {
      const calId = getCalendarId();
      if (!calId) throw new Error('No Spine calendar configured');
      await rebuildRituals(calId);
      status.innerHTML = `<span style="color: var(--sage);">${icon('check', 12)} Ritual times updated.</span>`;
    } catch (err) {
      status.innerHTML = `<span class="error">${err.message}</span>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply ritual times';
    }
  });

  document.getElementById('signout').addEventListener('click', () => {
    if (!confirm('Sign out?')) return;
    signOut();
    clearAll();
    navigate('login');
  });

  document.getElementById('reconnect').addEventListener('click', () => {
    if (!confirm('This will clear the current Spine connection from this browser. Your data stays safe in Google. Continue?')) return;
    clearAll();
    navigate('setup');
  });

  document.getElementById('paste-btn').addEventListener('click', async () => {
    const text = document.getElementById('paste-text').value.trim();
    const msg = document.getElementById('paste-msg');
    if (!text) { msg.innerHTML = `<div class="error">Paste something first</div>`; return; }
    const btn = document.getElementById('paste-btn');
    btn.disabled = true;
    btn.textContent = 'Parsing…';
    try {
      const result = await ingestPaste(text);
      const items = result.items || [];
      const sheetId = getSheetId();
      const today = new Date().toISOString().slice(0, 10);
      await appendRow(sheetId, 'Brain Dumps', [today, text, JSON.stringify(items), 'Pasted', '']);
      for (const it of items) {
        const id = `paste-${Date.now()}-${Math.random().toString(36).slice(2,5)}`;
        await appendRow(sheetId, 'Triage', [
          id, today, it.text, '', it.domain || 'Other', '', '', '', 'inbox', new Date().toISOString()
        ]).catch(() => {});
      }
      msg.innerHTML = `<div class="success">Parsed ${items.length} item${items.length !== 1 ? 's' : ''} into your inbox.</div>`;
      document.getElementById('paste-text').value = '';
    } catch (err) {
      msg.innerHTML = `<div class="error">${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('paste', 16)} Ingest into inbox`;
    }
  });
}

function linkRow(route, iconName, title, subtitle) {
  return `
    <a href="#/${route}" class="link" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--sand); text-decoration: none; color: inherit;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="color: var(--sage);">${icon(iconName, 18)}</span>
        <div>
          <div style="color: var(--ink); font-weight: 500;">${title}</div>
          <div class="faint" style="margin-top: 2px;">${subtitle}</div>
        </div>
      </div>
      <span style="color: var(--ink-faint);">${icon('arrow', 16)}</span>
    </a>
  `;
}

function formatTime(t) {
  const h = String(t.hour).padStart(2, '0');
  const m = String(t.min).padStart(2, '0');
  return `${h}:${m}`;
}
function parseTime(value, defaultDuration) {
  const [h, m] = (value || '07:00').split(':').map(n => parseInt(n));
  return { hour: h || 0, min: m || 0, duration: defaultDuration };
}
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
