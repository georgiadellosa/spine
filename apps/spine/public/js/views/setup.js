import { createSpineSheet } from '../google-sheets.js';
import { createSpineFolder } from '../google-drive.js';
import { createSpineCalendar, createRecurringRituals } from '../google-calendar.js';
import { setSheetId, setDriveFolderId, setCalendarId, setSetupComplete } from '../store.js';
import { withFreshToken } from '../auth.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

export async function render(view) {
  view.innerHTML = `
    <div class="center-screen">
      <div class="icon-large">${icon('layers', 64)}</div>
      <h1>Get started</h1>
      <p style="max-width: 360px;">First time, or connecting from a second email?</p>

      <div style="max-width: 360px; width: 100%; display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
        <button class="btn" id="new-setup">${icon('sparkle', 18)} Set up new Spine</button>
        <button class="btn btn-ghost" id="connect-setup">${icon('layers', 18)} Connect to existing Spine</button>
      </div>

      <p class="faint" style="max-width: 360px; margin-top: 16px; line-height: 1.5;">
        Use "Connect" if you've already set up Spine on another account (e.g. your other email) and want both accounts to share the same data.
      </p>
    </div>
  `;
  document.getElementById('new-setup').addEventListener('click', () => runNewSetup(view));
  document.getElementById('connect-setup').addEventListener('click', () => runConnectFlow(view));
}

async function runNewSetup(view) {
  view.innerHTML = `
    <div class="center-screen">
      <div class="icon-large">${icon('layers', 64)}</div>
      <h1 style="font-size: 28px;">Setting up your Spine</h1>
      <p style="max-width: 320px;">Creating a spreadsheet, folder, and calendar in your Google account. About 10 seconds.</p>
      <div class="spinner"></div>
      <div id="status" class="muted" style="font-size: 13px; min-height: 18px;"></div>
    </div>
  `;
  const status = document.getElementById('status');
  try {
    status.textContent = 'Creating spreadsheet…';
    const sheetId = await createSpineSheet();
    setSheetId(sheetId);

    status.textContent = 'Creating Drive folder…';
    const folderId = await createSpineFolder();
    setDriveFolderId(folderId);

    status.textContent = 'Creating calendar…';
    const calId = await createSpineCalendar();
    setCalendarId(calId);

    status.textContent = 'Adding weekly rituals to your calendar…';
    await createRecurringRituals(calId);

    setSetupComplete();
    showSuccess(view, 'You\'re set up.', 'Your Spine spreadsheet, Drive folder, and Spine calendar are now in your Google account. They\'re yours — open them anytime.');
  } catch (err) {
    console.error('Setup failed', err);
    showError(view, err.message);
  }
}

