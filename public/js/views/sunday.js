import { appendRow, getRows, updateRow } from '../google-sheets.js';
import { getDriveFolderId, getSheetId } from '../store.js';
import { uploadAudioToDrive } from '../google-drive.js';
import { whisperTranscribe, parseBrainDump } from '../api.js';
import { logWin } from '../win.js';
import { icon } from '../icons.js';

let state = { items: [], decisions: [], rawText: '', source: 'Text', preExisting: [] };

export async function render(view) {
  state = { items: [], decisions: [], rawText: '', source: 'Text', preExisting: [] };
  // Pull any inbox/resurfaced items first
  await loadPreExisting();
  showBrainDump(view);
}

async function loadPreExisting() {
  try {
    const sheetId = getSheetId();
    const rows = await getRows(sheetId, 'Triage');
    const today = new Date().toISOString().slice(0, 10);
    const all = rows.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 }));
    const inbox = all.filter(({ row }) => row[8] === 'inbox');
    const resurfacing = all.filter(({ row }) =>
      row[3] === 'Delay' && row[5] && row[5] <= today && row[8] !== 'resurfaced');
    state.preExisting = [...inbox, ...resurfacing];
  } catch (err) {
    console.warn('Could not load pre-existing triage', err);
  }
}

function showBrainDump(view) {
  const preCount = state.preExisting.length;
  view.innerHTML = `
    <div class="eyebrow">Step 1 of 3</div>
    <h1>Brain dump</h1>
    <p class="subtitle">Get it all out. Don't filter.</p>

    ${preCount > 0 ? `
      <div class="info" style="margin-bottom: 16px;">
        ${preCount} item${preCount !== 1 ? 's' : ''} from your inbox and delayed items will be included in triage.
      </div>
    ` : ''}

    <div class="field">
      <textarea id="dump" placeholder="Work, life, kids, body, money — anything taking up space. One thought per line if it helps." autofocus></textarea>
    </div>

    <div class="row" style="justify-content: space-between; align-items: center;">
      <button class="mic-btn" id="mic">${icon('mic', 16)} Voice instead</button>
      <span class="faint" id="char-count">0 chars</span>
    </div>
    <div id="voice-status" class="help mt-2"></div>

    <button class="btn mt-5" id="next">
      Parse it ${icon('arrow', 18)}
    </button>
    <div id="msg"></div>
  `;
  setupMic();
  document.getElementById('dump').addEventListener('input', e => {
    document.getElementById('char-count').textContent = `${e.target.value.length} chars`;
  });

  document.getElementById('next').addEventListener('click', async () => {
    const text = document.getElementById('dump').value.trim();
    if (!text && state.preExisting.length === 0) {
      document.getElementById('msg').innerHTML = `<div class="error">Add some text, record voice, or capture some items in your inbox first</div>`;
      return;
    }
    state.rawText = text;
    const btn = document.getElementById('next');
    btn.disabled = true;
    btn.innerHTML = 'Parsing… <div class="spinner" style="width: 16px; height: 16px; margin-left: 8px;"></div>';
    try {
      let parsedItems = [];
      if (text) {
        const result = await parseBrainDump(text);
        parsedItems = result.items || [];
        const sheetId = getSheetId();
        const today = new Date().toISOString().slice(0, 10);
        await appendRow(sheetId, 'Brain Dumps', [today, text, JSON.stringify(parsedItems), state.source, '']);
      }
      state.items = parsedItems;

      const preDecisions = state.preExisting.map(({ row, rowIndex }) => ({
        item: { text: row[2], domain: row[4] || 'Other' },
        decision: null, resurfaceDate: '', delegateTo: '', dropReason: '',
        preExistingRowIndex: rowIndex
      }));
      const newDecisions = parsedItems.map(item => ({
        item, decision: null, resurfaceDate: '', delegateTo: '', dropReason: '',
        preExistingRowIndex: null
      }));
      state.decisions = [...preDecisions, ...newDecisions];

      if (state.decisions.length === 0) {
        showPickThree(view);
      } else {
        showTriage(view);
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `Parse it ${icon('arrow', 18)}`;
      document.getElementById('msg').innerHTML = `<div class="error">${err.message}</div>`;
    }
  });
}

let mediaRecorder = null;
let chunks = [];
function setupMic() {
  const mic = document.getElementById('mic');
  const status = document.getElementById('voice-status');
  if (!mic) return;
  mic.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      mic.innerHTML = `${icon('mic', 16)} Voice instead`;
      mic.classList.remove('recording');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        status.textContent = 'Transcribing…';
        const blob = new Blob(chunks, { type: 'audio/webm' });
        try {
          const folderId = getDriveFolderId();
          const fname = `dump-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
          await uploadAudioToDrive(folderId, blob, fname);
          const { transcript } = await whisperTranscribe(blob);
          document.getElementById('dump').value = transcript;
          state.source = 'Voice';
          status.textContent = 'Done — review and edit before parsing.';
          document.getElementById('char-count').textContent = `${transcript.length} chars`;
        } catch (err) {
          status.innerHTML = `<span class="error">${err.message}</span>`;
        }
      };
      mediaRecorder.start();
      mic.innerHTML = `${icon('stop', 16)} Stop`;
      mic.classList.add('recording');
      status.textContent = 'Recording… (tap to stop)';
    } catch {
      status.innerHTML = `<span class="error">Mic permission denied</span>`;
    }
  });
}

function showTriage(view) {
  const undecided = state.decisions.findIndex(d => !d.decision);
  if (undecided === -1) {
    showPickThree(view);
    return;
  }
  const item = state.decisions[undecided];
  const remaining = state.decisions.filter(d => !d.decision).length;
  const total = state.decisions.length;
  const done = total - remaining;
  const progressPct = (done / total) * 100;

  view.innerHTML = `
    <div class="eyebrow">Step 2 of 3 · ${remaining} left</div>
    <h1>Triage</h1>
    <p class="subtitle">For each item, one quick decision.</p>

    <div class="progress mb-4">
      <div class="bar" style="width: ${progressPct}%"></div>
    </div>

    <div class="triage-card">
      <div class="chip mb-3">${escHtml(item.item.domain || 'Other')}</div>
      <div class="item-text">${escHtml(item.item.text)}</div>
    </div>

    <div class="triage-grid">
      <button class="btn" data-d="Do">${icon('doIt', 18)} Do this week</button>
      <button class="btn btn-ghost" data-d="Delay">${icon('delay', 18)} Delay</button>
      <button class="btn btn-ghost" data-d="Delegate">${icon('delegate', 18)} Delegate</button>
      <button class="btn btn-ghost" data-d="Drop">${icon('drop', 18)} Drop</button>
    </div>

    <div id="follow-up" class="mt-4"></div>
  `;
  view.querySelectorAll('button[data-d]').forEach(btn => {
    btn.addEventListener('click', () => decide(view, undecided, btn.dataset.d));
  });
}

function decide(view, idx, decision) {
  const followUp = document.getElementById('follow-up');
  if (decision === 'Do') {
    state.decisions[idx].decision = 'Do';
    recordTriage(idx).then(() => showTriage(view));
  } else if (decision === 'Drop') {
    followUp.innerHTML = `
      <div class="card">
        <input type="text" id="reason" placeholder="One-word reason (optional, but useful later)" autofocus />
        <button class="btn btn-warm mt-3" id="ok">Drop it</button>
      </div>
    `;
    document.getElementById('ok').addEventListener('click', () => {
      state.decisions[idx].decision = 'Drop';
      state.decisions[idx].dropReason = document.getElementById('reason').value.trim();
      recordTriage(idx).then(() => showTriage(view));
    });
  } else if (decision === 'Delay') {
    followUp.innerHTML = `
      <div class="card">
        <label>Resurface when?</label>
        <input type="date" id="rdate" autofocus />
        <button class="btn mt-3" id="ok">Delay</button>
      </div>
    `;
    document.getElementById('ok').addEventListener('click', () => {
      state.decisions[idx].decision = 'Delay';
      state.decisions[idx].resurfaceDate = document.getElementById('rdate').value;
      recordTriage(idx).then(() => showTriage(view));
    });
  } else if (decision === 'Delegate') {
    followUp.innerHTML = `
      <div class="card">
        <label>To whom?</label>
        <input type="text" id="who" placeholder="e.g. kids' dad, supervisor, AI, Lara" autofocus />
        <button class="btn mt-3" id="ok">Delegate</button>
      </div>
    `;
    document.getElementById('ok').addEventListener('click', () => {
      state.decisions[idx].decision = 'Delegate';
      state.decisions[idx].delegateTo = document.getElementById('who').value.trim();
      recordTriage(idx).then(() => showTriage(view));
    });
  }
}

async function recordTriage(idx) {
  try {
    const sheetId = getSheetId();
    const d = state.decisions[idx];
    const today = new Date().toISOString().slice(0, 10);
    const status = d.decision === 'Delegate' ? 'needs sending'
                 : d.decision === 'Do' ? 'pending'
                 : d.decision === 'Drop' ? 'dropped'
                 : d.decision === 'Delay' ? 'delayed'
                 : '';

    if (d.preExistingRowIndex) {
      const rows = await getRows(sheetId, 'Triage');
      const existing = rows[d.preExistingRowIndex - 1] ? [...rows[d.preExistingRowIndex - 1]] : [];
      while (existing.length < 10) existing.push('');
      existing[3] = d.decision;
      existing[5] = d.resurfaceDate || '';
      existing[6] = d.delegateTo || '';
      existing[7] = d.dropReason || '';
      existing[8] = status;
      await updateRow(sheetId, 'Triage', d.preExistingRowIndex, existing);
    } else {
      const id = `${today}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
      await appendRow(sheetId, 'Triage', [
        id, today, d.item.text, d.decision, d.item.domain,
        d.resurfaceDate || '', d.delegateTo || '', d.dropReason || '',
        status, new Date().toISOString()
      ]);
    }
  } catch (err) {
    console.warn('Triage save failed', err);
  }
}

