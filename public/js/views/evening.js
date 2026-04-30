import { appendRow, getRows, updateRow } from '../google-sheets.js';
import { getSheetId, getDriveFolderId } from '../store.js';
import { uploadAudioToDrive } from '../google-drive.js';
import { whisperTranscribe } from '../api.js';
import { icon } from '../icons.js';

let state = { outcome: null, win: '', voiceMemoUrl: '' };

export async function render(view) {
  state = { outcome: null, win: '', voiceMemoUrl: '' };
  const today = new Date().toISOString().slice(0, 10);
  const sheetId = getSheetId();

  let todayRow = null;
  let todayRowIndex = -1;
  let priority = '';
  try {
    const rows = await getRows(sheetId, 'Daily Check-in');
    rows.forEach((r, i) => {
      if (r[0] === today) {
        todayRow = r;
        todayRowIndex = i + 1;
        priority = r[4];
      }
    });
  } catch (err) {
    console.error(err);
  }

  view.innerHTML = `
    <div class="eyebrow">${formatToday()}</div>
    <h1>Evening close</h1>
    <p class="subtitle">A gentle wrap. No pressure.</p>

    ${priority ? `
      <div class="priority-card">
        <div class="domain">Today's priority was</div>
        <div class="text">${escHtml(priority)}</div>
      </div>
      <div class="field">
        <label>Did it move?</label>
        <div class="outcome-row" id="outcome">
          <button data-out="Moved">Moved</button>
          <button data-out="Some">Some</button>
          <button data-out="No">No</button>
        </div>
      </div>
    ` : `
      <div class="card">
        <p style="margin: 0;">No check-in logged this morning. That happens. Log a win below if you want.</p>
      </div>
    `}

    <div class="field">
      <label>Log a win <span class="faint">(anything counts)</span></label>
      <input type="text" id="win" placeholder="read 1 paragraph · made dinner · stepped outside" autocomplete="off" />
    </div>

    <div class="field">
      <label>Voice dump <span class="faint">(optional)</span></label>
      <button class="mic-btn" id="mic">${icon('mic', 16)} Record</button>
      <div id="voice-status" class="help" style="margin-top: 8px;"></div>
    </div>

    <button class="btn" id="submit">Close out</button>
    <div id="msg"></div>
  `;

  if (priority) {
    document.getElementById('outcome').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-out]');
      if (!btn) return;
      state.outcome = btn.dataset.out;
      document.querySelectorAll('#outcome button').forEach(b =>
        b.classList.toggle('selected', b.dataset.out === btn.dataset.out));
    });
  }
  document.getElementById('win').addEventListener('input', (e) => {
    state.win = e.target.value.trim();
  });

  setupMic();
  document.getElementById('submit').addEventListener('click', () => submit(view, todayRow, todayRowIndex));
}

let mediaRecorder = null;
let chunks = [];
function setupMic() {
  const mic = document.getElementById('mic');
  const status = document.getElementById('voice-status');
  mic.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      mic.innerHTML = `${icon('mic', 16)} Record`;
      mic.classList.remove('recording');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        status.textContent = 'Transcribing…';
        const blob = new Blob(chunks, { type: 'audio/webm' });
        try {
          const folderId = getDriveFolderId();
          const fname = `evening-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
          const url = await uploadAudioToDrive(folderId, blob, fname);
          state.voiceMemoUrl = url;
          const { transcript } = await whisperTranscribe(blob);
          status.innerHTML = `<strong>Transcript:</strong> ${escHtml(transcript)}`;
          if (!state.win) {
            state.win = transcript.slice(0, 200);
            document.getElementById('win').value = state.win;
          }
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

async function submit(view, todayRow, todayRowIndex) {
  const btn = document.getElementById('submit');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  const msg = document.getElementById('msg');
  try {
    const sheetId = getSheetId();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    if (todayRow && todayRowIndex > 0) {
      const updated = [...todayRow];
      while (updated.length < 10) updated.push('');
      updated[6] = state.outcome || updated[6] || '';
      updated[7] = state.win || updated[7] || '';
      updated[8] = state.voiceMemoUrl || updated[8] || '';
      await updateRow(sheetId, 'Daily Check-in', todayRowIndex, updated);
    }
    if (state.win) {
      await appendRow(sheetId, 'Wins', [today, state.win, '', now]);
    }

    view.innerHTML = `
      <div class="center-screen">
        <div class="celebrate-check">${icon('check', 40)}</div>
        <h1>Done.</h1>
        ${state.win ? `<div class="card warm" style="max-width: 360px;">
          <div class="eyebrow">Win logged</div>
          <div style="font-size: 16px; color: var(--ink);">${escHtml(state.win)}</div>
        </div>` : ''}
        <p class="muted">Rest well. Tomorrow's morning check-in is ready when you are.</p>
      </div>
    `;
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = 'Close out';
    msg.innerHTML = `<div class="error">Couldn't save: ${err.message}</div>`;
  }
}

function formatToday() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