async function runConnectFlow(view) {
  view.innerHTML = `
    <h1>Connect to existing Spine</h1>
    <p class="subtitle">Both accounts will read and write the same Spine.</p>

    <div class="card warm">
      <div class="eyebrow mb-2">Before you continue</div>
      <p style="font-size: 14px; margin-bottom: 8px;">From your <strong>primary</strong> Google account (the one that originally set up Spine), share these three things with this account (<strong>${getCurrentEmail()}</strong>) as <strong>Editor</strong>:</p>
      <ol style="margin: 8px 0 0 20px; font-size: 14px; color: var(--ink-soft); line-height: 1.6;">
        <li>The <strong>Spine spreadsheet</strong></li>
        <li>The <strong>Spine Drive folder</strong></li>
        <li>The <strong>Spine calendar</strong> (Calendar settings → Share with specific people → "Make changes to events")</li>
      </ol>
    </div>

    <div class="field">
      <label>Spine spreadsheet URL or ID</label>
      <input type="text" id="sheet-url" placeholder="https://docs.google.com/spreadsheets/d/..." autocomplete="off" />
      <div id="sheet-status" class="help"></div>
    </div>

    <div class="field">
      <label>Drive folder URL or ID</label>
      <input type="text" id="folder-url" placeholder="https://drive.google.com/drive/folders/..." autocomplete="off" />
      <div id="folder-status" class="help">Auto-detecting…</div>
    </div>

    <div class="field">
      <label>Spine calendar</label>
      <select id="calendar-pick">
        <option value="">Loading calendars…</option>
      </select>
    </div>

    <button class="btn" id="connect">${icon('layers', 18)} Connect</button>
    <button class="btn btn-ghost mt-3" id="back">← Back</button>
    <div id="msg"></div>
  `;

  document.getElementById('back').addEventListener('click', () => render(view));

  // Auto-detect Spine folder
  findSpineFolder().then(folders => {
    const status = document.getElementById('folder-status');
    if (folders.length === 1) {
      document.getElementById('folder-url').value = folders[0].id;
      status.innerHTML = `<span style="color: var(--sage);">${icon('check', 12)} Auto-detected: ${escHtml(folders[0].name)}</span>`;
    } else if (folders.length > 1) {
      status.textContent = `Multiple "Spine" folders found — paste the URL of the right one.`;
    } else {
      status.textContent = `No "Spine" folder accessible yet. Make sure it's been shared with this account, then paste the URL.`;
    }
  }).catch(() => {});

  // Load calendars
  listCalendars().then(calendars => {
    const select = document.getElementById('calendar-pick');
    const spine = calendars.find(c => c.summary === 'Spine');
    select.innerHTML = `
      <option value="">— select Spine calendar —</option>
      ${calendars.map(c => `
        <option value="${escAttr(c.id)}" ${c.id === spine?.id ? 'selected' : ''}>
          ${escHtml(c.summary)}${c.id === spine?.id ? ' (suggested)' : ''}
        </option>
      `).join('')}
    `;
  }).catch(() => {});

  document.getElementById('connect').addEventListener('click', async () => {
    const sheetInput = document.getElementById('sheet-url').value.trim();
    const folderInput = document.getElementById('folder-url').value.trim();
    const calId = document.getElementById('calendar-pick').value;
    const msg = document.getElementById('msg');

    if (!sheetInput) { msg.innerHTML = `<div class="error">Spreadsheet URL required</div>`; return; }
    if (!calId) { msg.innerHTML = `<div class="error">Pick the Spine calendar</div>`; return; }

    const btn = document.getElementById('connect');
    btn.disabled = true;
    btn.innerHTML = 'Validating… <div class="spinner" style="width: 16px; height: 16px; margin-left: 8px;"></div>';

    try {
      const sheetId = extractSheetId(sheetInput);
      await validateSpineSheet(sheetId);

      let folderId = '';
      if (folderInput) {
        folderId = extractFolderId(folderInput);
      }

      setSheetId(sheetId);
      if (folderId) setDriveFolderId(folderId);
      setCalendarId(calId);
      setSetupComplete();

      showSuccess(view, 'Connected.', `Both ${getCurrentEmail()} and your other account are now reading and writing the same Spine.`);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `${icon('layers', 18)} Connect`;
      msg.innerHTML = `<div class="error">${err.message}</div>`;
    }
  });
}

function showSuccess(view, title, body) {
  view.innerHTML = `
    <div class="center-screen">
      <div class="celebrate-check">${icon('check', 40)}</div>
      <h1>${escHtml(title)}</h1>
      <p style="max-width: 360px;">${escHtml(body)}</p>
      <button class="btn" id="continue" style="max-width: 320px;">
        Open morning check-in ${icon('arrow', 18)}
      </button>
    </div>
  `;
  document.getElementById('continue').addEventListener('click', () => navigate('morning'));
}

function showError(view, message) {
  view.innerHTML = `
    <div class="center-screen">
      <h1>Setup hit a snag</h1>
      <div class="error" style="max-width: 360px;">${escHtml(message)}</div>
      <button class="btn btn-ghost" id="retry">Try again</button>
    </div>
  `;
  document.getElementById('retry').addEventListener('click', () => render(view));
}

async function findSpineFolder() {
  return withFreshToken(async (token) => {
    const q = encodeURIComponent("name='Spine' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,owners)`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  });
}

async function listCalendars() {
  return withFreshToken(async (token) => {
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).filter(c => !c.hidden);
  });
}

async function validateSpineSheet(sheetId) {
  return withFreshToken(async (token) => {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 404) throw new Error('Spreadsheet not found. Has it been shared with this account?');
    if (res.status === 403) throw new Error('No permission. Make sure the sheet has been shared with this email as Editor.');
    if (!res.ok) throw new Error(`Couldn't validate: ${res.status}`);
    const data = await res.json();
    const tabs = (data.sheets || []).map(s => s.properties.title);
    const required = ['Weekly Priorities', 'Daily Check-in', 'Wins', 'Triage', 'Quarterly Spine'];
    const missing = required.filter(t => !tabs.includes(t));
    if (missing.length > 0) {
      throw new Error(`This doesn't look like a Spine sheet — missing tabs: ${missing.join(', ')}`);
    }
    return true;
  });
}

function extractSheetId(input) {
  const m = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
}
function extractFolderId(input) {
  const m = input.match(/folders\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
}

function getCurrentEmail() {
  // Best-effort — pulled from the Google session if available
  try {
    const credential = window.google?.accounts?.id;
    return 'this email';
  } catch {
    return 'this email';
  }
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