function showPickThree(view) {
  const doItems = state.decisions.filter(d => d.decision === 'Do').map(d => d.item);
  const byDomain = {
    PhD: doItems.filter(i => i.domain === 'PhD'),
    LLW: doItems.filter(i => i.domain === 'LLW'),
    Family: doItems.filter(i => i.domain === 'Family'),
    Other: doItems.filter(i => i.domain === 'Other')
  };
  const opts = (arr) => arr.map(i => `<option value="${escAttr(i.text)}">${escHtml(i.text)}</option>`).join('');

  view.innerHTML = `
    <div class="eyebrow">Step 3 of 3</div>
    <h1>Pick three</h1>
    <p class="subtitle">One per domain. The thing that would matter most.</p>

    <div class="field">
      <label>PhD</label>
      <select id="phd-pick">
        <option value="">Pick from your dump, or type below</option>
        ${opts(byDomain.PhD)}
        ${byDomain.Other.length ? `<optgroup label="Other items from dump">${opts(byDomain.Other)}</optgroup>` : ''}
      </select>
      <input type="text" id="phd-custom" placeholder="Or type your own" class="mt-2" />
    </div>

    <div class="field">
      <label>LLW</label>
      <select id="llw-pick">
        <option value="">Pick from your dump, or type below</option>
        ${opts(byDomain.LLW)}
        ${byDomain.Other.length ? `<optgroup label="Other items from dump">${opts(byDomain.Other)}</optgroup>` : ''}
      </select>
      <input type="text" id="llw-custom" placeholder="Or type your own" class="mt-2" />
    </div>

    <div class="field">
      <label>Family</label>
      <select id="family-pick">
        <option value="">Pick from your dump, or type below</option>
        ${opts(byDomain.Family)}
        ${byDomain.Other.length ? `<optgroup label="Other items from dump">${opts(byDomain.Other)}</optgroup>` : ''}
      </select>
      <input type="text" id="family-custom" placeholder="Or type your own" class="mt-2" />
    </div>

    <button class="btn" id="lock">Lock in this week ${icon('arrow', 18)}</button>
    <div id="msg"></div>
  `;

  document.getElementById('lock').addEventListener('click', async () => {
    const phd = document.getElementById('phd-custom').value.trim() || document.getElementById('phd-pick').value;
    const llw = document.getElementById('llw-custom').value.trim() || document.getElementById('llw-pick').value;
    const family = document.getElementById('family-custom').value.trim() || document.getElementById('family-pick').value;
    if (!phd || !llw || !family) {
      document.getElementById('msg').innerHTML = `<div class="error">Pick or type one priority per domain</div>`;
      return;
    }
    const btn = document.getElementById('lock');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const sheetId = getSheetId();
      const today = new Date();
      const daysToMonday = (1 - today.getDay() + 7) % 7 || 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() + daysToMonday);
      const ws = monday.toISOString().slice(0, 10);
      const now = new Date().toISOString();
      await Promise.all([
        appendRow(sheetId, 'Weekly Priorities', [ws, 'PhD', phd, 'Set', now, now, '']),
        appendRow(sheetId, 'Weekly Priorities', [ws, 'LLW', llw, 'Set', now, now, '']),
        appendRow(sheetId, 'Weekly Priorities', [ws, 'Family', family, 'Set', now, now, ''])
      ]);
      await logWin(`Set 3 priorities for week of ${ws}`, 'Ritual');
      view.innerHTML = `
        <div class="center-screen">
          <div class="celebrate-check">${icon('check', 40)}</div>
          <h1>Locked.</h1>
          <p class="muted">Three priorities for the week starting ${ws}.</p>
          <div class="stack-3" style="max-width: 360px; width: 100%;">
            <div class="priority-card">
              <div class="domain">PhD</div>
              <div class="text">${escHtml(phd)}</div>
            </div>
            <div class="priority-card">
              <div class="domain">LLW</div>
              <div class="text">${escHtml(llw)}</div>
            </div>
            <div class="priority-card">
              <div class="domain">Family</div>
              <div class="text">${escHtml(family)}</div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Lock in this week';
      document.getElementById('msg').innerHTML = `<div class="error">${err.message}</div>`;
    }
  });
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
