import { appendRow } from '../google-sheets.js';
import { getDriveFolderId, getSheetId } from '../store.js';
import { uploadAudioToDrive } from '../google-drive.js';
import { whisperTranscribe, parseBrainDump } from '../api.js';

let state = { items: [], decisions: [], rawText: '', source: 'Text' };

export async function render(view) {
  state = { items: [], decisions: [], rawText: '', source: 'Text' };
  showBrainDump(view);
}

function showBrainDump(view) {
  view.innerHTML = `
    <h1>Sunday Decision</h1>
    <p class="muted">Step 1 of 3 — brain dump</p>
    <p>Get it all out. Work, life, kids, body, money — anything taking up space. Don't filter.</p>

    <div class="field">
      <textarea id="dump" placeholder="Type it all out, one thought per line if it helps..."></textarea>
    </div>

    <div class="field">
      <button class="mic-btn" id="mic">🎙 Voice dump instead</button>
      <div id="voice-status" class="muted" style="margin-top: 8px;"></div>
    </div>

    <button class="btn" id="next">Parse it</button>
    <div id="msg"></div>
  `;
  setupMic();
  document.getElementById('next').addEventListener('click', async () => {
    const text = document.getElementById('dump').value.trim();
    if (!text) {
      document.getElementById('msg').innerHTML = `<div class="error">Add some text or record a voice dump first</div>`;
      return;
    }
    state.rawText = text;
    const btn = document.getElementById('next');
    btn.disabled = true;
    btn.textContent = 'Parsing...';
    try {
      const result = await parseBrainDump(text);
      state.items = result.items || [];
      const sheetId = getSheetId();
      const today = new Date().toISOString().slice(0, 10);
      await appendRow(sheetId, 'Brain Dumps', [today, text, JSON.stringify(state.items), state.source, '']);
      state.decisions = state.items.map(item => ({ item, decision: null, resurfaceDate: '', delegateTo: '', dropReason: '' }));
      if (state.decisions.length === 0) {
        showPickThree(view);
      } else {
        showTriage(view);
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Parse it';
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
      mic.textContent = '🎙 Voice dump instead';
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
        status.textContent = 'Transcribing...';
        const blob = new Blob(chunks, { type: 'audio/webm' });
        try {
          const folderId = getDriveFolderId();
          const fname = `dump-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
          await uploadAudioToDrive(folderId, blob, fname);
          const { transcript } = await whisperTranscribe(blob);
          document.getElementById('dump').value = transcript;
          state.source = 'Voice';
          status.textContent = 'Done — review and edit before parsing.';
        } catch (err) {
          status.innerHTML = `<span class="error">${err.message}</span>`;
        }
      };
      mediaRecorder.start();
      mic.textContent = '⏹ Stop';
      mic.classList.add('recording');
      status.textContent = 'Recording... (tap to stop)';
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

  view.innerHTML = `
    <h1>Triage</h1>
    <p class="muted">Step 2 of 3 — ${remaining} item${remaining !== 1 ? 's' : ''} left · ${escHtml(item.item.domain)}</p>

    <div class="card" style="text-align: center; padding: 32px 20px;">
      <div style="font-size: 18px; line-height: 1.4;">${escHtml(item.item.text)}</div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
      <button class="btn" data-d="Do">Do this week</button>
      <button class="btn btn-ghost" data-d="Delay">Delay</button>
      <button class="btn btn-ghost" data-d="Delegate">Delegate</button>
      <button class="btn btn-ghost" data-d="Drop">Drop</button>
    </div>

    <div id="follow-up" style="margin-top: 20px;"></div>
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
      <input type="text" id="reason" placeholder="One-word reason (optional)" />
      <button class="btn" id="ok" style="margin-top: 10px;">Drop it</button>
    `;
    document.getElementById('ok').addEventListener('click', () => {
      state.decisions[idx].decision = 'Drop';
      state.decisions[idx].dropReason = document.getElementById('reason').value.trim();
      recordTriage(idx).then(() => showTriage(view));
    });
  } else if (decision === 'Delay') {
    followUp.innerHTML = `
      <label>Resurface when?</label>
      <input type="date" id="rdate" />
      <button class="btn" id="ok" style="margin-top: 10px;">Delay</button>
    `;
    document.getElementById('ok').addEventListener('click', () => {
      state.decisions[idx].decision = 'Delay';
      state.decisions[idx].resurfaceDate = document.getElementById('rdate').value;
      recordTriage(idx).then(() => showTriage(view));
    });
  } else if (decision === 'Delegate') {
    followUp.innerHTML = `
      <label>To whom?</label>
      <input type="text" id="who" placeholder="e.g. kids' dad, supervisor, AI, Lara" />
      <button class="btn" id="ok" style="margin-top: 10px;">Delegate</button>
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
    const id = `${today}-${idx}`;
    await appendRow(sheetId, 'Triage', [
      id, today, d.item.text, d.decision, d.item.domain,
      d.resurfaceDate || '', d.delegateTo || '', d.dropReason || '',
      d.decision === 'Delegate' ? 'needs sending' : (d.decision === 'Do' ? 'pending' : ''),
      new Date().toISOString()
    ]);
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
    <h1>Pick three</h1>
    <p class="muted">Step 3 of 3 — one per domain. Pick what would matter most.</p>

    <div class="field">
      <label>PhD</label>
      <select id="phd-pick">
        <option value="">— pick or type below —</option>
        ${opts(byDomain.PhD)}
        ${byDomain.Other.length ? `<optgroup label="Other">${opts(byDomain.Other)}</optgroup>` : ''}
      </select>
      <input type="text" id="phd-custom" placeholder="Or type your own" style="margin-top: 8px;" />
    </div>

    <div class="field">
      <label>LLW</label>
      <select id="llw-pick">
        <option value="">— pick or type below —</option>
        ${opts(byDomain.LLW)}
        ${byDomain.Other.length ? `<optgroup label="Other">${opts(byDomain.Other)}</optgroup>` : ''}
      </select>
      <input type="text" id="llw-custom" placeholder="Or type your own" style="margin-top: 8px;" />
    </div>

    <div class="field">
      <label>Family</label>
      <select id="family-pick">
        <option value="">— pick or type below —</option>
        ${opts(byDomain.Family)}
        ${byDomain.Other.length ? `<optgroup label="Other">${opts(byDomain.Other)}</optgroup>` : ''}
      </select>
      <input type="text" id="family-custom" placeholder="Or type your own" style="margin-top: 8px;" />
    </div>

    <button class="btn" id="lock">Lock in this week</button>
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
    btn.textContent = 'Saving...';
    try {
      const sheetId = getSheetId();
      const today = new Date();
      const monday = new Date(today);
      // Next Monday (if today is Sunday, this Monday is tomorrow; otherwise next week's)
      const daysToMonday = (1 - today.getDay() + 7) % 7 || 7;
      monday.setDate(today.getDate() + daysToMonday);
      const ws = monday.toISOString().slice(0, 10);
      const now = new Date().toISOString();
      await Promise.all([
        appendRow(sheetId, 'Weekly Priorities', [ws, 'PhD', phd, 'Set', now, now, '']),
        appendRow(sheetId, 'Weekly Priorities', [ws, 'LLW', llw, 'Set', now, now, '']),
        appendRow(sheetId, 'Weekly Priorities', [ws, 'Family', family, 'Set', now, now, ''])
      ]);
      view.innerHTML = `
        <div class="center-screen">
          <h1>Locked.</h1>
          <p>Three priorities for the week starting ${ws}.</p>
          <div style="text-align: left; max-width: 320px; line-height: 1.6;">
            <strong>PhD:</strong> ${escHtml(phd)}<br>
            <strong>LLW:</strong> ${escHtml(llw)}<br>
            <strong>Family:</strong> ${escHtml(family)}
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
